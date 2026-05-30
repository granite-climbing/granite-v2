"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { insertAdminAuditLog } from "@/lib/db/admin-queries";
import {
  upsertArea,
  upsertCrag,
  upsertSector,
  upsertBoulder,
  upsertTopo,
  upsertRoute,
  updatePublishState,
  softDeleteContent,
  restoreContent,
  findRowBySlug,
  getCragSlugByCragId,
  getSectorAncestry,
  getBoulderAncestry,
  getTopoAncestry,
  getRouteAncestry,
} from "@/lib/db/admin-content-queries";
import {
  parseAreaForm,
  parseCragForm,
  parseSectorForm,
  parseBoulderForm,
  parseTopoForm,
  parseRouteForm,
} from "./admin-content-schema";

// ---------------------------------------------------------------------------
// Table validation and singular name mapping for publish toggle
// ---------------------------------------------------------------------------

const ALLOWED_TOGGLE_TABLES = ["areas", "crags", "sectors", "boulders", "topos", "routes", "announcements"] as const;
type ToggleTable = (typeof ALLOWED_TOGGLE_TABLES)[number];

const SINGULAR_BY_TABLE: Record<ToggleTable, string> = {
  areas: "area",
  crags: "crag",
  sectors: "sector",
  boulders: "boulder",
  topos: "topo",
  routes: "route",
  announcements: "announcement",
};

// ---------------------------------------------------------------------------
// Non-fatal audit helper
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
// Slug-collision resolution for save actions
// Applies to: area, crag, sector, boulder, route (NOT topo — no slug).
// Returns both the resolved id and a flag indicating whether a soft-deleted row was reused.
// reusedDeletedRow is true ONLY when an existing soft-deleted row's id is returned;
// false when no row was found (i.e., the caller's generated id is used).
// ---------------------------------------------------------------------------

async function resolveSlugConflict(input: {
  generatedId: string;
  table: "areas" | "crags" | "sectors" | "boulders" | "routes";
  slug: string;
  parentColumn?: string;
  parentId?: string;
}): Promise<{ id: string; reusedDeletedRow: boolean }> {
  const existing = await findRowBySlug({
    table: input.table,
    slug: input.slug,
    parentColumn: input.parentColumn,
    parentId: input.parentId,
  });

  if (!existing) {
    return { id: input.generatedId, reusedDeletedRow: false };
  }

  if (existing.deleted_at !== null) {
    // Soft-deleted row: reuse its id so the upsert updates it.
    // Signal reusedDeletedRow=true so the caller invokes restoreContent.
    return { id: existing.id, reusedDeletedRow: true };
  }

  // Live row with the same slug — refuse to overwrite silently.
  throw new Error("Slug already in use");
}

// ---------------------------------------------------------------------------
// Revalidation helpers
// ---------------------------------------------------------------------------

function revalidateAreaSurface(): void {
  revalidateTag("home");
  revalidateTag("areas:list");
  revalidatePath("/");
}

function revalidateCragSurface(slug?: string): void {
  revalidateTag("home");
  revalidateTag("areas:list");
  if (slug) revalidateTag(`crag:${slug}`);
  revalidatePath("/");
  if (slug) revalidatePath(`/c/${slug}`);
}

function revalidateSectorSurface(cragSlug?: string, sectorSlug?: string): void {
  if (cragSlug) revalidateTag(`crag:${cragSlug}`);
  if (sectorSlug) revalidateTag(`sector:${sectorSlug}`);
  if (cragSlug) revalidatePath(`/c/${cragSlug}`);
}

function revalidateBoulderSurface(boulderId?: string, cragSlug?: string, sectorSlug?: string): void {
  if (boulderId) revalidateTag(`boulder:${boulderId}`);
  if (cragSlug) revalidateTag(`crag:${cragSlug}`);
  if (sectorSlug) revalidateTag(`sector:${sectorSlug}`);
  if (cragSlug) revalidatePath(`/c/${cragSlug}`);
}

function revalidateTopoSurface(boulderId?: string, topoId?: string, cragSlug?: string): void {
  if (boulderId) revalidateTag(`boulder:${boulderId}`);
  if (topoId) revalidatePath(`/topos/${topoId}`);
  if (cragSlug) revalidatePath(`/c/${cragSlug}`);
}

function revalidateRouteSurface(routeId?: string, boulderId?: string, cragSlug?: string, topoId?: string): void {
  if (routeId) revalidateTag(`route:${routeId}`);
  if (boulderId) revalidateTag(`boulder:${boulderId}`);
  if (cragSlug) revalidateTag(`crag:${cragSlug}`);
  if (routeId) revalidatePath(`/r/${routeId}`);
  if (topoId) revalidatePath(`/topos/${topoId}`);
  if (cragSlug) revalidatePath(`/c/${cragSlug}`);
}

// ---------------------------------------------------------------------------
// Save (upsert) actions
// ---------------------------------------------------------------------------

export async function saveAreaAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = parseAreaForm(Object.fromEntries(formData));
  let id = parsed.id ?? `area_${parsed.slug}`;

  if (!parsed.id) {
    const resolved = await resolveSlugConflict({ generatedId: id, table: "areas", slug: parsed.slug });
    id = resolved.id;

    await upsertArea({ ...parsed, id });

    // If we reused a soft-deleted row id, clear its deleted_at.
    if (resolved.reusedDeletedRow) {
      await restoreContent({ table: "areas", id });
    }
  } else {
    await upsertArea({ ...parsed, id });
  }

  await auditLog({ adminId: admin.adminId, action: "content.upsert", targetType: "area", targetId: id, metadata: { slug: parsed.slug } });
  revalidateAreaSurface();
}

export async function saveCragAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = parseCragForm(Object.fromEntries(formData));
  let id = parsed.id ?? `crag_${parsed.slug}`;

  if (!parsed.id) {
    const resolved = await resolveSlugConflict({ generatedId: id, table: "crags", slug: parsed.slug });
    id = resolved.id;

    await upsertCrag({ ...parsed, id });

    // Non-atomic: D1 HTTP has no transaction support, so upsert and restore are separate calls.
    // This is acceptable for the admin path because the upsert is the source of truth; a crash
    // between upsert and restore would leave the row updated-but-soft-deleted, which a re-save resolves.
    if (resolved.reusedDeletedRow) {
      await restoreContent({ table: "crags", id });
    }
  } else {
    await upsertCrag({ ...parsed, id });
  }

  await auditLog({ adminId: admin.adminId, action: "content.upsert", targetType: "crag", targetId: id, metadata: { slug: parsed.slug } });
  revalidateCragSurface(parsed.slug);
}

export async function saveSectorAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = parseSectorForm(Object.fromEntries(formData));
  let id = parsed.id ?? `sector_${randomUUID()}`;

  if (!parsed.id) {
    const resolved = await resolveSlugConflict({
      generatedId: id,
      table: "sectors",
      slug: parsed.slug,
      parentColumn: "crag_id",
      parentId: parsed.cragId,
    });
    id = resolved.id;

    await upsertSector({ ...parsed, id });

    if (resolved.reusedDeletedRow) {
      await restoreContent({ table: "sectors", id });
    }
  } else {
    await upsertSector({ ...parsed, id });
  }

  // Resolve cragSlug from DB — authoritative regardless of hidden form fields.
  const cragSlug = await getCragSlugByCragId(parsed.cragId);
  await auditLog({ adminId: admin.adminId, action: "content.upsert", targetType: "sector", targetId: id, metadata: { slug: parsed.slug } });
  revalidateSectorSurface(cragSlug ?? undefined, parsed.slug);
}

export async function saveBoulderAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = parseBoulderForm(Object.fromEntries(formData));
  let id = parsed.id ?? `boulder_${randomUUID()}`;

  if (!parsed.id) {
    const resolved = await resolveSlugConflict({
      generatedId: id,
      table: "boulders",
      slug: parsed.slug,
      parentColumn: "sector_id",
      parentId: parsed.sectorId,
    });
    id = resolved.id;

    await upsertBoulder({ ...parsed, id });

    if (resolved.reusedDeletedRow) {
      await restoreContent({ table: "boulders", id });
    }
  } else {
    await upsertBoulder({ ...parsed, id });
  }

  // Resolve ancestry from DB — authoritative regardless of hidden form fields.
  const sectorAncestry = await getSectorAncestry(parsed.sectorId);
  await auditLog({ adminId: admin.adminId, action: "content.upsert", targetType: "boulder", targetId: id, metadata: { slug: parsed.slug } });
  revalidateBoulderSurface(id, sectorAncestry?.cragSlug, sectorAncestry?.sectorSlug);
}

export async function saveTopoAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = parseTopoForm(Object.fromEntries(formData));
  // Topos have no slug — use provided id or generate a UUID-based one.
  const id = parsed.id ?? `topo_${randomUUID()}`;

  await upsertTopo({ ...parsed, id });

  // Resolve ancestry from DB — authoritative regardless of hidden form fields.
  const boulderAncestry = await getBoulderAncestry(parsed.boulderId);
  await auditLog({ adminId: admin.adminId, action: "content.upsert", targetType: "topo", targetId: id, metadata: { boulderId: parsed.boulderId } });
  revalidateTopoSurface(parsed.boulderId, id, boulderAncestry?.cragSlug);
}

export async function saveRouteAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = parseRouteForm(Object.fromEntries(formData));
  // topoId is already in parsed (required schema field) — use it for path revalidation too.
  let id = parsed.id ?? `route_${randomUUID()}`;

  if (!parsed.id) {
    const resolved = await resolveSlugConflict({
      generatedId: id,
      table: "routes",
      slug: parsed.slug,
      parentColumn: "topo_id",
      parentId: parsed.topoId,
    });
    id = resolved.id;

    await upsertRoute({ ...parsed, id });

    if (resolved.reusedDeletedRow) {
      await restoreContent({ table: "routes", id });
    }
  } else {
    await upsertRoute({ ...parsed, id });
  }

  // Resolve ancestry from DB — authoritative regardless of hidden form fields.
  const topoAncestry = await getTopoAncestry(parsed.topoId);
  await auditLog({ adminId: admin.adminId, action: "content.upsert", targetType: "route", targetId: id, metadata: { slug: parsed.slug } });
  revalidateRouteSurface(id, topoAncestry?.boulderId, topoAncestry?.cragSlug, parsed.topoId);
}

// ---------------------------------------------------------------------------
// Soft-delete confirm guard
// ---------------------------------------------------------------------------

function assertDeleteConfirm(formData: FormData): void {
  if (formData.get("confirm") !== "DELETE") {
    throw new Error('Type "DELETE" to confirm deletion');
  }
}

// ---------------------------------------------------------------------------
// Soft-delete actions
// ---------------------------------------------------------------------------

export async function softDeleteAreaAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  assertDeleteConfirm(formData);
  const id = String(formData.get("id") ?? "");

  await softDeleteContent({ table: "areas", id });
  await auditLog({ adminId: admin.adminId, action: "content.soft_delete", targetType: "area", targetId: id });
  revalidateAreaSurface();
}

export async function softDeleteCragAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  assertDeleteConfirm(formData);
  const id = String(formData.get("id") ?? "");
  const slug = String(formData.get("slug") ?? "") || undefined;

  await softDeleteContent({ table: "crags", id });
  await auditLog({ adminId: admin.adminId, action: "content.soft_delete", targetType: "crag", targetId: id });
  revalidateCragSurface(slug);
}

export async function softDeleteSectorAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  assertDeleteConfirm(formData);
  const id = String(formData.get("id") ?? "");

  await softDeleteContent({ table: "sectors", id });

  // Resolve ancestry from DB — authoritative regardless of hidden form fields.
  const ancestry = await getSectorAncestry(id);
  await auditLog({ adminId: admin.adminId, action: "content.soft_delete", targetType: "sector", targetId: id });
  revalidateSectorSurface(ancestry?.cragSlug, ancestry?.sectorSlug);
}

export async function softDeleteBoulderAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  assertDeleteConfirm(formData);
  const id = String(formData.get("id") ?? "");

  await softDeleteContent({ table: "boulders", id });

  // Resolve ancestry from DB — authoritative regardless of hidden form fields.
  const ancestry = await getBoulderAncestry(id);
  await auditLog({ adminId: admin.adminId, action: "content.soft_delete", targetType: "boulder", targetId: id });
  revalidateBoulderSurface(id, ancestry?.cragSlug, ancestry?.sectorSlug);
}

export async function softDeleteTopoAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  assertDeleteConfirm(formData);
  const id = String(formData.get("id") ?? "");

  await softDeleteContent({ table: "topos", id });

  // Resolve ancestry from DB — authoritative regardless of hidden form fields.
  const ancestry = await getTopoAncestry(id);
  await auditLog({ adminId: admin.adminId, action: "content.soft_delete", targetType: "topo", targetId: id });
  revalidateTopoSurface(ancestry?.boulderId, id, ancestry?.cragSlug);
}

export async function softDeleteRouteAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  assertDeleteConfirm(formData);
  const id = String(formData.get("id") ?? "");

  await softDeleteContent({ table: "routes", id });

  // Resolve ancestry from DB — authoritative regardless of hidden form fields.
  const ancestry = await getRouteAncestry(id);
  await auditLog({ adminId: admin.adminId, action: "content.soft_delete", targetType: "route", targetId: id });
  revalidateRouteSurface(id, ancestry?.boulderId, ancestry?.cragSlug, ancestry?.topoId);
}

// ---------------------------------------------------------------------------
// Restore actions
// ---------------------------------------------------------------------------

export async function restoreAreaAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  await restoreContent({ table: "areas", id });
  await auditLog({ adminId: admin.adminId, action: "content.restore", targetType: "area", targetId: id });
  revalidateAreaSurface();
}

export async function restoreCragAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const slug = String(formData.get("slug") ?? "") || undefined;

  await restoreContent({ table: "crags", id });
  await auditLog({ adminId: admin.adminId, action: "content.restore", targetType: "crag", targetId: id });
  revalidateCragSurface(slug);
}

export async function restoreSectorAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  await restoreContent({ table: "sectors", id });

  // Resolve ancestry from DB — authoritative regardless of hidden form fields.
  const ancestry = await getSectorAncestry(id);
  await auditLog({ adminId: admin.adminId, action: "content.restore", targetType: "sector", targetId: id });
  revalidateSectorSurface(ancestry?.cragSlug, ancestry?.sectorSlug);
}

export async function restoreBoulderAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  await restoreContent({ table: "boulders", id });

  // Resolve ancestry from DB — authoritative regardless of hidden form fields.
  const ancestry = await getBoulderAncestry(id);
  await auditLog({ adminId: admin.adminId, action: "content.restore", targetType: "boulder", targetId: id });
  revalidateBoulderSurface(id, ancestry?.cragSlug, ancestry?.sectorSlug);
}

export async function restoreTopoAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  await restoreContent({ table: "topos", id });

  // Resolve ancestry from DB — authoritative regardless of hidden form fields.
  const ancestry = await getTopoAncestry(id);
  await auditLog({ adminId: admin.adminId, action: "content.restore", targetType: "topo", targetId: id });
  revalidateTopoSurface(ancestry?.boulderId, id, ancestry?.cragSlug);
}

export async function restoreRouteAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  await restoreContent({ table: "routes", id });

  // Resolve ancestry from DB — authoritative regardless of hidden form fields.
  const ancestry = await getRouteAncestry(id);
  await auditLog({ adminId: admin.adminId, action: "content.restore", targetType: "route", targetId: id });
  revalidateRouteSurface(id, ancestry?.boulderId, ancestry?.cragSlug, ancestry?.topoId);
}

// ---------------------------------------------------------------------------
// Publish toggle action
// ---------------------------------------------------------------------------

export async function togglePublishAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const table = String(formData.get("table") ?? "");
  const id = String(formData.get("id") ?? "");
  const isPublished = formData.get("isPublished") === "on" || formData.get("isPublished") === "true";

  if (!ALLOWED_TOGGLE_TABLES.includes(table as ToggleTable)) {
    throw new Error(`Unsupported table: ${table}`);
  }

  const validTable = table as ToggleTable;

  await updatePublishState({
    table: validTable,
    id,
    isPublished,
  });

  await auditLog({
    adminId: admin.adminId,
    action: "content.publish_toggle",
    targetType: SINGULAR_BY_TABLE[validTable],
    targetId: id,
    metadata: { isPublished },
  });

  // Invalidate the authoritative surface for the affected entity, resolved from D1.
  switch (validTable) {
    case "areas":
      revalidateAreaSurface();
      break;
    case "crags": {
      const slug = await getCragSlugByCragId(id);
      revalidateCragSurface(slug ?? undefined);
      break;
    }
    case "sectors": {
      const a = await getSectorAncestry(id);
      revalidateSectorSurface(a?.cragSlug, a?.sectorSlug);
      break;
    }
    case "boulders": {
      const a = await getBoulderAncestry(id);
      revalidateBoulderSurface(id, a?.cragSlug, a?.sectorSlug);
      break;
    }
    case "topos": {
      const a = await getTopoAncestry(id);
      revalidateTopoSurface(a?.boulderId, id, a?.cragSlug);
      break;
    }
    case "routes": {
      const a = await getRouteAncestry(id);
      revalidateRouteSurface(id, a?.boulderId, a?.cragSlug, a?.topoId);
      break;
    }
    case "announcements":
      revalidateAreaSurface(); // home + areas:list + /
      break;
  }
}
