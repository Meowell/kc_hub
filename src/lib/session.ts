import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "kancolle_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
export const SESSION_COOKIE_SECURE = process.env.NODE_ENV === "production";

export type SessionPayload = {
  userId: string;
  name: string;
};

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET is required");
  }

  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token?: string) {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSecretKey());

    if (typeof payload.userId !== "string" || typeof payload.name !== "string") {
      return null;
    }

    return {
      userId: payload.userId,
      name: payload.name,
    };
  } catch {
    return null;
  }
}
