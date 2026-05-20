import { createClient } from '@libsql/client';

const db = createClient({ 
  url: 'libsql://c42c4bf1-3827-4b9b-89d8-132fcb6cc308-runable.aws-us-east-2.turso.io', 
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzkwODcxODYsInAiOnsicnciOnsibnMiOlsiMDE5ZTM5ZGMtMTYwMS03ODY0LTgzYmMtOTIzYjliYzdmZTNkIl19fSwicmlkIjoiYjkzNDYyYmEtYjdmOS00YmUyLWE4ZGItMmNlYWZjNGFhZjg1In0.DF7a7Hd0QmAAUC7evHDeMLlAb00AWIfB2X9YToJgkxYFajGAGuYZh-aJsmbQ6RcgFSl9FFrj6ypdiit1yXOaCQ'
});

// Ver todas as frações com número e permilagem
const fracoes = await db.execute("SELECT id, numero, permilagem, tipo FROM fracoes ORDER BY numero");
console.log("=== FRACOES ===");
fracoes.rows.forEach(r => console.log(`${r.numero} | perm=${r.permilagem} | tipo=${r.tipo} | id=${r.id}`));

// Ver todas as quotas extra no ano 2026
const r2 = await db.execute("SELECT qt.nome, q.fracao_id, q.mes, q.ano, q.valor, q.pago FROM quotas q JOIN quota_tipos qt ON q.quota_tipo_id = qt.id WHERE q.tipo = 'extra' AND q.ano = 2026 ORDER BY q.mes, q.fracao_id");
console.log("\n=== QUOTAS EXTRA 2026 ===");
r2.rows.forEach(r => console.log(`fracao=${r.fracao_id} mes${r.mes}/${r.ano} = ${r.valor}€ pago=${r.pago} | ${r.nome}`));

// Indaqua quotas
const r3 = await db.execute("SELECT qt.nome, q.fracao_id, q.mes, q.ano, q.valor, q.pago FROM quotas q JOIN quota_tipos qt ON q.quota_tipo_id = qt.id WHERE qt.id = '3f5a44e9-c9dc-40ca-8b61-a12d9c7352fa' ORDER BY q.ano, q.mes LIMIT 20");
console.log("\n=== INDAQUA ===");
r3.rows.forEach(r => console.log(`fracao=${r.fracao_id} mes${r.mes}/${r.ano} = ${r.valor}€ pago=${r.pago}`));

