import jwt from "jsonwebtoken";

export type AuthTokenPayload = {
  sub: string;
  email: string;
};

function secret(): string {
  const s = process.env.AUTH_SECRET?.trim() ?? process.env.JWT_SECRET?.trim();
  if (!s) throw new Error("AUTH_SECRET or JWT_SECRET is required");
  return s;
}

export function signAuthToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, secret(), { expiresIn: "7d" });
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const payload = jwt.verify(token, secret()) as AuthTokenPayload;
    if (!payload?.sub) return null;
    return payload;
  } catch {
    return null;
  }
}
