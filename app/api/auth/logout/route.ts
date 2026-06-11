import { NextResponse } from "next/server";
import { getUserSessionCookieOptions, USER_SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(USER_SESSION_COOKIE_NAME, "", {
    ...getUserSessionCookieOptions(),
    maxAge: 0
  });
  return response;
}
