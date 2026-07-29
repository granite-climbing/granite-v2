"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getPendingRecoveryCookieOptions,
  PENDING_RECOVERY_COOKIE_NAME,
  verifyPendingRecoveryToken
} from "@/lib/auth/recovery";
import {
  createUserSessionToken,
  getUserSessionCookieOptions,
  USER_SESSION_COOKIE_NAME
} from "@/lib/auth/session";
import { getWithdrawalStatus } from "@/lib/auth/withdrawal";
import { findWithdrawnUserById, restoreWithdrawnUser } from "@/lib/db/user-auth-queries";

export async function restoreAccountAction(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_RECOVERY_COOKIE_NAME)?.value;
  const pending = token ? await verifyPendingRecoveryToken(token) : null;

  if (!pending) {
    redirect("/login");
  }

  const user = await findWithdrawnUserById(pending.userId);
  if (!user || !user.withdrawAt) {
    clearRecoveryCookie(cookieStore);
    redirect("/login?error=recovery_unavailable");
  }

  if (getWithdrawalStatus(user.withdrawAt, new Date()) !== "recoverable") {
    clearRecoveryCookie(cookieStore);
    redirect("/login?error=recovery_expired");
  }

  const restored = await restoreWithdrawnUser(user.id);
  if (!restored) {
    // 그 사이 다른 요청이 계정을 정리했다.
    clearRecoveryCookie(cookieStore);
    redirect("/login?error=recovery_expired");
  }

  const sessionToken = await createUserSessionToken({ userId: user.id });
  cookieStore.set(USER_SESSION_COOKIE_NAME, sessionToken, getUserSessionCookieOptions());
  clearRecoveryCookie(cookieStore);
  redirect(pending.returnTo);
}

export async function cancelRecoveryAction(): Promise<void> {
  const cookieStore = await cookies();
  clearRecoveryCookie(cookieStore);
  redirect("/login");
}

function clearRecoveryCookie(cookieStore: Awaited<ReturnType<typeof cookies>>): void {
  cookieStore.set(PENDING_RECOVERY_COOKIE_NAME, "", {
    ...getPendingRecoveryCookieOptions(),
    maxAge: 0
  });
}
