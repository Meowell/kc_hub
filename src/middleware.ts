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
    request.nextUrl.pathname.startsWith("/lock-plan") ||
    request.nextUrl.pathname.startsWith("/profile");

  if (isProtected && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if ((request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/register") && session) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/home/:path*", "/dashboard/:path*", "/routine/:path*", "/strategy/:path*", "/lock-plan/:path*", "/profile/:path*", "/login", "/register"],
};
