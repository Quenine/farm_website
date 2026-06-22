import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/src/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSupabaseSession(request);
  const pathname = request.nextUrl.pathname;

  if (!pathname.startsWith("/admin")) {
    return response;
  }

  const loginPath = pathname === "/admin/login";
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) {
    return loginPath
      ? response
      : NextResponse.redirect(
          new URL("/admin/login?error=configuration", request.url),
        );
  }

  const isOwner = user?.email?.trim().toLowerCase() === adminEmail;

  if (loginPath && isOwner) {
    return redirectWithCookies("/admin", request, response);
  }

  if (!loginPath && !isOwner) {
    const destination = user
      ? "/admin/login?error=unauthorized"
      : "/admin/login";
    return redirectWithCookies(destination, request, response);
  }

  return response;
}

function redirectWithCookies(
  destination: string,
  request: NextRequest,
  response: NextResponse,
) {
  const redirectResponse = NextResponse.redirect(
    new URL(destination, request.url),
  );
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  return redirectResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
