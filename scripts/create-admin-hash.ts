import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password || password.length < 12) {
  console.error(
    "Usage: pnpm dlx tsx scripts/create-admin-hash.ts '<password-with-at-least-12-chars>'"
  );
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
console.log(hash);
