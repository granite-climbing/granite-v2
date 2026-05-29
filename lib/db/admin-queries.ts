import { randomUUID } from "node:crypto";
import { executeD1, queryD1First } from "./d1-http";

export type AdminRow = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  isActive: boolean;
};

type AdminSqlRow = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  isActive: 0 | 1;
};

function mapAdmin(row: AdminSqlRow | null): AdminRow | null {
  if (!row) return null;
  return { ...row, isActive: row.isActive === 1 };
}

export async function findActiveAdminByEmail(email: string): Promise<AdminRow | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const row = await queryD1First<AdminSqlRow>(
    `SELECT
       id,
       email,
       password_hash AS passwordHash,
       display_name AS displayName,
       is_active AS isActive
     FROM admins
     WHERE lower(email) = lower(?) AND is_active = 1
     LIMIT 1`,
    [normalizedEmail],
  );
  return mapAdmin(row);
}

export async function findActiveAdminById(id: string): Promise<AdminRow | null> {
  const row = await queryD1First<AdminSqlRow>(
    `SELECT
       id,
       email,
       password_hash AS passwordHash,
       display_name AS displayName,
       is_active AS isActive
     FROM admins
     WHERE id = ? AND is_active = 1
     LIMIT 1`,
    [id],
  );
  return mapAdmin(row);
}

export async function insertAdminAuditLog(input: {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await executeD1(
    `INSERT INTO admin_audit_logs
       (id, admin_id, action, target_type, target_id, metadata)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      `audit_${randomUUID()}`,
      input.adminId,
      input.action,
      input.targetType,
      input.targetId,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}
