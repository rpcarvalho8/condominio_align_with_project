# Gestão de Condomínio

Aplicação web para gestão de condomínios. Nome a definir.

## Stack

- **Runtime**: Bun
- **Backend**: Hono (API REST em `/api/*`)
- **Frontend**: React + Vite + Tailwind CSS + Wouter (routing)
- **Base de dados**: Turso (LibSQL) via Drizzle ORM
- **Autenticação**: JWT + bcrypt

## Estrutura do Projeto

```
.env                         Variáveis de ambiente (gitignored)
packages/
  web/                       Servidor unificado (API + frontend)
    vite.config.ts           Config Vite 7
    index.html               Entry HTML
    src/
      api/
        index.ts             Rotas Hono (.basePath('/api'))
        database/
          schema.ts          Schema Drizzle
          index.ts           Cliente Turso
        routes/              Rotas por domínio
          quotas.ts          Quotas (mensais + extras)
          recibos.ts         Geração de recibos PDF
          bank.ts            Sincronização bancária
          fracoes.ts         Frações / proprietários
          despesas.ts        Despesas do condomínio
          fornecedores.ts    Fornecedores
          morosos.ts         Controlo de morosos
          relatorio.ts       Relatórios financeiros
          portal.ts          Portal do condómino
          ...
        lib/
          reconciliation-engine.ts  Motor de reconciliação bancária
          pdf-generator.ts          Gerador de recibos PDF
      web/
        pages/               Páginas da aplicação
        components/          Componentes reutilizáveis
        hooks/               React hooks
        lib/
          api.ts             Cliente API tipado (Hono client)
```

## Módulos Funcionais

| Módulo | Estado |
|--------|--------|
| Autenticação | ✅ |
| Frações & Proprietários | ✅ |
| Quotas mensais | ✅ |
| Quotas extra (elevadores, portão, incêndio) | ✅ |
| Recibos PDF | ✅ |
| Despesas | ✅ |
| Fornecedores | ✅ |
| Morosos | ✅ |
| Relatórios financeiros | ✅ |
| Portal do condómino | ✅ |
| Sincronização bancária (Banco CTT) | 🚧 |
| Importação de dados (Excel/CSV) | ✅ |

## Variáveis de Ambiente

Ficheiro `.env` na raiz do projecto (não commitado). Carregado via `loadEnv` do Vite.

```env
DATABASE_URL=libsql://...
DATABASE_AUTH_TOKEN=...
JWT_SECRET=...
```

No código API (Hono): `process.env.VAR`  
No browser (apenas vars com prefixo `VITE_`): `import.meta.env.VITE_VAR`

## Base de Dados

```sh
cd packages/web
bun run db:push        # Sincronizar schema com a DB
bun run db:generate    # Gerar ficheiros de migração
bun run db:migrate     # Correr migrações
bun run db:studio      # Abrir Drizzle Studio
```

## Dev

```sh
bun install            # Instalar dependências
bun run dev            # Iniciar servidor de desenvolvimento (porta 4200)
```

## Plano de Desenvolvimento

### Concluído
- [x] Schema da base de dados (frações, proprietários, quotas, despesas, recibos)
- [x] CRUD completo para todos os domínios
- [x] Geração automática de recibos PDF
- [x] Portal do condómino (acesso por fração)
- [x] Controlo de morosos
- [x] Relatórios financeiros
- [x] Importação de dados via Excel
- [x] Quotas extra (elevadores 2025/2026, portão garagem)

### Em curso
- [ ] **Sincronização bancária** — reconciliação automática de movimentos Banco CTT (erro 422 na API)
- [ ] **Quotas incêndio 2026** — inserir prestações da folha "6. Pagamento Incêndio"
- [ ] **Fix página /recibos** — black screen a diagnosticar

### Próximos passos
- [ ] **Nome da aplicação** — escolher identidade definitiva
- [ ] **Domínio próprio** — publicar em produção
- [ ] **Notificações automáticas** — email a condóminos (avisos, recibos)
- [ ] **Multi-condomínio** — suporte para gerir múltiplos condomínios
- [ ] **App mobile** — acesso condóminos via Expo/React Native
- [ ] **Orçamento anual** — módulo de planeamento e comparação com realizado
- [ ] **Actas de assembleias** — registo e gestão de reuniões
- [ ] **Seguros** — controlo de apólices e renovações

## Notas

- Os scripts `insert-*.mjs` e `regen-recibos-pdfs.mjs` em `packages/web/` são utilitários de manutenção de dados, não fazem parte do código de produção.
- PDFs de recibos gerados em `packages/web/data/recibos/`.
