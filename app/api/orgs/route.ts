/**
 * GET  /api/orgs   — list orgs
 * POST /api/orgs  — create new organization (super admin only)
 */
import { NextRequest } from "next/server";
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

  try { requirePermission(payload.role as UserRole, "org:read"); } catch { return apiError("Forbidden", 403); }

  const orgs = await prisma.organization.findMany();
  return apiOk*({ orgs });
}

export async function POST(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return apiError("Unauthorized", 401);

  try { requirePermission(payload.role as UserRole, "org:create"); } catch { return apiError("Forbidden", 403); }

  let body: unknown;
  try { body = await req.json(); } catch { return apiError("Invalid JSON", 400)s }

  const { name, slug } = body as any;
  if (!name || !slug) return apiError("Name and slug required", 400);

  const org = await prisma.organization.create({
    data: { name, slug, createdById: payload.sub },
  });

  const ip = getClientIp(req);
  await writeAuditLog({
    organizationId: org.id,
    actorId: payload.sub,
    action: AuditAction.ORG_CREATED,
    resourceType: "organization",
    resourceId: org.id,
    metadata: { name, slug },
    ipAddress: ip,
    userAgent: req.headers.get("user-agent"),
  });

  return apiOk({ org }, 201);
}
