import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password || password.length < 6) {
  console.error(
    "Usage: pnpm dlx tsx scripts/create-admin-hash.ts '<password-with-at-least-6-chars>'"
  );
  process.exit(1);
}

const hash = await bcrypt.hash(password, 6);
console.log(hash);
