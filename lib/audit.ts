/**
 * Audit Log helper.
 * Call `writeAuditLog(...)` from every API route handler that mutates state.
 */
import { prisma } from "@/lib/db";
import { AuditAction } from "@prisma/client";

export { AuditAction };

interface AuditParams {
  organizationId?: string | null;
  actorId?: string | null;
  targetUserId?: string | null;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function writeAuditLog(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: params.organizationId ?? null,
        actorId:        params.actorId        ?? null,
        targetUserId:   params.targetUserId   ?? null,
        action:         params.action,
        resourceType:   params.resourceType   ?? null,
        resourceId:     params.resourceId     ?? null,
        metadata:       params.metadata       ?? {},
        ipAddress:      params.ipAddress      ?? null,
        userAgent:      params.userAgent      ?? null,
      },
    });
  } catch (err) {
    // Audit failures must never crash the primary operation
    console.error("[audit] Failed to write audit log:", err);
  }
}

/** Extract client IP from Next.js request headers */
export function getClientIp(req: Request): string | null {
  const forwarded = (req.headers as Headers).get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return null;
}
