import crypto from "crypto";

export interface TokenPayload {
  id: string;
  displayName: string;
}

const secret = (): string => process.env.AUTH_SECRET || "dev-only-insecure-secret";

const base64url = (input: Buffer | string): string =>
  Buffer.from(input).toString("base64url");

const sign = (body: string): string =>
  crypto.createHmac("sha256", secret()).update(body).digest("base64url");

export const createToken = (payload: TokenPayload): string => {
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
};

export const verifyToken = (token: string): TokenPayload | null => {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as TokenPayload;
    if (!parsed.id || !parsed.displayName) return null;
    return parsed;
  } catch {
    return null;
  }
};
