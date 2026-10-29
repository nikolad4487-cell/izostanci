import { NextRequest, NextResponse } from "next/server";
import {
  authRequired,
  passwordConfigured,
  validSession,
  sessionCookie,
} from "@/lib/auth";
export function proxy(request: NextRequest) {
  if (!authRequired()) return NextResponse.next();
  if (!passwordConfigured())
    return new NextResponse(
      "Aplikacija nije konfigurirana. U Vercel postavkama dodajte APP_PASSWORD s najmanje 16 znakova i ponovno objavite aplikaciju.",
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  if (validSession(request.cookies.get(sessionCookie)?.value))
    return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/"))
    return NextResponse.json(
      { error: "Prijavite se za pristup evidenciji." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  return NextResponse.redirect(new URL("/prijava", request.url));
}
export const config = { matcher: ["/", "/api/data/:path*"] };
