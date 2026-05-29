"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME, createAdminToken } from "@/lib/auth/admin";
import { findActiveAdminByEmail } from "@/lib/db/admin-queries";
import { adminLoginSchema, type AdminLoginInput } from "./admin-auth-schema";

const INVALID_CREDENTIALS = "Invalid admin credentials";

export async function loginAdminForTest(input: AdminLoginInput): Promise<{
  token: string;
  email: string;
  displayName: string;
}> {
  const parsed = adminLoginSchema.parse(input);
  const admin = await findActiveAdminByEmail(parsed.email);
  if (!admin) throw new Error(INVALID_CREDENTIALS);

  const validPassword = await bcrypt.compare(parsed.password, admin.passwordHash);
  if (!validPassword) throw new Error(INVALID_CREDENTIALS);

  const token = await createAdminToken({
    adminId: admin.id,
    email: admin.email,
    displayName: admin.displayName,
  });

  return { token, email: admin.email, displayName: admin.displayName };
}

export async function loginAdminAction(formData: FormData): Promise<void> {
  try {
    const result = await loginAdminForTest(Object.fromEntries(formData) as AdminLoginInput);
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_COOKIE_NAME, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/admin",
      maxAge: 60 * 60 * 8,
    });
  } catch {
    redirect("/admin/login?error=invalid_credentials");
  }

  redirect("/admin/content");
}

export async function logoutAdminAction(): Promise<void> {
  const cookieStore = await cookies();
  // Delete with the SAME path the cookie was set with ("/admin"); a default
  // path="/" delete will not clear a cookie scoped to "/admin".
  cookieStore.delete({ name: ADMIN_COOKIE_NAME, path: "/admin" });
  redirect("/admin/login");
}
