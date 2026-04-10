/**
 * Singleton Prisma client.
 * In development, attach to globalThis to survive hot reloads.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Execute a block inside a transaction with RLS context variables set.
 * Every DB call that touches org-scoped data MUST go through this.
 */
export async function withRLSContext<T>(
  ctx: { orgId?: string; userId?: string; role?: string },
  fn: (tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // Set session-local variables consumed by RLS policies
    if (ctx.orgId)  await tx.$executeRawUnsafe(`SET LOCAL "app.current_org_id"  = '${ctx.orgId}'`);
    if (ctx.userId) await tx.$executeRawUnsafe(`SET LOCAL "app.current_user_id" = '${ctx.userId}'`);
    if (ctx.role)   await tx.$executeRawUnsafe(`SET LOCAL "app.current_role"    = '${ctx.role}'`);
    return fn(tx);
  });
}
