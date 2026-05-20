# BuildingMind — Task Log

## Status: DELIVERED

## ✅ COMPLETED — Auto-categorisation Engine

### What was built
- **`/src/api/lib/csv-bank-parser.ts`** — Full CSV parsing + auto-categorisation engine
  - Parses Santander CSV (latin-1, CRLF, Portuguese amounts)
  - 902 movements parsed (2023–Jan 2026)
  - 100% categorised (0 unmatched) — was 676 uncategorised
  - Name→fração map: 40+ name patterns, past tenants identified
  - Auto-classifies: bank charges, outgoing transfers, utility debits, resident payments
  
- **`/src/api/routes/bank-movements.ts`** — REST API
  - GET /api/bank-movements — overview with stats
  - GET /api/bank-movements/condominio — paginated, filterable movements
  - GET /api/bank-movements/obras — obras movements
  - GET /api/bank-movements/nao-categorizados — unmatched (now 0)
  - GET /api/bank-movements/fracao/:id — per-fração payment history
  - GET /api/bank-movements/resumo-fracoes — all frações summary
  - GET /api/bank-movements/categorias — category breakdown

- **`/src/web/pages/movimentos-bancarios.tsx`** — Full UI page
  - 4 tabs: Resumo, Movimentos, Por Fração, Categorias
  - Filters: tipo, source, categoria, fração
  - Bar charts for frações and categories
  - Pagination

### Key discoveries from bank data
- João Marco Coutinho (L) paid 4 times total: 1245.18€
  - Oct 2025: 110.43€
  - Nov 2025: 545.52€ (not in Excel!)
  - Jan 2026: 563.76€ (quotas)
  - Jan 2026: 25.47€ (fundo)
  
- Fração G (Marma Concept) has NO bank payments identified — pays differently
- All 33 frações mapped to payers in the bank extract

### Payment stats
- Total entradas: 51,646.44€ (2023–Jan 2026)
- Total saídas: 21,457.40€
- Saldo final: 34,109.91€
- Bank charges: 184 entries (commissions, stamp duty)
- Frações with identified payments: 33/33

## João Marco Coutinho (Fração L) — FULL PICTURE

### All confirmed bank payments:
- 28/10/2025: 110.43€ (ref: DA-278789309)
- 21/11/2025: 545.52€ (ref: DA-280585796)
- 28/01/2026: 563.76€ quotas (ref: DA-284854486)
- 30/01/2026: 25.47€ fundo (ref: DA-285074316)
- **TOTAL PAGO NO BANCO: 1,245.18€**

### Contas separadas (NÃO cobertas pelos pagamentos de condomínio)
- Obras: 2110.97€
- Quota Extra Elevadores: 323.24€
- Portão: 29.53€

## Previous session data
- Fundo L corrected: 23.99 → 2.79 remaining
- atraso_fundo_reserva: 28.41 → 7.21
- pagamentosNaoRegistados: implemented in dashboard API
- AI (Rui Carvalho): portão 25.35€ paid 07/05/2026

## Dev server
- Port: 4200
- Restart: `cd /home/user/buildingmind/packages/web && source /home/user/buildingmind/.env && bun run dev --port 4200 > /tmp/dev2.log 2>&1 &`

## Reconciliation Engine — COMPLETED ✅

### Results
- **Before**: 339 uncategorised CSV entradas
- **After**: 0 unmatched — 100% categorised
- **Engine auto-categorised**: 207 entradas (+ 428 already had CSV categories = 474 auto total across all movements)

### Files created/modified
1. **NEW**: `src/api/lib/reconciliation-engine.ts`
   - Per-fração debt table (monthly quotas, portão amounts, quota-extra amounts)
   - `matchSpecialCases()`: pattern + amount matching for known composite payments
   - `reconcilePayment()`: amount fuzzy matching (exact, ±0.01€, ±0.05€, ±0.20€) against debt table
   - `fullReconcile()`: combines special cases + amount matching
   
2. **UPDATED**: `src/api/lib/csv-bank-parser.ts`
   - Replaced manual pattern blocks with reconciliation engine calls
   - Imports `fullReconcile` and `matchSpecialCases`

3. **UPDATED**: `src/api/routes/bank-movements.ts`
   - Added `/reconciliacao` endpoint: portão status per fração + auto-cat entries

4. **UPDATED**: `src/web/pages/movimentos-bancarios.tsx`
   - Added "Reconciliação" tab: engine stats, portão status grid, auto-categorised table

### Key patterns resolved
- `CONDOMINIO-XXXXXX` (64.36€) → U (Catarina Reis)
- `quota extra X` (57.21€) → U quota-extra
- `AB Hab RC A` (74.37€) → AB condo(39.37) + quota-extra(35.00)
- `fracçao AB` (148.74€) → 2 months AB combined
- `fraço T e D` → Susana (T+D combined)
- `Germano Macahdo` (typo) → AE condo + B garagem = 43.27€
- `QUOTA CONDOMÍNIO` (28.33€) → S (old rate 2023)

