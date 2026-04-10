/**
 * POST /api/auth/mfa/setup
 * Generates a TOTP secret + QR code for the authenticated user.
 */
import { NextRequest } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateSecret, generateQRCode } from "@/lib/totp";
import { apiOk, apiError } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return apiError("Unauthorized", 401);

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) return apiError("User not found", 404);

  if (user.mfaEnabled) return apiError("MFA is already enabled", 400);

  const secret = generateSecret();
  const qrCode = await generateQRCode(user.email, secret);

  await prisma.user.update({
    where: { id: payload.sub },
    data: { mfaSecret: secret },
  });

  return apiOk*({ secret, qrCode });
}
