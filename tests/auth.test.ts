import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  authRequired,
  createSession,
  passwordMatches,
  validSession,
  sessionSeconds,
  sameOrigin,
  publicUrl,
} from "../src/lib/auth";
import { requireSession } from "../src/lib/access";
import { POST as login } from "../src/app/api/auth/login/route";
import { POST as logout } from "../src/app/api/auth/logout/route";
afterEach(() => vi.unstubAllEnvs());
const password = "test-only-long-password-2026";
describe("Zaštita osobne evidencije za Vercel", () => {
  it("povratna adresa zadržava javni host iza posrednika", () => {
    expect(
      publicUrl(
        "/",
        new Request("http://localhost:3100/api/auth/login", {
          headers: { host: "127.0.0.1:3100" },
        }),
      ).href,
    ).toBe("http://127.0.0.1:3100/");
    expect(
      publicUrl(
        "/",
        new Request("http://localhost:3000/api/auth/login", {
          headers: {
            "x-forwarded-host": "izostanci.example",
            "x-forwarded-proto": "https",
          },
        }),
      ).href,
    ).toBe("https://izostanci.example/");
  });
  it("Vercel zatvara pristup bez postavljene lozinke", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("APP_PASSWORD", "");
    expect(authRequired()).toBe(true);
    expect(
      requireSession(new NextRequest("https://app.example/api/data"))?.status,
    ).toBe(503);
  });
  it("lokalni rad bez lozinke ostaje dostupan", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("APP_PASSWORD", "");
    expect(authRequired()).toBe(false);
    expect(
      requireSession(new NextRequest("http://localhost:3000/api/data")),
    ).toBeNull();
  });
  it("provjerava lozinku, potpis i istek sesije te promjenu lozinke", () => {
    vi.stubEnv("APP_PASSWORD", password);
    expect(passwordMatches("pogrešno")).toBe(false);
    expect(passwordMatches(password)).toBe(true);
    const now = Date.now();
    const token = createSession(now);
    expect(validSession(token, now)).toBe(true);
    expect(validSession(token, now + sessionSeconds * 1000)).toBe(false);
    expect(validSession(token.replace(/.$/, "z"), now)).toBe(false);
    vi.stubEnv("APP_PASSWORD", "druga-testna-lozinka-2026");
    expect(validSession(token, now)).toBe(false);
  });
  it("API bez sesije odbija čitanje i prihvaća važeću potpisanu sesiju", () => {
    vi.stubEnv("APP_PASSWORD", password);
    expect(
      requireSession(new NextRequest("https://app.example/api/data"))?.status,
    ).toBe(401);
    expect(
      requireSession(
        new NextRequest("https://app.example/api/data", {
          headers: { cookie: `dolaznost_session=${createSession()}` },
        }),
      ),
    ).toBeNull();
  });
  it("prijava izdaje HttpOnly cookie, a odjava ga uklanja", async () => {
    vi.stubEnv("APP_PASSWORD", password);
    const form = new URLSearchParams({ password });
    const response = await login(
      new NextRequest("https://app.example/api/auth/login", {
        method: "POST",
        headers: { origin: "https://app.example", host: "app.example" },
        body: form,
      }),
    );
    expect(response.status).toBe(303);
    const cookie = response.cookies.get("dolaznost_session")!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("lax");
    expect(validSession(cookie.value)).toBe(true);
    const exit = await logout(
      new NextRequest("https://app.example/api/auth/logout", {
        method: "POST",
        headers: { origin: "https://app.example", host: "app.example" },
      }),
    );
    expect(exit.cookies.get("dolaznost_session")?.maxAge).toBe(0);
  });
  it("odbija prijavu i odjavu s drugog izvora i pogrešnu lozinku", async () => {
    vi.stubEnv("APP_PASSWORD", password);
    expect(
      sameOrigin(
        new Request("https://app.example", {
          headers: { origin: "https://other.example", host: "app.example" },
        }),
      ),
    ).toBe(false);
    const req = () =>
      new NextRequest("https://app.example/api/auth/login", {
        method: "POST",
        headers: { origin: "https://other.example", host: "app.example" },
        body: new URLSearchParams({ password }),
      });
    expect((await login(req())).status).toBe(403);
    expect((await logout(req())).status).toBe(403);
    const bad = await login(
      new NextRequest("https://app.example/api/auth/login", {
        method: "POST",
        headers: { origin: "https://app.example", host: "app.example" },
        body: new URLSearchParams({ password: "wrong" }),
      }),
    );
    expect(bad.headers.get("location")).toContain("greska=1");
    expect(bad.cookies.get("dolaznost_session")).toBeUndefined();
  });
});
