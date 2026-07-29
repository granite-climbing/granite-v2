"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getUserSessionCookieOptions,
  USER_SESSION_COOKIE_NAME,
  verifyUserSessionToken
} from "@/lib/auth/session";
import { findActiveUserById, markUserWithdrawn } from "@/lib/db/user-auth-queries";

export async function withdrawAccountAction(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifyUserSessionToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  const user = await findActiveUserById(session.userId);
  if (!user) {
    // 이미 탈퇴했거나 사라진 계정. 세션만 정리한다.
    clearSessionCookie(cookieStore);
    redirect("/login");
  }

  await markUserWithdrawn(user.id);
  clearSessionCookie(cookieStore);
  redirect("/login?withdrawn=1");
}

function clearSessionCookie(cookieStore: Awaited<ReturnType<typeof cookies>>): void {
  cookieStore.set(USER_SESSION_COOKIE_NAME, "", {
    ...getUserSessionCookieOptions(),
    maxAge: 0
  });
}
