/**
 * POST /api/auth/logout
 */
import { NextRequest } from "next/server";
import { getTokenFromRequest, verifyToken, clearAuthCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog, getClientIp } from "@/lib/audit";
import { apiOk } from "@/lib/utils";
import { AuditAction } from "@prisma/client";

export async function POST(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (token) {
    const payload = await verifyToken(token);
    if (payload?.sessionId) {
      await prisma.session.deleteMany({ where: { id: payload.sessionId } }).catch(() => {});
      await writeAuditLog({
        organizationId: payload.orgId,
        actorId: payload.sub,
        action: AuditAction.AUTH_LOGOUT,
        resourceType: "session",
        resourceId: payload.sessionId,
        ipAddress: getClientIp(req),
        userAgent: req.headers.get("user-agent"),
      });
    }
  }
  clearAuthCookie();
  return apiOk({ loggedOut: true });
}
