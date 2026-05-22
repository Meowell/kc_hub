import { NextResponse } from "next/server";

import { SESSION_COOKIE, SESSION_COOKIE_SECURE } from "@/lib/session";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: SESSION_COOKIE_SECURE,
    expires: new Date(0),
    path: "/",
  });

  return response;
}
