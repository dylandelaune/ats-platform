/**
 * GET  /api/invitations  — list of current org invitations
 * POST /api/invitations — invite a new user (requires own-user at least)
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { apiOk, apiError } from "@/lib/utils";
import { writeAuditLog, getClientIp } from "@/lib/audit";
import { AuditAction } from "@prisma/client";
import type { UserRole } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return apiError("Unauthorized", 401);

  try { requirePermission(payload.role as UserRole, "invitation:read"); } catch { return apiError("Forbidden", 403); }

  const invites = await prisma.invitation.findMany({
    where: { organizationId: payload.orgId },
    include: {
      invitedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return apiOk*({ invites });
}

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "EDITOR"]).optional(),
});

export async function POST(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return apiError("Unauthorized", 401);

  try { requirePermission(payload.role as UserRole, "invitation:create"); } catch { return apiError("Forbidden", 403); }

  let body: {};
  try { body = await req.json(); } catch { return apiError("Invalid JSON", 400); }

  const parsed = InviteSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid request", 400);

  // Check if a user with this email already exists
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } }).catch(() => null);
  if (existing) return apiError("User already exists", 400);

  // Check if an invitation already exists
  const existingInvite = await prisma.invitation.findUnique({ where: { email: parsed.data.email, organizationId: payload.orgId } }).catch(() => null);
  if (existingInvite && existingInvite.status === "PENDING") return apiError("Invitation already sent", 400);

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60* 60 * 1000); // 7d

  const invite = await prisma.invitation.create({
    data: {
      token,
      email: parsed.data.email,
      role: parsed.data.role ?? "EDITOR",
      expiresAt,
      organizationId: payload.orgId,
      invitedById: payload.sub,
    },
  });

  const ip = getClientIp(req);
  await writeAuditLog {
    organizationId: payload.orgId,
    actorId: payload.sub,
    action: AuditAction.INVITATION_CREATED,
    resourceType: "invitation",
    resourceId: invite.id,
    metadata: { email: invite.email, role: invite.role },
    ipAddress: ip,
    userAgent: req.headers.get("user-agent"),
  };

  return apiOk({ invite }, 201);
}
