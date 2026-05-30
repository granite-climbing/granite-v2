"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME } from "@/lib/auth/admin";
import { verifyAdminCredentials } from "@/lib/auth/admin-credentials";
import type { AdminLoginInput } from "./admin-auth-schema";

export async function loginAdminAction(formData: FormData): Promise<void> {
  let token: string;
  try {
    const result = await verifyAdminCredentials(
      Object.fromEntries(formData) as AdminLoginInput,
    );
    token = result.token;
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/admin",
      maxAge: 60 * 60 * 8,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Invalid admin credentials") {
      redirect("/admin/login?error=invalid_credentials");
    }
    // Surface infra errors (missing ADMIN_JWT_SECRET, D1 failure, etc.) rather
    // than silently masking them as a login failure.
    console.error(err);
    throw err;
  }

  // redirect() throws NEXT_REDIRECT internally and must be called outside
  // try/catch so it propagates correctly to the Next.js runtime.
  redirect("/admin/content");
}

export async function logoutAdminAction(): Promise<void> {
  const cookieStore = await cookies();
  // Delete with the SAME path the cookie was set with ("/admin"); a default
  // path="/" delete will not clear a cookie scoped to "/admin".
  cookieStore.delete({ name: ADMIN_COOKIE_NAME, path: "/admin" });
  redirect("/admin/login");
}
