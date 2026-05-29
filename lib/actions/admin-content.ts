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
// Returns the resolved id to use for the upsert.
// Side effect: if a soft-deleted row is found, calls restoreContent on it.
// ---------------------------------------------------------------------------

async function resolveSlugConflict(input: {
  generatedId: string;
  table: "areas" | "crags" | "sectors" | "boulders" | "routes";
  slug: string;
  parentColumn?: string;
  parentId?: string;
}): Promise<string> {
  const existing = await findRowBySlug({
    table: input.table,
    slug: input.slug,
    parentColumn: input.parentColumn,
    parentId: input.parentId,
  });

  if (!existing) {
    return input.generatedId;
  }

  if (existing.deleted_at !== null) {
    // Soft-deleted row: reuse its id so the upsert updates it.
    // restoreContent is called AFTER the upsert in the save action.
    return existing.id;
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
    id = await resolveSlugConflict({ generatedId: id, table: "areas", slug: parsed.slug });
  }

  await upsertArea({ ...parsed, id });

  // If we reused a soft-deleted row id, clear its deleted_at.
  if (!parsed.id && id !== `area_${parsed.slug}`) {
    await restoreContent({ table: "areas", id });
  }

  await auditLog({ adminId: admin.adminId, action: "content.upsert", targetType: "area", targetId: id, metadata: { slug: parsed.slug } });
  revalidateAreaSurface();
}

export async function saveCragAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = parseCragForm(Object.fromEntries(formData));
  let id = parsed.id ?? `crag_${parsed.slug}`;

  if (!parsed.id) {
    id = await resolveSlugConflict({ generatedId: id, table: "crags", slug: parsed.slug });
  }

  await upsertCrag({ ...parsed, id });

  if (!parsed.id && id !== `crag_${parsed.slug}`) {
    await restoreContent({ table: "crags", id });
  }

  await auditLog({ adminId: admin.adminId, action: "content.upsert", targetType: "crag", targetId: id, metadata: { slug: parsed.slug } });
  revalidateCragSurface(parsed.slug);
}

export async function saveSectorAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = parseSectorForm(Object.fromEntries(formData));
  let id = parsed.id ?? `sector_${parsed.slug}`;

  if (!parsed.id) {
    id = await resolveSlugConflict({
      generatedId: id,
      table: "sectors",
      slug: parsed.slug,
      parentColumn: "crag_id",
      parentId: parsed.cragId,
    });
  }

  await upsertSector({ ...parsed, id });

  if (!parsed.id && id !== `sector_${parsed.slug}`) {
    await restoreContent({ table: "sectors", id });
  }

  await auditLog({ adminId: admin.adminId, action: "content.upsert", targetType: "sector", targetId: id, metadata: { slug: parsed.slug } });
  revalidateSectorSurface(undefined, parsed.slug);
}

export async function saveBoulderAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = parseBoulderForm(Object.fromEntries(formData));
  let id = parsed.id ?? `boulder_${parsed.slug}`;

  if (!parsed.id) {
    id = await resolveSlugConflict({
      generatedId: id,
      table: "boulders",
      slug: parsed.slug,
      parentColumn: "sector_id",
      parentId: parsed.sectorId,
    });
  }

  await upsertBoulder({ ...parsed, id });

  if (!parsed.id && id !== `boulder_${parsed.slug}`) {
    await restoreContent({ table: "boulders", id });
  }

  await auditLog({ adminId: admin.adminId, action: "content.upsert", targetType: "boulder", targetId: id, metadata: { slug: parsed.slug } });
  revalidateBoulderSurface(id);
}

export async function saveTopoAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = parseTopoForm(Object.fromEntries(formData));
  // Topos have no slug — use provided id or generate a UUID-based one.
  const id = parsed.id ?? `topo_${randomUUID()}`;

  await upsertTopo({ ...parsed, id });

  await auditLog({ adminId: admin.adminId, action: "content.upsert", targetType: "topo", targetId: id, metadata: { boulderId: parsed.boulderId } });
  revalidateTopoSurface(parsed.boulderId, id);
}

export async function saveRouteAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = parseRouteForm(Object.fromEntries(formData));
  let id = parsed.id ?? `route_${parsed.slug}`;

  if (!parsed.id) {
    id = await resolveSlugConflict({
      generatedId: id,
      table: "routes",
      slug: parsed.slug,
      parentColumn: "topo_id",
      parentId: parsed.topoId,
    });
  }

  await upsertRoute({ ...parsed, id });

  if (!parsed.id && id !== `route_${parsed.slug}`) {
    await restoreContent({ table: "routes", id });
  }

  await auditLog({ adminId: admin.adminId, action: "content.upsert", targetType: "route", targetId: id, metadata: { slug: parsed.slug } });
  revalidateRouteSurface(id);
}

// ---------------------------------------------------------------------------
// Soft-delete actions
// ---------------------------------------------------------------------------

export async function softDeleteAreaAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  await softDeleteContent({ table: "areas", id });
  await auditLog({ adminId: admin.adminId, action: "content.soft_delete", targetType: "area", targetId: id });
  revalidateAreaSurface();
}

export async function softDeleteCragAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const slug = String(formData.get("slug") ?? "") || undefined;

  await softDeleteContent({ table: "crags", id });
  await auditLog({ adminId: admin.adminId, action: "content.soft_delete", targetType: "crag", targetId: id });
  revalidateCragSurface(slug);
}

export async function softDeleteSectorAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const cragSlug = String(formData.get("cragSlug") ?? "") || undefined;
  const sectorSlug = String(formData.get("slug") ?? "") || undefined;

  await softDeleteContent({ table: "sectors", id });
  await auditLog({ adminId: admin.adminId, action: "content.soft_delete", targetType: "sector", targetId: id });
  revalidateSectorSurface(cragSlug, sectorSlug);
}

export async function softDeleteBoulderAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  await softDeleteContent({ table: "boulders", id });
  await auditLog({ adminId: admin.adminId, action: "content.soft_delete", targetType: "boulder", targetId: id });
  revalidateBoulderSurface(id);
}

export async function softDeleteTopoAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const boulderId = String(formData.get("boulderId") ?? "") || undefined;

  await softDeleteContent({ table: "topos", id });
  await auditLog({ adminId: admin.adminId, action: "content.soft_delete", targetType: "topo", targetId: id });
  revalidateTopoSurface(boulderId, id);
}

export async function softDeleteRouteAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  await softDeleteContent({ table: "routes", id });
  await auditLog({ adminId: admin.adminId, action: "content.soft_delete", targetType: "route", targetId: id });
  revalidateRouteSurface(id);
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
  const cragSlug = String(formData.get("cragSlug") ?? "") || undefined;
  const sectorSlug = String(formData.get("slug") ?? "") || undefined;

  await restoreContent({ table: "sectors", id });
  await auditLog({ adminId: admin.adminId, action: "content.restore", targetType: "sector", targetId: id });
  revalidateSectorSurface(cragSlug, sectorSlug);
}

export async function restoreBoulderAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  await restoreContent({ table: "boulders", id });
  await auditLog({ adminId: admin.adminId, action: "content.restore", targetType: "boulder", targetId: id });
  revalidateBoulderSurface(id);
}

export async function restoreTopoAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const boulderId = String(formData.get("boulderId") ?? "") || undefined;

  await restoreContent({ table: "topos", id });
  await auditLog({ adminId: admin.adminId, action: "content.restore", targetType: "topo", targetId: id });
  revalidateTopoSurface(boulderId, id);
}

export async function restoreRouteAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  await restoreContent({ table: "routes", id });
  await auditLog({ adminId: admin.adminId, action: "content.restore", targetType: "route", targetId: id });
  revalidateRouteSurface(id);
}

// ---------------------------------------------------------------------------
// Publish toggle action
// ---------------------------------------------------------------------------

export async function togglePublishAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const table = String(formData.get("table") ?? "");
  const id = String(formData.get("id") ?? "");
  const isPublished = formData.get("isPublished") === "on" || formData.get("isPublished") === "true";

  // table is validated inside updatePublishState via assertMutableTable.
  await updatePublishState({
    table: table as Parameters<typeof updatePublishState>[0]["table"],
    id,
    isPublished,
  });

  await auditLog({
    adminId: admin.adminId,
    action: "content.publish_toggle",
    targetType: table,
    targetId: id,
    metadata: { isPublished },
  });

  // Over-invalidate safe surfaces — we only know table+id here, not slugs.
  revalidateTag("home");
  revalidateTag("areas:list");
  revalidatePath("/");
}
