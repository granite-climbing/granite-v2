"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import { findActiveUserById, updateUserProfile } from "@/lib/db/user-auth-queries";
import { parseProfileInput } from "@/lib/profile/profile-input";

export async function updateProfileAction(formData: FormData): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifyUserSessionToken(token) : null;
  const user = session ? await findActiveUserById(session.userId) : null;
  if (!user) redirect("/login?returnTo=/me/edit");

  const profile = parseProfileInput(formData);
  if (!profile) redirect("/me/edit?error=invalid_profile");
  await updateUserProfile(user.id, profile);
  redirect("/me");
}
