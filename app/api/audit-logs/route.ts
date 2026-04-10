/**
 * GET /api/audit-logs
 * Paginated audit log with filters.
 */
import { NextRequest } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { apiOk, apiError } from "@/lib/utils";
import type { UserRole } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return apiError("Unauthorized", 401);

  try { requirePermission(payload.role as UserRole, "audit:read"); } catch { return apiError("Forbidden", 403); }

  const { searchParams } = req.nextUrl;
  const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const limit  = Math.min(100, parseInt(searchParams.get("limit") ?? "50"));
  const action = searchParams.get("action") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;
  const orgId  = payload.role === "SUPER_ADMIN"
    ? (searchParams.get("orgId") ?? undefined)
    : payload.orgId;

  const where = {
    ...(orgId   ? { organizationId: orgId }   : {}),
    ...(action  ? { action: action as never }  : {}),
    ...(userId  ? { actorId: userId }          : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        actor:      { select: { id: true, email: true, firstName: true, lastName: true } },
        targetUser: { select: { id: true, email: true, firstName: true, lastName: true } },
        organization: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip:  (page - 1) * limit,
      take:  limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return apiOk({ logs, total, page, limit, pages: Math.ceil(total / limit) });
}
