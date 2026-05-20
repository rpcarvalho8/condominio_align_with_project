/**
 * Reconciliation Engine — Gestão Condomínio
 *
 * Crosses: name in descritivo + amount + reference text → fração + category + confidence
 *
 * Architecture:
 *   1. Per-fração DEBT TABLE (what each fração owes for each account type)
 *   2. MATCH ENGINE: for each uncategorised Entrada:
 *      a) Identify payer (name→fração map)
 *      b) Match amount against known debt amounts
 *      c) Boost confidence with keyword signals
 *      d) Handle combined payments (e.g. T+D, condo+quota-extra)
 *   3. RESULT: categoria, subCategoria, confidence (0–100), explanation
 */

// ─── Per-fração debt table ─────────────────────────────────────────────────────
// Amounts owed per fração per account type (2026)
// Sources: dashboard.ts, Excel Sheet5, user-confirmed values

export interface FracaoDebt {
  condominio: number;       // monthly quota
  quotaExtraTotal: number;  // elevadores + portão combined
  portao: number;           // subset of quotaExtraTotal
  obras: number;            // Obras Fachada
  incendio: number;         // Obra-Incêndio
  fundoReserva?: number;    // Fundo Reserva if applicable
}

// Monthly condomínio quotas (2026 rates)
const MONTHLY_QUOTAS: Record<string, number> = {
  J: 43.65, L: 46.98, M: 44.44, N: 43.67, O: 46.98, P: 48.71,
  Q: 41.78, R: 63.84, S: 36.38, T: 43.31, U: 64.36, V: 38.30,
  X: 43.67, Z: 62.04, AA: 39.44, AB: 39.37, AE: 41.62, AF: 39.61,
  AG: 39.83, AH: 46.08, AI: 40.33, AJ: 38.89,
  G: 25.74, H: 19.54, I: 25.32, AC: 125.04, AD: 86.08,
  A: 3.24, B: 3.28, C: 3.24, D: 3.65, E: 3.46, F: 3.74,
};

// Older monthly quotas (2023–2024 before rate increase)
const OLD_MONTHLY_QUOTAS: Record<string, number> = {
  S: 28.33, U: 50.11, V: 29.82, Z: 48.31, AA: 30.71, AF: 30.84,
  AI: 31.40, AJ: 32.66, Q: 32.53, J: 33.99, N: 34.00, O: 36.58,
  P: 37.93, AB: 39.37, // AB unchanged
};

// Portão amounts per fração (from Orçamento sheet, user-confirmed)
export const PORTAO_AMOUNTS: Record<string, number> = {
  U: 40.46, R: 40.14, Z: 39.00, P: 30.62, L: 29.53, O: 29.53,
  M: 27.94, X: 27.67, N: 27.46, J: 27.44, T: 27.23, Q: 26.27,
  AE: 26.17, AG: 25.04, AF: 24.90, AA: 24.80, AB: 24.75, AJ: 24.45,
  V: 24.08, S: 22.87, G: 16.24,
  AH: 28.97,  // already paid
  AI: 25.35,  // already paid
};

// Quota-extra total (elevadores + portão) per fração
// From CSV categorised payments
const QUOTA_EXTRA_TOTAL: Record<string, number> = {
  J: 41.39,  // observed once
  M: 43.44,
  N: 38.82,  // permilage-based
  O: 46.98,
  P: 43.30,
  Q: 37.14,
  R: 56.75,
  S: 54.44,  // largest observed (includes portão)
  T: 38.50,
  U: 80.33,
  V: 34.05,
  X: 39.12,
  Z: 55.15,
  AA: 35.06,
  AB: 35.00,
  AE: 37.00,  // permilage-based
  AF: 39.61,
  AG: 35.41,
  AH: 81.92,
  AI: 215.10,  // large batch payment observed
  AJ: 34.57,
  AD: 12.96,
  AC: 18.84,
  H: 16.96,
  I: 22.00,
  D: 3.15,
  E: 3.00,
  F: 3.25,
  B: 8.58,
};

// Common combined payment amounts (composite patterns learned from CSV)
// key = fracao, value = list of known composite amounts and their breakdown
const COMPOSITE_AMOUNTS: Record<string, Array<{ amount: number; breakdown: Array<{ categoria: string; amount: number }>; note: string }>> = {
  T: [
    {
      amount: 45.13,
      breakdown: [
        { categoria: "Condomínio:T", amount: 43.31 },
        { categoria: "Condomínio:D", amount: 1.82 },
      ],
      note: "T+D condo combined (Susana)",
    },
    {
      amount: 86.78,
      breakdown: [
        { categoria: "Condomínio:T", amount: 43.31 },
        { categoria: "Condomínio:D", amount: 1.82 },
        { categoria: "Quota-Extra:T", amount: 38.50 },
        { categoria: "Quota-Extra:D", amount: 3.15 },
      ],
      note: "T+D condo + quota-extra",
    },
  ],
  AE: [
    {
      amount: 43.27,
      breakdown: [
        { categoria: "Condomínio:AE", amount: 41.62 },
        { categoria: "Condomínio:B", amount: 1.65 },
      ],
      note: "AE condo + B garagem (Germano)",
    },
    {
      amount: 43.26,
      breakdown: [
        { categoria: "Condomínio:AE", amount: 41.62 },
        { categoria: "Condomínio:B", amount: 1.64 },
      ],
      note: "AE condo + B garagem (Germano, rounding)",
    },
  ],
  AB: [
    {
      amount: 74.37,
      breakdown: [
        { categoria: "Condomínio:AB", amount: 39.37 },
        { categoria: "Quota-Extra:AB", amount: 35.00 },
      ],
      note: "AB condo + quota-extra",
    },
    {
      amount: 148.74,
      breakdown: [
        { categoria: "Condomínio:AB", amount: 39.37 },
        { categoria: "Quota-Extra:AB", amount: 35.00 },
        { categoria: "Condomínio:AB", amount: 39.37 },
        { categoria: "Quota-Extra:AB", amount: 35.00 },
      ],
      note: "2 months AB condo + quota-extra",
    },
  ],
};

// ─── Reconciliation result ─────────────────────────────────────────────────────
export interface ReconciliationMatch {
  categoria: string;
  subCategoria: string;
  confidence: number;       // 0–100
  explanation: string;
  amountMatched?: number;
  amountExpected?: number;
  isComposite?: boolean;    // payment covers multiple categories
  compositeBreakdown?: Array<{ categoria: string; amount: number }>;
}

// ─── Helper functions ──────────────────────────────────────────────────────────
function norm(s: string): string {
  return s.toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function amountMatch(actual: number, expected: number, tolerance = 0.02): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

function amountConfidence(actual: number, expected: number): number {
  const diff = Math.abs(actual - expected);
  if (diff === 0) return 100;
  if (diff <= 0.01) return 99;
  if (diff <= 0.05) return 95;
  if (diff <= 0.10) return 90;
  if (diff <= 0.50) return 80;
  if (diff <= 1.00) return 70;
  return 0;
}

// Keyword signals in the description that boost/hint at category
function descKeywordSignals(desc: string): { portao: boolean; quotaExtra: boolean; obras: boolean; incendio: boolean; condo: boolean; fundo: boolean } {
  const u = norm(desc);
  return {
    portao:     /PORTAO|GARAGEM|MOTOR|PORTAO GARAGEM/.test(u),
    quotaExtra: /QUOTA.?EXTRA|COTA.?EXTRA|ELEVADOR/.test(u),
    obras:      /OBRAS|FACHADA|OBRA/.test(u),
    incendio:   /INCENDIO|INCEND/.test(u),
    condo:      /CONDOMIN|CONDO|QUOTA\s+COND/.test(u),
    fundo:      /FUNDO|RESERVA|FUNDO.?RESERVA/.test(u),
  };
}

// ─── MAIN RECONCILIATION FUNCTION ─────────────────────────────────────────────
/**
 * Given a bank movement (uncategorised Entrada), attempt to reconcile it
 * against known per-fração debt amounts.
 *
 * @param descritivo   Full description from bank statement
 * @param amount       Payment amount (positive number)
 * @param fracaoId     Fração ID already identified from name matching (or undefined)
 * @returns ReconciliationMatch or null if no match found
 */
export function reconcilePayment(
  descritivo: string,
  amount: number,
  fracaoId?: string
): ReconciliationMatch | null {

  if (!fracaoId) return null; // Can't reconcile without knowing the fração

  const signals = descKeywordSignals(descritivo);
  const monthly = MONTHLY_QUOTAS[fracaoId];
  const portao = PORTAO_AMOUNTS[fracaoId];
  const quotaExtra = QUOTA_EXTRA_TOTAL[fracaoId];

  // ── 1. Portão exact match ──
  if (portao && amountMatch(amount, portao)) {
    const conf = amountConfidence(amount, portao) + (signals.portao ? 5 : 0);
    return {
      categoria: "Quota-Extra",
      subCategoria: fracaoId,
      confidence: Math.min(100, conf),
      explanation: `Montante ${amount}€ = portão fração ${fracaoId} (${portao}€)`,
      amountMatched: amount,
      amountExpected: portao,
    };
  }

  // ── 2. Monthly condomínio exact match ──
  if (monthly && amountMatch(amount, monthly)) {
    const conf = amountConfidence(amount, monthly) + (signals.condo ? 5 : 0);
    return {
      categoria: "Condomínio",
      subCategoria: fracaoId,
      confidence: Math.min(100, conf),
      explanation: `Montante ${amount}€ = quota mensal condomínio fração ${fracaoId} (${monthly}€)`,
      amountMatched: amount,
      amountExpected: monthly,
    };
  }

  // ── 3. Old monthly quota (2023-2024 rate) ──
  const oldMonthly = OLD_MONTHLY_QUOTAS[fracaoId];
  if (oldMonthly && amountMatch(amount, oldMonthly)) {
    return {
      categoria: "Condomínio",
      subCategoria: fracaoId,
      confidence: 88,
      explanation: `Montante ${amount}€ = quota antiga (2023-2024) fração ${fracaoId} (${oldMonthly}€)`,
      amountMatched: amount,
      amountExpected: oldMonthly,
    };
  }

  // ── 4. Quota-Extra exact match ──
  if (quotaExtra && amountMatch(amount, quotaExtra)) {
    const conf = amountConfidence(amount, quotaExtra) + (signals.quotaExtra ? 5 : 0);
    return {
      categoria: "Quota-Extra",
      subCategoria: fracaoId,
      confidence: Math.min(100, conf),
      explanation: `Montante ${amount}€ = quota-extra fração ${fracaoId} (${quotaExtra}€)`,
      amountMatched: amount,
      amountExpected: quotaExtra,
    };
  }

  // ── 5. Composite amounts (known combinations) ──
  const composites = COMPOSITE_AMOUNTS[fracaoId];
  if (composites) {
    for (const comp of composites) {
      if (amountMatch(amount, comp.amount, 0.05)) {
        return {
          categoria: comp.breakdown[0].categoria.split(":")[0],
          subCategoria: fracaoId,
          confidence: amountConfidence(amount, comp.amount) + 5,
          explanation: `Pagamento composto: ${comp.note}`,
          amountMatched: amount,
          amountExpected: comp.amount,
          isComposite: true,
          compositeBreakdown: comp.breakdown.map(b => ({
            categoria: b.categoria,
            amount: b.amount,
          })),
        };
      }
    }
  }

  // ── 6. Condo + Quota-Extra combined ──
  if (monthly && quotaExtra) {
    const combined = monthly + quotaExtra;
    if (amountMatch(amount, combined, 0.10)) {
      return {
        categoria: "Condomínio",
        subCategoria: fracaoId,
        confidence: amountConfidence(amount, combined) + 3,
        explanation: `Montante ${amount}€ ≈ condo ${monthly}€ + quota-extra ${quotaExtra}€ = ${combined.toFixed(2)}€`,
        amountMatched: amount,
        amountExpected: combined,
        isComposite: true,
        compositeBreakdown: [
          { categoria: "Condomínio", amount: monthly },
          { categoria: "Quota-Extra", amount: quotaExtra },
        ],
      };
    }
  }

  // ── 7. Multiple months of condo ──
  if (monthly) {
    for (const months of [2, 3, 4, 5, 6, 12]) {
      const multi = monthly * months;
      if (amountMatch(amount, multi, 0.20)) {
        return {
          categoria: "Condomínio",
          subCategoria: fracaoId,
          confidence: Math.max(60, amountConfidence(amount, multi) - 10),
          explanation: `Montante ${amount}€ ≈ ${months} meses de condo fração ${fracaoId} (${monthly}€/mês = ${multi.toFixed(2)}€)`,
          amountMatched: amount,
          amountExpected: multi,
        };
      }
    }
  }

  // ── 8. Condo + portão ──
  if (monthly && portao) {
    const condoPlusPortao = monthly + portao;
    if (amountMatch(amount, condoPlusPortao, 0.10)) {
      return {
        categoria: "Condomínio",
        subCategoria: fracaoId,
        confidence: amountConfidence(amount, condoPlusPortao) + 3,
        explanation: `Montante ${amount}€ ≈ condo ${monthly}€ + portão ${portao}€ = ${condoPlusPortao.toFixed(2)}€`,
        amountMatched: amount,
        amountExpected: condoPlusPortao,
        isComposite: true,
        compositeBreakdown: [
          { categoria: "Condomínio", amount: monthly },
          { categoria: "Quota-Extra (Portão)", amount: portao },
        ],
      };
    }
  }

  // ── 9. Keyword-only fallback (low confidence) ──
  if (signals.portao && portao) {
    return {
      categoria: "Quota-Extra",
      subCategoria: fracaoId,
      confidence: 55,
      explanation: `Descrição menciona portão/garagem — possível pagamento portão fração ${fracaoId} (${portao}€)`,
    };
  }
  if (signals.quotaExtra && quotaExtra) {
    return {
      categoria: "Quota-Extra",
      subCategoria: fracaoId,
      confidence: 50,
      explanation: `Descrição menciona quota-extra — possível pagamento quota-extra fração ${fracaoId} (${quotaExtra}€)`,
    };
  }
  if (signals.condo && monthly) {
    return {
      categoria: "Condomínio",
      subCategoria: fracaoId,
      confidence: 50,
      explanation: `Descrição menciona condomínio — fração ${fracaoId} quota mensal ${monthly}€`,
    };
  }

  // ── 10. Default: classify as condomínio payment (name matched, amount unknown) ──
  return {
    categoria: "Condomínio",
    subCategoria: fracaoId,
    confidence: 40,
    explanation: `Pagador identificado como fração ${fracaoId}, montante ${amount}€ não corresponde a valor conhecido`,
  };
}

// ─── SPECIAL CASE PATTERNS ────────────────────────────────────────────────────
// Patterns that override generic reconciliation

export interface SpecialCaseResult {
  fracao: string;
  categoria: string;
  subCategoria: string;
  confidence: number;
  explanation: string;
}

export function matchSpecialCases(
  descritivo: string,
  amount: number
): SpecialCaseResult | null {
  const u = norm(descritivo);
  const d = descritivo;

  // ── U's CONDOMINIO-XXXXX reference payments (no name, just ref) ──
  // Pattern: "CONDOMINIO-XXXXXXX" with amount = 64.36 (2025-2026 rate) or 50.11 (2024 rate)
  // Note: u is already normalised (no accents), so ÍO→IO
  if (/^CONDOMIN[IO]?[O0]?\s*-\s*\d+$/i.test(d.trim()) || /^CONDOMINI[O0]-\d+$/i.test(d.trim())) {
    if (amountMatch(amount, 64.36)) {
      return { fracao: "U", categoria: "Condomínio", subCategoria: "U", confidence: 97, explanation: "CONDOMINIO-ref com montante 64.36€ = quota U (Catarina)" };
    }
    if (amountMatch(amount, 50.11)) {
      return { fracao: "U", categoria: "Condomínio", subCategoria: "U", confidence: 97, explanation: "CONDOMINIO-ref com montante 50.11€ = quota antiga U (Catarina 2024)" };
    }
  }

  // ── QUOTA EXTRA / quota extra with numeric ref (57.21, 34.09) ──
  // "quota extra 5-XXXX", "QUOTA EXTRA 36-XXXX" etc.
  if (/QUOTA.?EXTRA|COTA.?EXTRA/.test(u)) {
    if (amountMatch(amount, 57.21)) {
      // 57.21 = U permilage, appears alongside U condo payments in same period → U quota-extra (partial)
      return { fracao: "U", categoria: "Quota-Extra", subCategoria: "U", confidence: 75, explanation: "Quota extra 57.21€ ≈ U quota-extra parcial (permilagem U = 57.21‰)" };
    }
    if (amountMatch(amount, 34.09)) {
      // 34.09 appears in Aug 2025 around other U payments
      return { fracao: "U", categoria: "Quota-Extra", subCategoria: "U", confidence: 65, explanation: "Quota extra 34.09€ — provável pagamento parcial quota-extra U" };
    }
    // Generic quota-extra without fração — needs manual review
    return null;
  }

  // ── AB Hab RC A ──
  if (/^AB\s+HAB/i.test(d)) {
    if (amountMatch(amount, 74.37)) {
      return { fracao: "AB", categoria: "Condomínio", subCategoria: "AB", confidence: 99, explanation: "AB Hab RC A 74.37€ = AB condo(39.37) + quota-extra(35.00)" };
    }
    return { fracao: "AB", categoria: "Condomínio", subCategoria: "AB", confidence: 85, explanation: "AB Hab RC A → fração AB" };
  }

  // ── fraçao AB, fracçao AB (Ilídio Marinho) ──
  if (/FRACC?[AÃ]O\s*AB|FRACCO\s*AB|FRACAO\s*AB/i.test(u) || /ILIDIO\s+MARINHO/i.test(u)) {
    if (amountMatch(amount, 148.74)) {
      return { fracao: "AB", categoria: "Condomínio", subCategoria: "AB", confidence: 98, explanation: "Fracção AB 148.74€ = 2 meses AB condo(39.37) + quota-extra(35.00)" };
    }
    if (amountMatch(amount, 74.37)) {
      return { fracao: "AB", categoria: "Condomínio", subCategoria: "AB", confidence: 98, explanation: "Fracção AB 74.37€ = AB condo(39.37) + quota-extra(35.00)" };
    }
    return { fracao: "AB", categoria: "Condomínio", subCategoria: "AB", confidence: 90, explanation: "Fracção AB (Ilídio Marinho)" };
  }

  // ── fraço T e D, fracões T e D (Susana) ──
  if (/FRACO[SE]?\s+T\s+(E\s+)?D|FRACOES\s+T\s+E\s+D|FRACAO\s+T\s+E\s+D|FRACAO\s+D\s+T|FRACAO\s+T\s*\/\s*D/i.test(u)
    || /SUSANA.*FRACAO|SUSANA.*FRACCO/i.test(u)
  ) {
    if (amountMatch(amount, 45.13)) {
      return { fracao: "T", categoria: "Condomínio", subCategoria: "T", confidence: 99, explanation: "T+D condo: 43.31+1.82=45.13€" };
    }
    if (amountMatch(amount, 173.56)) {
      // 173.56 = 45.13 + 128.43
      // 128.43 ≈ T quota-extra(38.50) + D quota-extra(3.15) + T portão(27.23) + obras?
      // Most likely: T(condo+QE) + D(condo+QE) + T portão = 43.31+38.50+1.82+3.15+27.23 = 114.01... +59.55?
      // Or: 45.13 + 38.50(T QE) + 3.15(D QE) + obras T? = 86.78 + 86.78 = 173.56!
      // 86.78 * 2 = 173.56 → 2 months of (T+D condo + T+D QE)
      return { fracao: "T", categoria: "Condomínio", subCategoria: "T", confidence: 90, explanation: "T+D 173.56€ = 2 meses (T+D condo + quota-extra) ou combinação" };
    }
    if (amountMatch(amount, 69.84)) {
      return { fracao: "T", categoria: "Condomínio", subCategoria: "T", confidence: 90, explanation: "FRAÇÃO T/D 69.84€ (combinação condo+extras T+D)" };
    }
    if (amountMatch(amount, 139.68)) {
      return { fracao: "T", categoria: "Condomínio", subCategoria: "T", confidence: 88, explanation: "FRAÇÃO D T 139.68€ = 2x 69.84 (T+D 2 meses)" };
    }
    return { fracao: "T", categoria: "Condomínio", subCategoria: "T", confidence: 80, explanation: "Pagamento combinado T+D (Susana)" };
  }

  // ── Germano Macahdo (typo) ──
  if (/GERMANO\s+MAC[AH]/i.test(u)) {
    if (amountMatch(amount, 43.27)) {
      return { fracao: "AE", categoria: "Condomínio", subCategoria: "AE", confidence: 99, explanation: "Germano Macahdo 43.27€ = AE condo(41.62) + B garagem(1.65)" };
    }
    return { fracao: "AE", categoria: "Condomínio", subCategoria: "AE", confidence: 90, explanation: "Germano Machado (typo) → fração AE" };
  }

  // ── DEPÓSITO NUMERÁRIO fracão AH ──
  if (/DEP[OÓ]SITO\s+NUMER[AÁ]RIO.*AH|AH.*DEP[OÓ]SITO/i.test(u)) {
    if (amountMatch(amount, 87.04)) {
      return { fracao: "AH", categoria: "Condomínio", subCategoria: "AH", confidence: 92, explanation: "Depósito fração AH 87.04€ (provável condo + quota-extra)" };
    }
    return { fracao: "AH", categoria: "Condomínio", subCategoria: "AH", confidence: 85, explanation: "Depósito numerário fração AH" };
  }

  // ── Pagamentos Condomínio (QUOTA CONDOMÍNIO generic, old S rate) ──
  if (/QUOTA\s+CONDOM[IÍ]N|CONDOM[IÍ]N[IO]\s*-?\s*\d|CONDOMIN/i.test(u)) {
    if (amountMatch(amount, 28.33)) {
      return { fracao: "S", categoria: "Condomínio", subCategoria: "S", confidence: 85, explanation: "Quota condomínio 28.33€ = quota antiga S (Célia Beatriz, 2023)" };
    }
    if (amountMatch(amount, 28.50)) {
      return { fracao: "S", categoria: "Condomínio", subCategoria: "S", confidence: 78, explanation: "Condomínio em falta 28.50€ ≈ quota S 28.33€ + dif" };
    }
  }

  // ── JPR GC FR A 800 / Jardim Solar / Rebimotor / urb fonte bloco ──
  // These are external service payments
  if (/JPR\s+GC\s+FR\s+A\s+800|JARDIM\s+SOLAR|REBIMOTOR.*FAC/i.test(u)) {
    return { fracao: "", categoria: "Jardim", subCategoria: "", confidence: 80, explanation: "Pagamento serviço jardim/manutenção exterior" };
  }
  if (/URB\s+FONTE\s+BLOCO|URB.*FONTE.*BLOCO/i.test(u)) {
    return { fracao: "", categoria: "Manutenção", subCategoria: "", confidence: 70, explanation: "Pagamento manutenção bloco" };
  }

  // ── COND RUA CIMO DE VILA (another building) ──
  if (/COND\s+RUA\s+CIMO\s+DE\s+VILA/i.test(u)) {
    return { fracao: "", categoria: "Outros", subCategoria: "", confidence: 85, explanation: "Pagamento de outro condomínio (Rua Cimo de Vila)" };
  }

  // ── ENG JOAO MOREIRA ──
  if (/ENG\s+JOAO\s+MOREIRA/i.test(u)) {
    return { fracao: "", categoria: "Outros", subCategoria: "", confidence: 70, explanation: "Engenheiro João Moreira — origem não identificada" };
  }

  // ── JOAQUIM JORGE PEREIRA SOBR ──
  if (/JOAQUIM\s+JORGE\s+PEREIRA/i.test(u)) {
    return { fracao: "", categoria: "Outros", subCategoria: "", confidence: 65, explanation: "Joaquim Jorge Pereira Sobreiro — pagador externo não identificado" };
  }

  // ── DÉBITO DIRETO EDP ──
  if (/D[EÉ]BITO\s+DIRETO.*EDP/i.test(u)) {
    return { fracao: "", categoria: "Eletricidade", subCategoria: "", confidence: 95, explanation: "Débito direto EDP (eletricidade)" };
  }

  return null;
}

// ─── Full entry reconciliation ─────────────────────────────────────────────────
// Combines name-matching + special cases + generic reconciliation

export interface FullReconciliation {
  categoria: string;
  subCategoria: string;
  confidence: number;
  explanation: string;
  source: "special-case" | "amount-match" | "name-only" | "unresolved";
  isComposite?: boolean;
  compositeBreakdown?: Array<{ categoria: string; amount: number }>;
}

export function fullReconcile(
  descritivo: string,
  amount: number,
  fracaoFromName?: string   // already resolved by name matcher
): FullReconciliation | null {

  // 1. Try special cases first (highest precision patterns)
  const special = matchSpecialCases(descritivo, amount);
  if (special) {
    return {
      categoria: special.categoria,
      subCategoria: special.subCategoria,
      confidence: special.confidence,
      explanation: special.explanation,
      source: "special-case",
    };
  }

  // 2. If we have a fração from name, try amount reconciliation
  if (fracaoFromName) {
    const amtMatch = reconcilePayment(descritivo, amount, fracaoFromName);
    if (amtMatch && amtMatch.confidence >= 40) {
      return {
        categoria: amtMatch.categoria,
        subCategoria: amtMatch.subCategoria,
        confidence: amtMatch.confidence,
        explanation: amtMatch.explanation,
        source: amtMatch.confidence >= 80 ? "amount-match" : "name-only",
        isComposite: amtMatch.isComposite,
        compositeBreakdown: amtMatch.compositeBreakdown,
      };
    }
  }

  return null;
}
