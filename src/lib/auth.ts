import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
export const sessionCookie = "dolaznost_session";
export const sessionSeconds = 60 * 60 * 24 * 7;
export function authRequired() {
  return Boolean(process.env.APP_PASSWORD) || process.env.VERCEL === "1";
}
export function passwordConfigured() {
  return Boolean(
    process.env.APP_PASSWORD && process.env.APP_PASSWORD.length >= 16,
  );
}
function key() {
  return createHash("sha256")
    .update("dolaznost-session:" + process.env.APP_PASSWORD)
    .digest();
}
function sign(payload: string) {
  return createHmac("sha256", key()).update(payload).digest("hex");
}
export function passwordMatches(input: string) {
  if (!passwordConfigured()) return false;
  return timingSafeEqual(
    createHash("sha256").update(input).digest(),
    createHash("sha256").update(process.env.APP_PASSWORD!).digest(),
  );
}
export function createSession(now = Date.now()) {
  if (!passwordConfigured())
    throw new Error("Postavite APP_PASSWORD s najmanje 16 znakova.");
  const payload = `${Math.floor(now / 1000) + sessionSeconds}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${sign(payload)}`;
}
export function validSession(token: string | undefined, now = Date.now()) {
  if (
    !passwordConfigured() ||
    !token ||
    !/^\d{10}\.[0-9a-f]{32}\.[0-9a-f]{64}$/.test(token)
  )
    return false;
  const [expiry, nonce, signature] = token.split(".");
  const expires = Number(expiry),
    seconds = Math.floor(now / 1000);
  if (expires <= seconds || expires > seconds + sessionSeconds) return false;
  return timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(sign(`${expiry}.${nonce}`), "hex"),
  );
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return (
      new URL(origin).host ===
      (request.headers.get("x-forwarded-host") ??
        request.headers.get("host") ??
        new URL(request.url).host)
    );
  } catch {
    return false;
  }
}
// Next može normalizirati loopback/internalni host; povratnu adresu gradimo iz izvornog HTTP hosta.
export function publicUrl(path: string, request: Request) {
  const original = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    original.host;
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  const protocol =
    forwardedProtocol === "https" || forwardedProtocol === "http"
      ? forwardedProtocol
      : original.protocol.slice(0, -1);
  return new URL(path, `${protocol}://${host}`);
}
