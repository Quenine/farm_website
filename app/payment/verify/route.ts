import { NextResponse, type NextRequest } from "next/server";

export function GET(request: NextRequest) {
  const callbackUrl = new URL("/payment/callback", request.url);
  request.nextUrl.searchParams.forEach((value, key) => {
    callbackUrl.searchParams.set(key, value);
  });
  return NextResponse.redirect(callbackUrl);
}
