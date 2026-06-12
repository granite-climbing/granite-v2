"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserSessionCookieOptions, USER_SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(USER_SESSION_COOKIE_NAME, "", {
    ...getUserSessionCookieOptions(),
    maxAge: 0
  });

  redirect("/me");
}
