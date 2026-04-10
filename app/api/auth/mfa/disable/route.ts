/**
 * POST /api/auth/mfa/disable
 * Body: { userId?: string, code: string }
 * - Own user: requires valid TOTP code
 * - Super Admin: can disable any user's MFA (no code required, forced)
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { verifyTOTP, decryptSecret } from "@/lib/totp";
import { prisma } from "@/lib/db";
import { writeAuditLog, getClientIp } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { apiOk, apiError } from "@/lib/utils";
import { AuditAction } from "@prisma/client";
import type { UserRole } from "@/lib/permissions";

const Schema = z.object({
  userId: z.string().optional(),
  code:   z.string().optional(),
});

export async function POST(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const jwtPayload = token ? await verifyToken(token) : null;
  if (!jwtPayload) return apiError("Unauthorized", 401);

  let body: unknown;
  try { body = await req.json(); } catch { return apiError("Invalid JSON", 400); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) return apiError("Invalid request", 400);

  const targetId = parsed.data.userId ?? jwtPayload.sub;
  const isSelf   = targetId === jwtPayload.sub;

  // Permission check
  if (!isSelf) {
    try {
      requirePermission(jwtPayload.role as UserRole, "mfa:disable_any");
    } catch {
      return apiError("Forbidden", 403);
    }
  }

  const user = await prisma.user.findUnique({ where: { id: targetId } });
  if (!user) return apiError("User not found", 404);
  if (!user.mfaEnabled) return apiError("MFA is not enabled", 400);

  // Self-disable requires valid TOTP
  if (isSelf) {
    if (!parsed.data.code) return apiError("TOTP code required", 400);
    const secret = await decryptSecret(user.mfaSecret!);
    if (!verifyTOTP(parsed.data.code, secret)) return apiError("Invalid code", 401);
  }

  await prisma.user.update({
    where: { id: targetId },
    data: { mfaEnabled: false, mfaSecret: null, mfaVerifiedAt: null },
  });

  const ip = getClientIp(req);
  await writeAuditLog({
    organizationId: user.organizationId,
    actorId: jwtPayload.sub,
    targetUserId: targetId,
    action: AuditAction.AUTH_MFA_DISABLED,
    resourceType: "user",
    resourceId: targetId,
    metadata: { forcedByAdmin: !isSelf },
    ipAddress: ip,
    userAgent: req.headers.get("user-agent"),
  });

  return apiOk({ mfaDisabled: true });
}
