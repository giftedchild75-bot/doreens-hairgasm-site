import { NextResponse, type NextRequest } from "next/server";

/**
 * Defence in depth for /admin: requests without a staff session cookie are
 * sent to the login page before any admin code runs. The real check (session
 * lookup + role) still happens in every admin page and server action.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();
  if (!request.cookies.get("dh_admin")?.value) {
    if (pathname.startsWith("/admin/orders/export")) return new NextResponse("Unauthorized", { status: 401 });
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
