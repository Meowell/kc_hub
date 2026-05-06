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

  console.log("[mw]", request.method, request.nextUrl.pathname,
    "hasToken:", !!token,
    "hasSession:", !!session,
    "rsc:", request.nextUrl.searchParams.has("_rsc"),
    "prefetch:", request.headers.get("next-router-prefetch"),
    "x-fwd-proto:", request.headers.get("x-forwarded-proto"),
  );

  if (isProtected && !session) {
    console.log("[mw] REDIRECT to /login from", request.nextUrl.pathname);
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
