import { NextRequest, NextResponse } from "next/server";
import { sameOrigin, sessionCookie, publicUrl } from "@/lib/auth";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Nedopušten izvor zahtjeva." },
      { status: 403 },
    );
  const response = NextResponse.redirect(publicUrl("/prijava", request), 303);
  response.cookies.set(sessionCookie, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
