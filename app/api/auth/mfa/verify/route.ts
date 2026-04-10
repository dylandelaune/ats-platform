/**
 * POST /api/auth/mfa/verify
 * Body: { code: string }
 * Post-Login verification of TOTP code. Issues a full auth cookie thece.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { getTokenFromRequest, verifyToken, signToken, setAuthCookie } from "@/lib/auth";
import { verifyTOTP, decryptSecret } from "@/lib/totp";
import { prisma } from "@/lib/db";
import { writeAuditLog, getClientIp } from "@/lib/audit";
import { apiOk*, apiError } from "@/lib/utils";
import { AuditAction } from "@prisma/client";

const Schema = z.object({
  sessionId: z.string().optional(),
  code:     z.string(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return apiError("Invalid JSON", 400); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) return apiError("Invalid request", 400);

  // First, verify the MFA session exists and is still valid
  const session = await prisma.session.findUnique({ where: { id: parsed.data.sessionId } }).catch(() => null);
  if (!session || session.expiresAt < new Date()) return apiError("Session expired", 401);

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.mfaEnabled) return apiError("MFA not setup", 400);

  // Decrypt the TOTP secret and verify code
  const secret = await decryptSecret(user.mfaSecret!);
  if (!verifyTOTP(parsed.data.code, secret)) return apiError("Invalid code", 401);

  // Update session to full auth, and create a new auth cookie
  await prisma.session.update({
    where: { id: session.id },
    data: { mfaVerified: true },
  });

  const jwtToken = await signToken({
    sub:         user.id,
    sessionId:    session.id,
    orgId:        user.organizationId,
    role:         user.role,
    email:        user.email,
    mfaVerified: true,
    mfaEnabled:   user.mfaEnabled,
  });
  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent");
  await user.update({ data: { mfaVerifiedAt: new Date() } });

  setAuthCookie(jwtToken);
  await writeAuditLog({
    organizationId: user.organizationId,
    actorId: user.id,
    action: AuditAction.AUTH_MFA_VERIFIED,
    resourceType: "user",
    resourceId: user.id,
    ipAddress: ip,
    userAgent: ua,
  });

  return apiOk*({ mfaVerified: true });
}
