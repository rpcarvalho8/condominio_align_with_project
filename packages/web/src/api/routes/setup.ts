import { Hono } from "hono";
import { db } from "../database";
import { user as userTable } from "../database/schema";
import { sql } from "drizzle-orm";
import { auth } from "../auth";

export const setup = new Hono()
  // Create first admin — only works if zero users exist
  .post("/first-admin", async (c) => {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userTable);

    if (count > 0) {
      return c.json({ message: "Já existem utilizadores. Use o painel de admin." }, 403);
    }

    const body = await c.req.json();
    if (!body.email || !body.password || !body.name) {
      return c.json({ message: "name, email e password são obrigatórios" }, 400);
    }

    const result = await auth.api.signUpEmail({
      body: { email: body.email, password: body.password, name: body.name },
      headers: c.req.raw.headers,
    });

    if (!result?.user) return c.json({ message: "Erro ao criar admin" }, 500);

    // Set role to admin
    const { eq } = await import("drizzle-orm");
    await db.update(userTable)
      .set({ role: "admin" })
      .where(eq(userTable.id, result.user.id));

    return c.json({ ok: true, message: "Admin criado com sucesso" }, 201);
  })
  // Check setup status
  .get("/status", async (c) => {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userTable);
    return c.json({ hasUsers: count > 0, userCount: count });
  });
