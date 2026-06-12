import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host");
  if (!host?.startsWith("127.0.0.1")) {
    return NextResponse.next();
  }

  const requestUrl = new URL(request.url);
  requestUrl.hostname = "localhost";
  return NextResponse.redirect(requestUrl);
}
