"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  PENDING_SIGNUP_COOKIE_NAME,
  verifyPendingSignupToken
} from "@/lib/auth/signup";
import {
  createUserSessionToken,
  getUserSessionCookieOptions,
  USER_SESSION_COOKIE_NAME
} from "@/lib/auth/session";
import { createUserForCompletedSignup } from "@/lib/db/user-auth-queries";
import { parseProfileInput } from "@/lib/profile/profile-input";

export async function completeSignupAction(formData: FormData): Promise<void> {
  const cookieStore = await cookies();
  const pendingToken = cookieStore.get(PENDING_SIGNUP_COOKIE_NAME)?.value;
  const pendingSignup = pendingToken ? await verifyPendingSignupToken(pendingToken) : null;
  if (!pendingSignup) {
    redirect("/login?error=signup_expired");
  }

  const profile = parseProfileInput(formData);
  if (!profile) {
    redirect("/signup?error=invalid_profile");
  }

  const user = await createUserForCompletedSignup({
    provider: pendingSignup.provider,
    providerUserId: pendingSignup.providerUserId,
    email: pendingSignup.email,
    avatarUrl: pendingSignup.avatarUrl,
    ...profile
  });
  const sessionToken = await createUserSessionToken({
    userId: user.id
  });

  cookieStore.set(USER_SESSION_COOKIE_NAME, sessionToken, getUserSessionCookieOptions());
  cookieStore.delete(PENDING_SIGNUP_COOKIE_NAME);
  redirect(pendingSignup.returnTo);
}
