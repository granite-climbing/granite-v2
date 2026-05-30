"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { insertAdminAuditLog } from "@/lib/db/admin-queries";
import {
  upsertAnnouncement,
  softDeleteContent,
  restoreContent,
} from "@/lib/db/admin-content-queries";
import { parseAnnouncementForm } from "./admin-content-schema";

// ---------------------------------------------------------------------------
// Non-fatal audit helper (duplicated locally to avoid exporting internals from
// admin-content.ts which is a "use server" file — exporting helpers from there
// would expose them as public actions).
// ---------------------------------------------------------------------------

async function auditLog(input: {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await insertAdminAuditLog(input);
  } catch (err) {
    console.error("[audit] Failed to write audit log — content change already committed:", err);
  }
}

// ---------------------------------------------------------------------------
// Soft-delete confirm guard (duplicated inline — see note above).
// Approach (b): duplicate the small guard rather than refactoring existing tests.
// ---------------------------------------------------------------------------

function assertDeleteConfirm(formData: FormData): void {
  if (formData.get("confirm") !== "DELETE") {
    throw new Error('Type "DELETE" to confirm deletion');
  }
}

// ---------------------------------------------------------------------------
// Revalidation helper
// ---------------------------------------------------------------------------

function revalidateAnnouncementSurface(): void {
  revalidateTag("home");
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Save (upsert) action
// Announcements have no slug — use randomUUID for new records.
// ---------------------------------------------------------------------------

export async function saveAnnouncementAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = parseAnnouncementForm(Object.fromEntries(formData));
  const id = parsed.id ?? `announcement_${randomUUID()}`;

  await upsertAnnouncement({ ...parsed, id });

  await auditLog({
    adminId: admin.adminId,
    action: "announcement.upsert",
    targetType: "announcement",
    targetId: id,
    metadata: { title: parsed.title },
  });

  revalidateAnnouncementSurface();
}

// ---------------------------------------------------------------------------
// Soft-delete action
// ---------------------------------------------------------------------------

export async function softDeleteAnnouncementAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  assertDeleteConfirm(formData);
  const id = String(formData.get("id") ?? "");

  await softDeleteContent({ table: "announcements", id });

  await auditLog({
    adminId: admin.adminId,
    action: "announcement.soft_delete",
    targetType: "announcement",
    targetId: id,
  });

  revalidateAnnouncementSurface();
}

// ---------------------------------------------------------------------------
// Restore action
// ---------------------------------------------------------------------------

export async function restoreAnnouncementAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  await restoreContent({ table: "announcements", id });

  await auditLog({
    adminId: admin.adminId,
    action: "announcement.restore",
    targetType: "announcement",
    targetId: id,
  });

  revalidateAnnouncementSurface();
}
