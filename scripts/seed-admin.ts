/**
 * scripts/seed-admin.ts
 *
 * Create or update a Granite admin in Cloudflare D1.
 *
 * Usage:
 *   pnpm dlx tsx scripts/seed-admin.ts <email> <display-name> [--id <admin-id>]
 *
 * Interactive: prompts for password (hidden) and confirmation. Reads D1 env from
 * `.env.local` (if present) or current shell:
 *   D1_HTTP_URL, D1_API_TOKEN, D1_DATABASE_ID
 *
 * Examples:
 *   # Pull preview env locally, then seed
 *   vercel env pull .env.local --environment preview
 *   pnpm dlx tsx scripts/seed-admin.ts ops@granite.kr "Granite Ops"
 *
 *   # Production seed with a fixed id
 *   vercel env pull .env.local --environment production
 *   pnpm dlx tsx scripts/seed-admin.ts ops@granite.kr "Granite Ops" --id admin_primary
 *
 * Behavior:
 *   - Email is unique. If a row with this email exists, prompts to UPDATE
 *     (password + display_name + reactivate). Otherwise INSERTs a new row.
 *   - bcrypt cost = 12.
 *   - Shows the target D1 database id's last 6 chars before any write so you
 *     can confirm you're talking to the intended environment.
 *   - Never prints or logs the password or hash.
 */

import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

// -----------------------------------------------------------------------------
// .env.local loader (tiny, no extra dependency)
// -----------------------------------------------------------------------------

function loadDotenv(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
    if (!match) continue;
    const key = match[1];
    if (process.env[key] !== undefined) continue; // existing shell env wins
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const envPath = path.resolve(process.cwd(), ".env.local");
const envExisted = fs.existsSync(envPath);
loadDotenv(envPath);

// -----------------------------------------------------------------------------
// Inline D1 HTTP client (avoids importing the Next.js-flavored lib/db chain)
// -----------------------------------------------------------------------------

interface D1ResultEntry<T> {
  results: T[];
}
interface D1Envelope<T> {
  success: boolean;
  errors: { message: string }[];
  result: D1ResultEntry<T>[];
}

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`✗ Missing required env var: ${key}`);
    console.error(
      "  Pull env from Vercel first, e.g.:",
    );
    console.error("    vercel env pull .env.local --environment preview");
    console.error("  or set the variable in your shell.");
    process.exit(1);
  }
  return value;
}

async function d1Query<T>(sql: string, params: unknown[]): Promise<T[]> {
  const url = requiredEnv("D1_HTTP_URL");
  const token = requiredEnv("D1_API_TOKEN");
  const databaseId = requiredEnv("D1_DATABASE_ID");
  const endpoint = /\/query(\?.*)?$/.test(url)
    ? url
    : `${url.replace(/\/$/, "")}/${databaseId}/query`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sql, params }),
  });

  let body: D1Envelope<T> | null = null;
  try {
    body = (await response.json()) as D1Envelope<T>;
  } catch {
    // fall through to error below
  }

  if (!response.ok || !body || !body.success) {
    const detail =
      body?.errors?.map((e) => e.message).join("; ") ||
      `HTTP ${response.status}`;
    throw new Error(`D1 request failed: ${detail}`);
  }
  return body.result?.[0]?.results ?? [];
}

// -----------------------------------------------------------------------------
// Hidden password prompt (TTY raw mode, no extra dependency)
// -----------------------------------------------------------------------------

function askPassword(promptText: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY) {
      reject(new Error("Password input requires an interactive TTY."));
      return;
    }
    stdout.write(promptText);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let buffer = "";
    const onData = (ch: string) => {
      for (const c of ch) {
        if (c === "\u0003") {
          // Ctrl+C
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          reject(new Error("Aborted by user."));
          return;
        }
        if (c === "\r" || c === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          resolve(buffer);
          return;
        }
        if (c === "\u007f" || c === "\b") {
          // Backspace (DEL on macOS = 0x7F) or BS (0x08)
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1);
            stdout.write("\b \b");
          }
          continue;
        }
        buffer += c;
        stdout.write("*");
      }
    };
    stdin.on("data", onData);
  });
}

// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------

function usage(message?: string): never {
  if (message) console.error(`✗ ${message}`);
  console.error(
    "Usage: pnpm dlx tsx scripts/seed-admin.ts <email> <display-name> [--id <admin-id>]",
  );
  console.error(
    'Example: pnpm dlx tsx scripts/seed-admin.ts ops@granite.kr "Granite Ops"',
  );
  process.exit(1);
}

function parseArgs(argv: string[]): {
  email: string;
  displayName: string;
  forcedId: string | null;
} {
  const positional: string[] = [];
  let forcedId: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--id") {
      const next = argv[i + 1];
      if (!next) usage("--id requires a value.");
      forcedId = next;
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      usage();
    } else {
      positional.push(arg);
    }
  }
  if (positional.length !== 2) usage("Expected <email> and <display-name>.");
  return { email: positional[0], displayName: positional[1], forcedId };
}

async function main(): Promise<void> {
  const { email, displayName, forcedId } = parseArgs(process.argv.slice(2));

  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = displayName.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    usage(`Invalid email: ${email}`);
  }
  if (trimmedName.length === 0) {
    usage("Display name must not be empty.");
  }
  if (forcedId !== null && !/^admin_[A-Za-z0-9_-]+$/.test(forcedId)) {
    usage("--id must look like admin_<alphanumeric/_/-> .");
  }

  const databaseId = requiredEnv("D1_DATABASE_ID");
  const dbTail = databaseId.slice(-6);

  console.log("");
  console.log(`Env source:        ${envExisted ? envPath : "(shell only — no .env.local)"}`);
  console.log(`Target D1 db id:   ...${dbTail}`);
  console.log(`Email:             ${normalizedEmail}`);
  console.log(`Display name:      ${trimmedName}`);
  if (forcedId) console.log(`Forced id:         ${forcedId}`);
  console.log("");

  // Password (hidden, with confirmation)
  const password = await askPassword("Password (min 6 chars, hidden): ");
  if (password.length < 6) {
    console.error("✗ Password must be at least 6 characters.");
    process.exit(1);
  }
  const confirmPassword = await askPassword("Confirm password:                ");
  if (password !== confirmPassword) {
    console.error("✗ Passwords do not match.");
    process.exit(1);
  }

  // Look up any existing admin with this email (including inactive — we'll reactivate)
  const existing = await d1Query<{
    id: string;
    email: string;
    display_name: string;
    is_active: number;
  }>(
    "SELECT id, email, display_name, is_active FROM admins WHERE lower(email) = lower(?) LIMIT 1",
    [normalizedEmail],
  );

  const rl = readline.createInterface({ input: stdin, output: stdout });
  let id: string;
  let mode: "insert" | "update";

  if (existing.length > 0) {
    const row = existing[0];
    console.log("");
    console.log("! An admin row with this email already exists:");
    console.log(
      `    id=${row.id}  display_name="${row.display_name}"  is_active=${row.is_active}`,
    );
    if (forcedId && forcedId !== row.id) {
      console.error(
        `✗ --id ${forcedId} conflicts with the existing row's id (${row.id}). Aborting.`,
      );
      rl.close();
      process.exit(1);
    }
    const ans = (
      await rl.question(
        "Update password + display_name + reactivate this admin? (yes/no) ",
      )
    )
      .trim()
      .toLowerCase();
    if (ans !== "yes" && ans !== "y") {
      console.log("Aborted; no changes written.");
      rl.close();
      return;
    }
    id = row.id;
    mode = "update";
  } else {
    const ans = (
      await rl.question(
        `Insert a new admin into D1 ...${dbTail}? (yes/no) `,
      )
    )
      .trim()
      .toLowerCase();
    if (ans !== "yes" && ans !== "y") {
      console.log("Aborted; no changes written.");
      rl.close();
      return;
    }
    id = forcedId ?? `admin_${randomUUID()}`;
    mode = "insert";
  }
  rl.close();

  console.log("");
  console.log("Hashing password (bcrypt cost=12)...");
  const passwordHash = await bcrypt.hash(password, 12);

  if (mode === "insert") {
    await d1Query(
      `INSERT INTO admins (id, email, password_hash, display_name, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [id, normalizedEmail, passwordHash, trimmedName],
    );
    console.log(`✓ Inserted admin: id=${id}  email=${normalizedEmail}`);
  } else {
    await d1Query(
      `UPDATE admins
       SET password_hash = ?,
           display_name  = ?,
           is_active     = 1,
           updated_at    = datetime('now')
       WHERE id = ?`,
      [passwordHash, trimmedName, id],
    );
    console.log(`✓ Updated admin: id=${id}  email=${normalizedEmail}`);
  }

  console.log("");
  console.log("Done. Try logging in at /admin/login.");
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`✗ ${message}`);
  process.exit(1);
});
