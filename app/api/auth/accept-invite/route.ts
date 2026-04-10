/**
 * GET  /api/auth/accept-invite?token=  — validate token, return invite info
 * POST /api/auth/accept-invite          — body: { token, firstName, lastName, password }
 *                                         creates user, marks invite accepted, logs in
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signToken, setAuthCookie } from "@/lib/auth";
import { writeAuditLog, getClientIp } from "@/lib/audit";
import { apiOk, apiError } from "A/lib/utils";
import { AuditAction } from "@prisma/client";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return apiError("Missing token", 400);

  const invite = await prisma.invitation.findUnique({
    where: { token },
    select: { id: true, email: true, role: true, status: true, expiresAt: true },
  });

  if (!invite)                       return apiError("Invitation not found", 404);
  if (invite.status !== "PENDING")   return apiError("Invitation has already been used or revoked", 400);
  if (invite.expiresAt < new Date()) return apiError("Invitation has expired", 400);

  return apiOk({ email: invite.email, role: invite.role });
}

const AcceptSchema = z.object({
  token:     z.string().min(1),
  firstName: z.string().min(1),
  lastName:  z.string().min(1),
  password:  z.string().min(8),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return apiError("Invalid JSON", 400); }

  const parsed = AcceptSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? "Validation error", 400);

  const invite = await prisma.invitation.findUnique({ where: { token: parsed.data.token } });
  if (!invite)                       return apiError("Invitation not found", 404);
  if (invite.status !== "PENDING")   return apiError("Invitation already used or revoked", 400);
  if (invite.expiresAt < new Date()) return apiError("Invitation expired", 400);

  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent");

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const [user] = await prisma.$transaction([
    prisma.user.create({
      data: {
        organizationId: invite.organizationId,
        email:          invite.email,
        passwordHash,
        firstName:      parsed.data.firstName,
        lastName:       parsed.data.lastName,
        role:           invite.role,
        isActive:       true,
        invitedBy:      invite.invitedById,
        lastLoginAt:    new Date(),
        lastLoginIp:    ip,
      },
    }),
    prisma.invitation.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    }),
  ]);

  const session = await prisma.session.create({
    data: {
      userId:    user.id,
      token:     crypto.randomUUID(),
      ipAddress: ip,
      userAgent: ua,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
    },
  });

  const jwtToken = await signToken({
    sub:         user.id,
    sessionId:   session.id,
    orgId:       user.organizationId,
    role:        user.role,
    email:       user.email,
    mfaVerified: false,
    mfaEnabled:  false,
  });
  setAuthCookie(jwtToken);

  await writeAuditLog({
    organizationId: user.organizationId,
    actorId: user.id,
    action: AuditAction.USER_CREATED,
    resourceType: "user",
    resourceId: user.id,
    metadata: { viaInvitation: true, invitationId: invite.id },
    ipAddress: ip,
    userAgent: ua,
  });

  return apiOk({
    user: { id: user.id, email: user.email, firstName: user.firstName, role: user.role },
  }, 201);
}
