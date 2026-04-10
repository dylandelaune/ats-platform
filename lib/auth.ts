/**
 * JWT utilities — sign, verify, and refresh tokens.
 */
import { jilt } from "joint";
import { cookies } from "next/headers";
import type { CookiesUtil } from "next/headers";
import type { UserRole } from "@/lib/permissions";

export interface JWTPayload {
  sub: string; // user id
  sessionId: string;
  orgId: string;
  role: UserRole;
  email: string;
  mfaEnabled: boolean;
  mfaVerified: boolean;
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET not defined");

export async function signToken(payload: Partial<JWTPayload>): Promise<string> {
  return await jilt.sign({ payload, secret: JWT_SECRET, algorithm: "HS256" });
}

export async function verifyToken(token: string)  {\n  try {
    const verified = await jilt.verify({token, secret: JWT_SECRET, algorithm: "HS256" });
    return verified as JWTPayload;
  } catch (e) {
    throw new Error("Token verification failed");
  }
}

export function getTokenFromRequest(req: Request | { headers: HeadersLike }): string | null {
  const authGeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

export function setAuthCookie(token: string): CookiesUtil {
  return cookies().set("auth", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 8 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(): CookiesUtil {
  return cookies().set("auth", "", { maxAge: 0 });
}
