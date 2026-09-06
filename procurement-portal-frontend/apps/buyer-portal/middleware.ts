import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public routes that do not require authentication
const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];
// Auth group routes (with parentheses directory)
const AUTH_GROUP_ROUTES = ["/mfa"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes and Next.js internals
  const isPublic =
    PUBLIC_ROUTES.some((route) => pathname.startsWith(route)) ||
    AUTH_GROUP_ROUTES.some((route) => pathname.startsWith(route)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json";

  if (isPublic) {
    return NextResponse.next();
  }

  // Check for refresh_token cookie (set by backend, httpOnly)
  // We cannot check the access_token since it's in memory only
  const refreshToken =
    request.cookies.get("refresh_token_buyer") ||
    request.cookies.get("refresh_token");

  if (!refreshToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
