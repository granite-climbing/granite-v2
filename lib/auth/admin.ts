import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { findActiveAdminById } from "@/lib/db/admin-queries";

const encoder = new TextEncoder();

export const ADMIN_COOKIE_NAME = "granite_admin";

export type AdminSession = {
  adminId: string;
  email: string;
  displayName: string;
};

export function getAdminSecret(): Uint8Array {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_JWT_SECRET is required in production");
  }
  return encoder.encode(secret ?? "granite-local-admin-secret");
}

export async function createAdminToken(session: AdminSession): Promise<string> {
  return new SignJWT({
    email: session.email,
    displayName: session.displayName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.adminId)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getAdminSecret());
}

export async function verifyAdminToken(token: string): Promise<AdminSession | null> {
  try {
    const verified = await jwtVerify(token, getAdminSecret());
    const adminId = verified.payload.sub;
    if (!adminId) return null;

    const admin = await findActiveAdminById(adminId);
    if (!admin) return null;

    return {
      adminId: admin.id,
      email: admin.email,
      displayName: admin.displayName,
    };
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }
  return session;
}
