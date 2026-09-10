import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Allow requests to pass through to the client-side auth guard.
  // Tab-isolated sessions (sessionStorage) allow multiple users across tabs
  // and preserve active pages on browser refresh.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
