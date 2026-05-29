import bcrypt from "bcryptjs";
import { findActiveAdminByEmail } from "@/lib/db/admin-queries";
import { createAdminToken } from "@/lib/auth/admin";
import { adminLoginSchema, type AdminLoginInput } from "@/lib/actions/admin-auth-schema";

// Precomputed dummy hash for constant-time comparison when email is not found.
// Prevents email enumeration via timing differences between the unknown-email
// path (no bcrypt work) and the wrong-password path (full bcrypt work).
const DUMMY_HASH = "$2b$12$aaaaaaaaaaaaaaaaaaaaaa.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const INVALID_CREDENTIALS = "Invalid admin credentials";

export async function verifyAdminCredentials(input: AdminLoginInput): Promise<{
  token: string;
  email: string;
  displayName: string;
}> {
  const parsed = adminLoginSchema.parse(input);
  const admin = await findActiveAdminByEmail(parsed.email);

  if (!admin) {
    // Run a bcrypt compare against a dummy hash so the timing matches the
    // wrong-password path and email addresses cannot be enumerated via latency.
    await bcrypt.compare(parsed.password, DUMMY_HASH);
    throw new Error(INVALID_CREDENTIALS);
  }

  const validPassword = await bcrypt.compare(parsed.password, admin.passwordHash);
  if (!validPassword) throw new Error(INVALID_CREDENTIALS);

  const token = await createAdminToken({
    adminId: admin.id,
    email: admin.email,
    displayName: admin.displayName,
  });

  return { token, email: admin.email, displayName: admin.displayName };
}
