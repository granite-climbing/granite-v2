/**
 * scripts/create-admin-hash.ts
 *
 * Print a bcrypt(cost=12) hash for a password.
 *
 * Usage:
 *   pnpm dlx tsx scripts/create-admin-hash.ts '<password-with-at-least-6-chars>'
 *
 * Prefer `scripts/seed-admin.ts` — it hashes AND inserts the admin row into
 * D1 in one safe interactive step. Keep this script for the case where you
 * only need the hash (e.g. to paste into a one-off SQL statement run from
 * the D1 console).
 */

import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password || password.length < 6) {
  console.error(
    "Usage: pnpm dlx tsx scripts/create-admin-hash.ts '<password-with-at-least-6-chars>'",
  );
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
console.log(hash);
