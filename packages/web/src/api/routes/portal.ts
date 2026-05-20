import { Hono } from "hono";
import { db } from "../database";
import { fracoes, quotas, recibos } from "../database/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

export const portal = new Hono()
  .use(requireAuth)
  // Own fração info + quotas
  .get("/minha-fracao", async (c) => {
    const user = c.get("user") as any;
    if (!user.fracaoId) return c.json({ message: "Sem fração associada" }, 404);

    const [fracao] = await db.select().from(fracoes).where(eq(fracoes.id, user.fracaoId));
    if (!fracao) return c.json({ message: "Fração não encontrada" }, 404);

    // Get all quotas for this fração
    const minhasQuotas = await db.select().from(quotas)
      .where(eq(quotas.fracaoId, user.fracaoId))
      .orderBy(desc(quotas.ano), desc(quotas.mes));

    // Get recibos
    const meusRecibos = await db.select().from(recibos)
      .where(eq(recibos.fracaoId, user.fracaoId))
      .orderBy(desc(recibos.createdAt));

    // Summary
    const totalDívida = minhasQuotas
      .filter(q => !q.pago)
      .reduce((sum, q) => sum + q.valor, 0);

    const totalPago = minhasQuotas
      .filter(q => q.pago)
      .reduce((sum, q) => sum + q.valor, 0);

    return c.json({
      fracao: {
        id: fracao.id,
        numero: fracao.numero,
        andar: fracao.andar,
        proprietarioNome: fracao.proprietarioNome,
        proprietarioEmail: fracao.proprietarioEmail,
        proprietarioTelefone: fracao.proprietarioTelefone,
        quotaMensal: fracao.quotaMensal,
        permilagem: fracao.permilagem,
      },
      quotas: minhasQuotas,
      recibos: meusRecibos,
      resumo: {
        totalDívida,
        totalPago,
        quotasPendentes: minhasQuotas.filter(q => !q.pago).length,
        quotasPagas: minhasQuotas.filter(q => q.pago).length,
      },
    });
  });
