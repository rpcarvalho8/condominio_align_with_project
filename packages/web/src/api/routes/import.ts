import { Hono } from "hono";
import { requireAdmin } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import crypto from "node:crypto";

// ─── CSV Parser ────────────────────────────────────────────────────────────────
function parseMonthPT(mes: string): number {
  const map: Record<string, number> = {
    janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4,
    maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9,
    outubro: 10, novembro: 11, dezembro: 12,
  };
  return map[mes.toLowerCase().trim()] ?? 0;
}

function parseDate(s: string): Date | null {
  const t = s.trim();
  let m = t.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
  return null;
}

function parseAmount(s: string): number {
  const v = parseFloat(s.replace(/[€\s]/g, "").replace(/,(?=\d{3})/g, ""));
  return isNaN(v) ? 0 : Math.abs(v);
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cols: string[] = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    cols.push(cur.trim());
    rows.push(cols);
  }
  return rows;
}

// ─── Category Mapping ─────────────────────────────────────────────────────────
const DIRECT_CAT: Record<string, string> = {
  "condomínio": "quota", "condominio": "quota",
  "limpeza": "limpeza",
  "jardim": "jardim", "jardinagem": "jardim",
  "elevadores": "elevadores",
  "elevadores - manutenção": "elevadores",
  "elevadores - manutencao": "elevadores",
  "água": "agua", "agua": "agua",
  "eletricidade": "eletricidade", "electricidade": "eletricidade",
  "honorários administração": "administracao",
  "honorarios administracao": "administracao",
  "honorários administracão": "administracao",
  "manutenção": "manutencao", "manutencao": "manutencao",
  "seguros": "seguros",
  "quota-extra": "quota_extra",
  "obras fachada": "obras_fachada",
  "outras receitas": "receita",
  "diversos": "outros",
};

const KW_MAP: Array<[RegExp, string]> = [
  [/limpez/i, "limpeza"],
  [/jardinage|jardin/i, "jardim"],
  [/elevador/i, "elevadores"],
  [/indaqua|agua|água/i, "agua"],
  [/iberdrola|edp|endesa|su eletri|eletricidade|electricidade/i, "eletricidade"],
  [/honora|sergio miguel monteiro|rui carvalho|catarina reis/i, "administracao"],
  [/administr/i, "administracao"],
  [/seguro/i, "seguros"],
];

function inferCat(catRaw: string, desc: string): string {
  const c = catRaw.toLowerCase().trim();
  if (c && DIRECT_CAT[c]) return DIRECT_CAT[c];
  for (const [re, m] of KW_MAP) if (re.test(desc)) return m;
  return "outros";
}

function isBankFee(catRaw: string, desc: string): boolean {
  const c = catRaw.toLowerCase().trim();
  if (c.includes("despesas bancár") || c.includes("despesas bancar") || c.includes("bancár") || c.includes("bancar")) return true;
  const d = desc.toUpperCase();
  return d.startsWith("IMP.SELO") || d.startsWith("COMISSAO") || d.startsWith("COMISSÃO") ||
    d.startsWith("MANUTENCAO DE CONTA") || d.startsWith("IMPOSTO DO SELO") ||
    d.startsWith("RETENÇÃO IRS") || d.startsWith("RETENCAO IRS") || d.startsWith("JURO ILIQUIDO");
}

function shouldSkipSaida(catRaw: string, desc: string): boolean {
  if (isBankFee(catRaw, desc)) return true;
  const dl = desc.toLowerCase();
  if (dl.includes("devolução") || dl.includes("devolucao")) return true;
  return false;
}

function isQuotaEntrada(catRaw: string): boolean {
  const c = catRaw.toLowerCase().trim();
  return c.includes("condom") || c === "quota-extra" || c === "obras fachada";
}

function hashBuf(buf: ArrayBuffer): string {
  return crypto.createHash("sha256").update(Buffer.from(buf)).digest("hex");
}

// Dedup key for despesas
function despesaKey(descricao: string, valor: number, date: Date): string {
  const day = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  return `${descricao}|${valor.toFixed(2)}|${day}`;
}

// ─── Routes ───────────────────────────────────────────────────────────────────
export const importRoutes = new Hono()
  .post("/movimentos", requireAdmin, async (c) => {
    try {
      const body = await c.req.parseBody();
      const file = body["file"];
      if (!file || typeof file === "string") {
        return c.json({ error: "Campo 'file' obrigatório (CSV upload)" }, 400);
      }

      const fileObj = file as File;
      const buffer = await fileObj.arrayBuffer();
      const fileHash = hashBuf(buffer);
      const filename = fileObj.name || "upload.csv";

      // Idempotency: skip if same file already imported successfully
      const prev = await db.select().from(schema.importLogs)
        .where(and(eq(schema.importLogs.fileHash, fileHash), eq(schema.importLogs.status, "ok")))
        .limit(1);
      if (prev.length > 0) {
        return c.json({ ok: true, alreadyImported: true, message: "Ficheiro já importado anteriormente", previousImport: prev[0] });
      }

      const text = new TextDecoder("latin1").decode(buffer);
      const allRows = parseCSV(text);
      const dataRows = allRows.slice(2).filter(r => r.length >= 8 && r[6]?.trim());

      // ── PRE-LOAD all existing data for fast dedup ─────────────────────────
      const [allFracoes, existingDespesas, existingQuotas] = await Promise.all([
        db.select().from(schema.fracoes),
        db.select({ id: schema.despesas.id, descricao: schema.despesas.descricao, valor: schema.despesas.valor, data: schema.despesas.data })
          .from(schema.despesas),
        db.select({ id: schema.quotas.id, fracaoId: schema.quotas.fracaoId, mes: schema.quotas.mes, ano: schema.quotas.ano, tipo: schema.quotas.tipo })
          .from(schema.quotas),
      ]);

      const fracaoByNum = new Map(allFracoes.map(f => [f.numero.toUpperCase(), f]));

      // Build dedup sets
      const despesaKeys = new Set<string>();
      for (const d of existingDespesas) {
        const dDate = d.data instanceof Date ? d.data : new Date((d.data as number) * 1000);
        despesaKeys.add(despesaKey(d.descricao, d.valor, dDate));
      }

      // quota dedup: "fracaoId|mes|ano|tipo"
      const quotaKeys = new Set<string>(
        existingQuotas.map(q => `${q.fracaoId}|${q.mes}|${q.ano}|${q.tipo}`)
      );

      const results = {
        totalRows: dataRows.length,
        quotasCreated: 0,
        quotasUpdated: 0,
        despesasCreated: 0,
        despesasSkipped: 0,
        errors: [] as string[],
      };

      // Collect all DB operations, then batch execute
      const despesasToInsert: (typeof schema.despesas.$inferInsert)[] = [];
      const quotasToInsert:   (typeof schema.quotas.$inferInsert)[]   = [];
      const quotasToUpdate:   { fracaoId: string; mes: number; ano: number; tipo: string; valor: number; data: Date }[] = [];

      for (const row of dataRows) {
        try {
          const dataStr    = row[1]?.trim() ?? "";
          const tipo       = row[5]?.trim() ?? "";
          const descritivo = row[6]?.trim() ?? "";
          const montante   = row[7]?.trim() ?? "";
          const mesStr     = row[3]?.trim() ?? "";
          const anoStr     = row[4]?.trim() ?? "";
          const catRaw     = row[9]?.trim() ?? "";
          const subCat     = row[10]?.trim().toUpperCase() ?? "";

          const data  = parseDate(dataStr);
          const mes   = parseMonthPT(mesStr);
          const ano   = parseInt(anoStr);
          const valor = parseAmount(montante);

          if (!data || !mes || !ano || valor === 0) continue;
          if (isBankFee(catRaw, descritivo)) { results.despesasSkipped++; continue; }

          if (tipo === "Entrada" || tipo.startsWith("Entrada")) {
            if (!isQuotaEntrada(catRaw)) continue;
            if (!subCat) { results.despesasSkipped++; continue; }

            const fracao = fracaoByNum.get(subCat);
            if (!fracao) {
              results.errors.push(`Fração '${subCat}' não encontrada (${dataStr} ${descritivo.slice(0, 40)})`);
              continue;
            }

            const catLow = catRaw.toLowerCase().trim();
            let qTipo: string = "condominio";
            if (catLow.includes("quota-extra") || catLow.includes("quota extra")) qTipo = "extra";
            else if (catLow.includes("obras")) qTipo = "obras";

            const qKey = `${fracao.id}|${mes}|${ano}|${qTipo}`;

            if (quotaKeys.has(qKey)) {
              // Will update
              quotasToUpdate.push({ fracaoId: fracao.id, mes, ano, tipo: qTipo, valor, data });
              quotaKeys.delete(qKey); // avoid double update
              results.quotasUpdated++;
            } else {
              quotaKeys.add(qKey);
              quotasToInsert.push({
                fracaoId: fracao.id,
                tipo: qTipo as "condominio" | "obras" | "extra" | "fundo_reserva",
                mes, ano, valor,
                fundoReserva: qTipo === "condominio" ? parseFloat((valor * 0.1).toFixed(2)) : 0,
                pago: true,
                dataPagamento: data,
                metodoPagamento: "transferência",
              });
              results.quotasCreated++;
            }

          } else if (tipo.startsWith("Sa") || tipo.startsWith("Saí")) {
            if (shouldSkipSaida(catRaw, descritivo)) { results.despesasSkipped++; continue; }

            const dKey = despesaKey(descritivo, valor, data);
            if (despesaKeys.has(dKey)) { results.despesasSkipped++; continue; }

            despesaKeys.add(dKey);
            despesasToInsert.push({
              descricao: descritivo,
              categoria: inferCat(catRaw, descritivo),
              valor,
              data,
              recorrente: false,
              fornecedorId: null,
              notas: null,
              faturaUrl: null,
              subcategoria: subCat || null,
            });
            results.despesasCreated++;
          }
        } catch (rowErr: any) {
          results.errors.push(`Erro na linha: ${rowErr.message}`);
        }
      }

      // ── Batch DB writes ───────────────────────────────────────────────────
      const BATCH_SIZE = 50;

      // Insert despesas in batches
      for (let i = 0; i < despesasToInsert.length; i += BATCH_SIZE) {
        await db.insert(schema.despesas).values(despesasToInsert.slice(i, i + BATCH_SIZE));
      }

      // Insert new quotas in batches
      for (let i = 0; i < quotasToInsert.length; i += BATCH_SIZE) {
        await db.insert(schema.quotas).values(quotasToInsert.slice(i, i + BATCH_SIZE));
      }

      // Update existing quotas (one by one, but these are few)
      for (const q of quotasToUpdate) {
        await db.update(schema.quotas)
          .set({ pago: true, valor: q.valor, dataPagamento: q.data, metodoPagamento: "transferência" })
          .where(
            and(
              eq(schema.quotas.fracaoId, q.fracaoId),
              eq(schema.quotas.mes, q.mes),
              eq(schema.quotas.ano, q.ano),
              eq(schema.quotas.tipo, q.tipo)
            )
          );
      }

      // Log the import
      await db.insert(schema.importLogs).values({
        filename,
        fileHash,
        status: results.errors.length === 0 ? "ok" : "partial",
        totalRows: results.totalRows,
        quotasCreated: results.quotasCreated,
        quotasUpdated: results.quotasUpdated,
        despesasCreated: results.despesasCreated,
        despesasSkipped: results.despesasSkipped,
        errorCount: results.errors.length,
        errors: JSON.stringify(results.errors),
      });

      return c.json({ ok: true, ...results });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  })

  // GET /api/import/logs — last 20 imports
  .get("/logs", requireAdmin, async (c) => {
    try {
      const logs = await db.select().from(schema.importLogs)
        .orderBy(desc(schema.importLogs.createdAt))
        .limit(20);
      return c.json({ logs });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });
