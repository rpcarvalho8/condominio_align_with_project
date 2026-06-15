# Task: Fix dívidas Dashboard — Excel Truth

## Dados reais do Excel (Valores_Condomínio_GsTnMD.xlsx)
| FR | Nome | obras | incendio | indaqua | motor |
|----|------|-------|---------|---------|-------|
| L  | João Marco Coutinho | 2110.97 | 0.00 | 250.56 | 29.53 |
| M  | Jannara Maria Santos | 108.85 | 0.00 | 0.00 | 0.00 |
| N  | Filipe Daniel Teixeira | 178.63 | 0.00 | 33.78 | 0.00 |
| X  | Alexandre Ribeiro Maia | 278.30 | 0.00 | 0.00 | 27.67 |
| AG | João Pedro Amorim Dias | 284.27 | 0.00 | 0.00 | 25.04 |
| AC | Maria Fátima Ascenção | 607.35 | 0.00 | 0.00 | 0.00 |
| AD | Escutoglamour | 629.51 | 49.40 | 0.00 | 0.00 |
| G  | Marma Concept | 1160.63 | 60.72 | 23.87 | 16.24 |

## Totais reais
- obras_divida:    5358.51
- incendio_divida:  110.12
- indaqua_divida:   308.21
- motor_divida:      98.48
- TOTAL:           5875.32

## Problemas
1. seed-dividas.ts lê identity-matrix.ts (stale) em vez do Excel
2. dashboard.ts tem OBRAS_DEVEDORES_EXCEL hardcoded com valores errados (AG=581.86 devia ser 284.27)
3. obras usa quotas table (vazia) com fallback stale
4. motor não tem secção própria no dashboard
5. indaqua/incendio hardcoded com listas antigas

## Plano
- [x] Ler Excel e confirmar dados
- [ ] Reescrever seed-dividas.ts para ler xlsx diretamente
- [ ] Atualizar OBRAS/INCENDIO constantes no dashboard.ts com dados reais
- [ ] Adicionar lógica de motor como gaveta separada
- [ ] Fazer seed + recalcular
- [ ] tsc --noEmit
- [ ] commit + push
