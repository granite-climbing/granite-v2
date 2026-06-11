"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { normalizeHandle } from "@/lib/beta/normalize";
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

const optionalNumberSchema = z.preprocess((value) => {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}, z.number().int().min(1).max(300).nullable());

const optionalTextSchema = z.preprocess((value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}, z.string().max(32).nullable());

const signupSchema = z.object({
  nickname: z.string().trim().min(1).max(32),
  gender: z.enum(["male", "female"]),
  heightCm: optionalNumberSchema,
  apeIndexCm: optionalNumberSchema,
  topBoulderingGrade: optionalTextSchema,
  topSportGrade: optionalTextSchema
});

export async function completeSignupAction(formData: FormData): Promise<void> {
  const cookieStore = await cookies();
  const pendingToken = cookieStore.get(PENDING_SIGNUP_COOKIE_NAME)?.value;
  const pendingSignup = pendingToken ? await verifyPendingSignupToken(pendingToken) : null;
  if (!pendingSignup) {
    redirect("/login?error=signup_expired");
  }

  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect("/signup?error=invalid_profile");
  }

  const instagramId = normalizeHandle(parsed.data.nickname);
  if (!instagramId) {
    redirect("/signup?error=invalid_profile");
  }

  const user = await createUserForCompletedSignup({
    provider: pendingSignup.provider,
    providerUserId: pendingSignup.providerUserId,
    email: pendingSignup.email,
    displayName: instagramId,
    avatarUrl: pendingSignup.avatarUrl,
    instagramId,
    gender: parsed.data.gender,
    heightCm: parsed.data.heightCm,
    apeIndexCm: parsed.data.apeIndexCm,
    topBoulderingGrade: parsed.data.topBoulderingGrade,
    topSportGrade: parsed.data.topSportGrade
  });
  const sessionToken = await createUserSessionToken({
    userId: user.id
  });

  cookieStore.set(USER_SESSION_COOKIE_NAME, sessionToken, getUserSessionCookieOptions());
  cookieStore.delete(PENDING_SIGNUP_COOKIE_NAME);
  redirect(pendingSignup.returnTo);
}
