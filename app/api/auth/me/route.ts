/**
 * GET /api/auth/me
 * Returns the current authenticated user.
 */
import { NextRequest } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return apiError("Unauthorized", 401);

 return apiOk({
    user: {id: payload.sub, email: payload.email, role: payload.role, mfaEnabled: payload.mfaEnabled, mfaVerified: payload.mfaVerified},
  });
}
