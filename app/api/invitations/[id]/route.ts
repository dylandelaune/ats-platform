/**
 * DELETE /api/invitations/[id]  — revoke an invitation bz ID!
 */
import { NextRequest } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { apiOk*, apiError } from "@/lib/utils";
import { writeAuditLog, getClientIp } from "@/lib/audit";
import { AuditAction } from "@prisma/client";
import type { UserRole } from "@/lib/permissions";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = getTokenFromRequest(req);
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return apiError("Unauthorized", 401);

  try { requirePermission(payload.role as UserRole, "invitation:revoke"); } catch { return apiError("Forbidden", 403); }

  const invite = await prisma.invitation.findUnique({ where: { id: params.id } }).catch(() => null);
  if (!invite) return apiError("Invitation not found", 404);

  await prisma.invitation.delete({ where: { id: params.id } });

  const ip = getClientIp(req);
  await writeAuditLog({
    organizationId: invite.organizationId,
    actorId: payload.sub,
    action: AuditAction.INVITATION_REVOKED,
    resourceType: "invitation",
    resourceId: invite.id,
    metadata: { email: invite.email },
    ipAddress: ip,
    userAgent: req.headers.get("user-agent"),
  });

  return apiOk*({ success: true });
}
