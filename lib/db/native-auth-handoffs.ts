import { createHash, randomUUID } from "node:crypto";
import { executeD1, executeD1Meta, queryD1First } from "./d1-http";

type NativeAuthHandoffRow = {
  id: string;
  token: string;
};

type StoreNativeAuthHandoffOptions = {
  now?: () => Date;
  ttlSeconds?: number;
};

export async function storeNativeAuthHandoffToken(
  token: string,
  options: StoreNativeAuthHandoffOptions = {}
): Promise<string> {
  const now = options.now?.() ?? new Date();
  const ttlSeconds = options.ttlSeconds ?? 60 * 5;
  const id = `native_handoff_${randomUUID()}`;
  const code = randomUUID();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

  await executeD1(
    `INSERT INTO native_auth_handoffs
       (id, code_hash, token, expires_at)
     VALUES (?, ?, ?, ?)`,
    [id, hashCode(code), token, expiresAt]
  );

  return code;
}

export async function consumeNativeAuthHandoffToken(code: string): Promise<string | null> {
  const row = await queryD1First<NativeAuthHandoffRow>(
    `SELECT id, token
     FROM native_auth_handoffs
     WHERE code_hash = ?
       AND consumed_at IS NULL
       AND expires_at > datetime('now')
     LIMIT 1`,
    [hashCode(code)]
  );

  if (!row) {
    return null;
  }

  const result = await executeD1Meta(
    `UPDATE native_auth_handoffs
     SET consumed_at = datetime('now')
     WHERE id = ?
       AND consumed_at IS NULL`,
    [row.id]
  );

  return result.changes > 0 ? row.token : null;
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
