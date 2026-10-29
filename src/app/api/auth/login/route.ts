import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  passwordMatches,
  sameOrigin,
  publicUrl,
  sessionCookie,
  sessionSeconds,
} from "@/lib/auth";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Nedopušten izvor zahtjeva." },
      { status: 403 },
    );
  if (Number(request.headers.get("content-length") ?? 0) > 4096)
    return new NextResponse(null, { status: 413 });
  let password: FormDataEntryValue | null = null;
  try {
    password = (await request.formData()).get("password");
  } catch {
    return NextResponse.redirect(publicUrl("/prijava?greska=1", request), 303);
  }
  if (
    typeof password !== "string" ||
    password.length > 1024 ||
    !passwordMatches(password)
  )
    return NextResponse.redirect(publicUrl("/prijava?greska=1", request), 303);
  const response = NextResponse.redirect(publicUrl("/", request), 303);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(sessionCookie, createSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionSeconds,
  });
  return response;
}
