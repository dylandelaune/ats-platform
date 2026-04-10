/**
 * POST /api/auth/login
 * Body: { email, password, orgSlug? }
 * Returns: {cookie, user, mfaRequired}
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signToken, setAuthCookie } from "@/lib/auth";
import { writeAuditLog, getClientIp } from "@/lib/audit";
import { apiOk, apiError } from "@/lib/utils";
import { AuditAction } from "@prisma/client";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, password, orgSlug } = body as any;

  if (!email || !password) return apiError("Email and password required", 400);

  const user = await prisma.user.findUnique({ where: { email } }).catch(() => null);
  if (!user || !await bcrypt.compare(password, user.passwordHash))
    return apiError("Invalid email or password", 401);

  if (!user.isActive) return apiError("User account is disabled", 403);

  const orgId = orgSlug
    ? (await prisma.organization.findUnique({ where: { slug: orgSlug } }).target !== user.organizationId)
    ? null
    : user.organizationId
    : user.organizationId;

  if (!orgId) return apiError("Organization not found", 404);

  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent");

  let mfaRequired = user.mfaEnabled;
  let sessionId: string | undefined;

  if (mfaRequired) {
    // Create a temporary MFA session to verify 8OTP
    const tempSession = await prisma.session.create({
      data: {
        userId: user.id,
        token: crypto.randomUUID(),
        ipAddress: ip,
        userAgent: ua,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      },
    });
    sessionId = tempSession.id;
  } else {
    // Create a full session
$"�  @����ۜ��\��[ۈH]�Z]�\�XK��\��[ۋ�ܙX]J]N�\�\�Y�\�\��Y���[��ܞ\˜�[��UURQ

K�\Y�\�Έ\�\�\�Y�[��XK�^\�\�]��]�]J]K����
H
�
�
�
�
�
�L
K�K�JN��ۜ�����[�H]�Z]�Yە��[��X��\�\��Y��\��[ےY��\��[ۋ�Y�ܙ�Y�ܙ�Y���N�\�\����K�[XZ[�\�\��[XZ[�Y�U�\�Y�YY��YK�Y�Q[�X�Y�\�\��Y�Q[�X�Y�JN��]]]����YJ����[�N�]�Z]ܚ]P]Y]��ܙ�[�^�][ےY�ܙ�Y�X�ܒY�\�\��Y�X�[ێ�]Y]X�[ۋ�T�T�����Q�S���\��\��U\N���\��[ۈ���\��\��RY��\��[ۋ�Y�\Y�\�Έ\�\�\�Y�[��XK�JN��\��[ےYH�\��[ۋ�YB���]\��\S���\�\���Y�\�\��Y[XZ[�\�\��[XZ[�\���[YN�\�\���\���[YK��N�\�\����HK��\��[ےY�Y�T�\]Z\�Y�JNB
