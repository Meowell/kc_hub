import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  const isProtected =
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/home") ||
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/routine") ||
    request.nextUrl.pathname.startsWith("/strategy") ||
    request.nextUrl.pathname.startsWith("/lock-plan");

  if (isProtected && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if ((request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/register") && session) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/home/:path*", "/dashboard/:path*", "/routine/:path*", "/strategy/:path*", "/lock-plan/:path*", "/login", "/register"],
};
