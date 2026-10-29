import { NextRequest, NextResponse } from "next/server";
import {
  authRequired,
  passwordConfigured,
  validSession,
  sessionCookie,
} from "./auth";
export function requireSession(request: NextRequest) {
  if (!authRequired()) return null;
  if (!passwordConfigured())
    return NextResponse.json(
      { error: "U postavkama postavite APP_PASSWORD s najmanje 16 znakova." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  if (!validSession(request.cookies.get(sessionCookie)?.value))
    return NextResponse.json(
      { error: "Prijavite se za pristup evidenciji." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  return null;
}
