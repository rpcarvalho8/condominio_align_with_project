import { Hono } from "hono";
import { db } from "../database";
import { user as userTable, fracoes } from "../database/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { auth } from "../auth";

export const adminUsers = new Hono()
  .use(requireAdmin)
  // List all users (condóminos + admins)
  .get("/", async (c) => {
    const users = await db.select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      role: userTable.role,
      fracaoId: userTable.fracaoId,
      createdAt: userTable.createdAt,
    }).from(userTable).orderBy(userTable.name);
    return c.json(users);
  })
  // Create condómino user (admin only)
  .post("/", async (c) => {
    const body = await c.req.json();
    // Use Better Auth to create the user
    const result = await auth.api.signUpEmail({
      body: {
        email: body.email,
        password: body.password,
        name: body.name,
      },
      headers: c.req.raw.headers,
    });
    if (!result?.user) return c.json({ message: "Erro ao criar utilizador" }, 400);

    // Set role and fracaoId
    await db.update(userTable)
      .set({ role: body.role ?? "condómino", fracaoId: body.fracaoId ?? null })
      .where(eq(userTable.id, result.user.id));

    return c.json({ ok: true, userId: result.user.id }, 201);
  })
  // Update user (role, fracaoId)
  .put("/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const [updated] = await db.update(userTable)
      .set({
        name: body.name,
        role: body.role,
        fracaoId: body.fracaoId ?? null,
      })
      .where(eq(userTable.id, id))
      .returning();
    return c.json(updated);
  })
  // Delete user
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    await db.delete(userTable).where(eq(userTable.id, id));
    return c.json({ ok: true });
  });
