import { SignJWT, jwtVerify } from "jose";

const encoder = new TextEncoder();

export type AdminSession = {
  email: string;
  displayName: string;
};

export function getAdminSecret(): Uint8Array {
  return encoder.encode(process.env.ADMIN_JWT_SECRET ?? process.env.ADMIN_TOKEN ?? "granite-local-admin-secret");
}

export async function createAdminToken(session: AdminSession): Promise<string> {
  return new SignJWT({ displayName: session.displayName })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.email)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getAdminSecret());
}

export async function verifyAdminToken(token: string): Promise<AdminSession | null> {
  try {
    const verified = await jwtVerify(token, getAdminSecret());
    return {
      email: verified.payload.sub ?? "",
      displayName: typeof verified.payload.displayName === "string" ? verified.payload.displayName : "Admin"
    };
  } catch {
    return null;
  }
}
