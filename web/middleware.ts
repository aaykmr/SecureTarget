import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  const token = await getToken({ req, secret });
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"]
};
