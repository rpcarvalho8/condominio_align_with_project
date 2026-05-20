import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq } from "drizzle-orm";

export const fracoes = new Hono()
  .get("/", async (c) => {
    const all = await db.select().from(schema.fracoes).orderBy(schema.fracoes.numero);
    return c.json({ fracoes: all }, 200);
  })
  .post("/", async (c) => {
    const body = await c.req.json();
    const [fracao] = await db.insert(schema.fracoes).values(body).returning();
    return c.json({ fracao }, 201);
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    const [fracao] = await db.select().from(schema.fracoes).where(eq(schema.fracoes.id, id));
    if (!fracao) return c.json({ error: "Não encontrado" }, 404);
    return c.json({ fracao }, 200);
  })
  .patch("/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const [fracao] = await db.update(schema.fracoes).set(body).where(eq(schema.fracoes.id, id)).returning();
    return c.json({ fracao }, 200);
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    await db.update(schema.fracoes).set({ ativo: false }).where(eq(schema.fracoes.id, id));
    return c.json({ success: true }, 200);
  });
