import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_PATH = "/auth";
const PUBLIC_PATHS = new Set<string>([AUTH_PATH]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isStaticAsset = /\.[^/]+$/.test(pathname);

  if (isStaticAsset) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get("accessToken")?.value;
  const isAuthenticated = Boolean(accessToken);
  const isPublicPath = PUBLIC_PATHS.has(pathname);

  if (!isAuthenticated && !isPublicPath) {
    return NextResponse.redirect(new URL(AUTH_PATH, request.url));
  }

  if (isAuthenticated && pathname === AUTH_PATH) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
