/**
 * import-content-workbook.ts — Granite Phase 2 SQL generator.
 *
 * Usage:
 *   node scripts/import-content-workbook.ts \
 *     docs/data/granite-v2-workbook.json \
 *     migrations/0002_import_v1_content.sql
 *
 * Reads the JSON snapshot, validates with Zod, resolves FKs, and emits
 * INSERT statements for: areas, crags, sectors, boulders, topos, routes.
 */

import fs from "node:fs";
import path from "node:path";

import {
  AreaRowSchema,
  BoulderRowSchema,
  CragRowSchema,
  RouteRowSchema,
  SectorRowSchema,
  TopoRowSchema,
  WorkbookSnapshotSchema,
} from "../lib/db/import-schema.ts";
import {
  buildId,
  normalizeSlug,
  parseBooleanCell,
  parseGradeNum,
  parseHashtagsJson,
} from "../lib/db/import-normalize.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fail(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

/**
 * Escapes a string value for SQL: doubles single quotes and wraps in quotes.
 */
function sqlStr(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Renders a value for SQL: NULL, unquoted number, or quoted string.
 */
function sqlVal(value: string | number | null): string {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  return sqlStr(value);
}

/**
 * Returns current ISO datetime string for created_at / updated_at placeholders.
 * Using a fixed sentinel so the migration is deterministic/reproducible.
 */
const NOW_SENTINEL = "2026-05-28T00:00:00";

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function assertSlugNormalized(slug: string, context: string): void {
  if (normalizeSlug(slug) !== slug) {
    fail(
      `Slug is not normalized at ${context}: "${slug}" → expected "${normalizeSlug(slug)}"`,
    );
  }
}

function assertNoduplicateIds(ids: string[], entity: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      fail(`Duplicate generated ID in ${entity}: "${id}"`);
    }
    seen.add(id);
  }
}

const CDN_BASE = (process.env.CDN_BASE_URL ?? "https://cdn.granite.kr").replace(
  /\/+$/,
  "",
);

/**
 * Validates a staged `/images/...` path and converts it to its production CDN
 * webp URL. The staging path mirrors the R2 key, and originals are uploaded as
 * webp, so only the extension changes.
 *   "/images/boulders/x/cover.jpg" -> "https://cdn.granite.kr/boulders/x/cover.webp"
 * Empty input returns "".
 */
function resolveImageUrl(
  url: string | null,
  field: string,
  context: string,
): string {
  if (!url) return "";
  if (!url.startsWith("/images/")) {
    fail(
      `Image URL policy violation at ${context} [${field}]: "${url}" must start with /images/`,
    );
  }
  const key = url.replace(/^\/images\//, "").replace(/\.[^./]+$/, ".webp");
  return `${CDN_BASE}/${key}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error(
    "Usage: node scripts/import-content-workbook.ts <input.json> <output.sql>",
  );
  process.exit(1);
}

const [jsonPath, sqlPath] = args;

// 1. Read + parse JSON snapshot
const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as unknown;

// 2. Validate with Zod
const parseResult = WorkbookSnapshotSchema.safeParse(raw);
if (!parseResult.success) {
  console.error("Zod validation errors:");
  console.error(parseResult.error.toString());
  process.exit(1);
}
const snapshot = parseResult.data;

// ---------------------------------------------------------------------------
// 3. Process Areas
// ---------------------------------------------------------------------------

interface AreaRecord {
  id: string;
  slug: string;
  name: string;
  name_en: string | null;
  cover_image_url: string;
  is_published: number;
  sort_order: number;
}

const areaBySlug = new Map<string, AreaRecord>();
const areaRows: AreaRecord[] = [];

for (const [rowIdx, row] of snapshot.areas.entries()) {
  assertSlugNormalized(row.slug, `areas[${rowIdx}]`);

  const id = buildId("area", row.slug);
  // Areas sheet has no is_published column → default to 1 (published)
  // Areas sheet has no cover_image_url column → default to empty string
  const record: AreaRecord = {
    id,
    slug: row.slug,
    name: row.name,
    name_en: row.name_en ?? null,
    cover_image_url: "",
    is_published: 1,
    sort_order: row.sort_order ?? rowIdx + 1,
  };
  areaBySlug.set(row.slug, record);
  areaRows.push(record);
}
assertNoduplicateIds(areaRows.map((r) => r.id), "areas");

// ---------------------------------------------------------------------------
// 4. Process Crags
// ---------------------------------------------------------------------------

interface CragRecord {
  id: string;
  area_id: string;
  slug: string;
  name: string;
  name_en: string | null;
  lat: number | null;
  lng: number | null;
  description: string;
  season: string;
  cover_image_url: string;
  is_published: number;
  sort_order: number;
}

const cragBySlug = new Map<string, CragRecord>();
const cragRows: CragRecord[] = [];

// Track per-area sort order counter
const cragSortCounters = new Map<string, number>();

for (const [rowIdx, row] of snapshot.crags.entries()) {
  assertSlugNormalized(row.slug, `crags[${rowIdx}]`);

  const area = areaBySlug.get(row.area_slug);
  if (!area) {
    fail(`crags[${rowIdx}] slug="${row.slug}": unresolved area_slug="${row.area_slug}"`);
  }

  // sort_order: derive sequentially per-area
  const prevCount = cragSortCounters.get(row.area_slug) ?? 0;
  const sort_order = prevCount + 1;
  cragSortCounters.set(row.area_slug, sort_order);

  // description: use description column, fall back to summary if description is empty
  const description = row.description || row.summary || "";

  const coverUrl = resolveImageUrl(
    row.cover_image_url ?? "",
    "cover_image_url",
    `crags[${rowIdx}] slug="${row.slug}"`,
  );

  // is_published: use cell; empty → treat as published (preview assumption)
  // Assumption: empty is_published cell in crags/sectors/boulders/routes treated as published=1 for preview import.
  const is_published = parseBooleanCell(row.is_published ?? "TRUE") ? 1 : 0;

  const record: CragRecord = {
    id: buildId("crag", row.slug),
    area_id: area.id,
    slug: row.slug,
    name: row.name,
    name_en: row.name_en ?? null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    description,
    season: row.season ?? "",
    cover_image_url: coverUrl,
    is_published,
    sort_order,
  };
  cragBySlug.set(row.slug, record);
  cragRows.push(record);
}
assertNoduplicateIds(cragRows.map((r) => r.id), "crags");

// ---------------------------------------------------------------------------
// 5. Process Sectors
// ---------------------------------------------------------------------------

interface SectorRecord {
  id: string;
  crag_id: string;
  slug: string;
  name: string;
  name_en: string | null;
  lat: number | null;
  lng: number | null;
  description: string;
  season: string;
  cover_image_url: string;
  is_published: number;
  sort_order: number;
}

const sectorBySlug = new Map<string, SectorRecord>();
const sectorRows: SectorRecord[] = [];
const sectorSortCounters = new Map<string, number>();

for (const [rowIdx, row] of snapshot.sectors.entries()) {
  assertSlugNormalized(row.slug, `sectors[${rowIdx}]`);

  const crag = cragBySlug.get(row.crag_slug);
  if (!crag) {
    fail(`sectors[${rowIdx}] slug="${row.slug}": unresolved crag_slug="${row.crag_slug}"`);
  }

  const prevCount = sectorSortCounters.get(row.crag_slug) ?? 0;
  const sort_order = prevCount + 1;
  sectorSortCounters.set(row.crag_slug, sort_order);

  const coverUrl = resolveImageUrl(
    row.cover_image_url ?? "",
    "cover_image_url",
    `sectors[${rowIdx}] slug="${row.slug}"`,
  );

  // Assumption: empty is_published cell treated as published=1 for preview import.
  const is_published = parseBooleanCell(row.is_published ?? "TRUE") ? 1 : 0;

  const record: SectorRecord = {
    id: buildId("sector", row.slug),
    crag_id: crag.id,
    slug: row.slug,
    name: row.name,
    name_en: row.name_en ?? null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    description: row.description ?? "",
    season: row.season ?? "",
    cover_image_url: coverUrl,
    is_published,
    sort_order,
  };
  sectorBySlug.set(row.slug, record);
  sectorRows.push(record);
}
assertNoduplicateIds(sectorRows.map((r) => r.id), "sectors");

// ---------------------------------------------------------------------------
// 6. Process Boulders
// ---------------------------------------------------------------------------

interface BoulderRecord {
  id: string;
  sector_id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  hashtags: string;
  cover_image_url: string;
  is_published: number;
  sort_order: number;
}

const boulderBySlug = new Map<string, BoulderRecord>();
const boulderRows: BoulderRecord[] = [];
const boulderSortCounters = new Map<string, number>();

for (const [rowIdx, row] of snapshot.boulders.entries()) {
  assertSlugNormalized(row.slug, `boulders[${rowIdx}]`);

  const sector = sectorBySlug.get(row.sector_slug);
  if (!sector) {
    fail(
      `boulders[${rowIdx}] slug="${row.slug}": unresolved sector_slug="${row.sector_slug}"`,
    );
  }

  // Boulders require lat/lng
  if (row.lat === null || row.lat === undefined) {
    fail(`boulders[${rowIdx}] slug="${row.slug}": missing required lat`);
  }
  if (row.lng === null || row.lng === undefined) {
    fail(`boulders[${rowIdx}] slug="${row.slug}": missing required lng`);
  }

  const prevCount = boulderSortCounters.get(row.sector_slug) ?? 0;
  const sort_order = prevCount + 1;
  boulderSortCounters.set(row.sector_slug, sort_order);

  const coverUrl = resolveImageUrl(
    row.cover_image_url ?? "",
    "cover_image_url",
    `boulders[${rowIdx}] slug="${row.slug}"`,
  );

  // Assumption: empty is_published cell treated as published=1 for preview import.
  const is_published = parseBooleanCell(row.is_published ?? "TRUE") ? 1 : 0;

  const record: BoulderRecord = {
    id: buildId("boulder", row.slug),
    sector_id: sector.id,
    slug: row.slug,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    hashtags: parseHashtagsJson(row.hashtags),
    cover_image_url: coverUrl,
    is_published,
    sort_order,
  };
  boulderBySlug.set(row.slug, record);
  boulderRows.push(record);
}
assertNoduplicateIds(boulderRows.map((r) => r.id), "boulders");

// ---------------------------------------------------------------------------
// 7. Process Topos
// ---------------------------------------------------------------------------

interface TopoRecord {
  id: string;
  boulder_id: string;
  slug: string;
  name: string;
  base_image_url: string;
  is_published: number;
  sort_order: number;
}

const topoBySlug = new Map<string, TopoRecord>();
const topoRows: TopoRecord[] = [];

for (const [rowIdx, row] of snapshot.topos.entries()) {
  assertSlugNormalized(row.slug, `topos[${rowIdx}]`);

  const boulder = boulderBySlug.get(row.boulder_slug);
  if (!boulder) {
    fail(
      `topos[${rowIdx}] slug="${row.slug}": unresolved boulder_slug="${row.boulder_slug}"`,
    );
  }

  const baseUrl = resolveImageUrl(
    row.base_image_url ?? "",
    "base_image_url",
    `topos[${rowIdx}] slug="${row.slug}"`,
  );

  // Topos sheet has no is_published column → default to 1 (published)
  const is_published = 1;
  const sort_order = row.sort_order ?? rowIdx + 1;

  const record: TopoRecord = {
    id: buildId("topo", row.slug),
    boulder_id: boulder.id,
    slug: row.slug,
    name: row.name,
    base_image_url: baseUrl,
    is_published,
    sort_order,
  };
  topoBySlug.set(row.slug, record);
  topoRows.push(record);
}
assertNoduplicateIds(topoRows.map((r) => r.id), "topos");

// ---------------------------------------------------------------------------
// 8. Process Routes
// ---------------------------------------------------------------------------

interface RouteRecord {
  id: string;
  topo_id: string;
  slug: string;
  name: string;
  grade: string;
  grade_num: number;
  fa: string;
  description: string;
  line_image_url: string;
  is_published: number;
  sort_order: number;
}

const routeRows: RouteRecord[] = [];
const routeSortCounters = new Map<string, number>();

for (const [rowIdx, row] of snapshot.routes.entries()) {
  assertSlugNormalized(row.slug, `routes[${rowIdx}]`);

  const topo = topoBySlug.get(row.topo_slug);
  if (!topo) {
    fail(
      `routes[${rowIdx}] slug="${row.slug}": unresolved topo_slug="${row.topo_slug}"`,
    );
  }

  // 5. Validate boulder_slug consistency (validation only — not persisted)
  if (row.boulder_slug) {
    const boulderId = buildId("boulder", row.boulder_slug);
    if (topo.boulder_id !== boulderId) {
      fail(
        `routes[${rowIdx}] slug="${row.slug}": boulder_slug mismatch — ` +
          `workbook says "${row.boulder_slug}" (id=${boulderId}) but ` +
          `topo.boulder_id="${topo.boulder_id}"`,
      );
    }
  }

  // grade_num validation: compute from grade and assert match if workbook provides it
  let grade_num: number;
  try {
    grade_num = parseGradeNum(row.grade);
  } catch (e) {
    fail(`routes[${rowIdx}] slug="${row.slug}": ${(e as Error).message}`);
  }
  if (row.grade_num !== null && row.grade_num !== undefined) {
    if (row.grade_num !== grade_num) {
      fail(
        `routes[${rowIdx}] slug="${row.slug}": grade_num mismatch — ` +
          `workbook has ${row.grade_num}, computed from grade="${row.grade}" is ${grade_num}`,
      );
    }
  }

  const prevCount = routeSortCounters.get(row.topo_slug) ?? 0;
  const sort_order = prevCount + 1;
  routeSortCounters.set(row.topo_slug, sort_order);

  const lineUrl = resolveImageUrl(
    row.line_image_url ?? "",
    "line_image_url",
    `routes[${rowIdx}] slug="${row.slug}"`,
  );

  // Assumption: empty is_published cell treated as published=1 for preview import.
  const is_published = parseBooleanCell(row.is_published ?? "TRUE") ? 1 : 0;

  // Routes table has no name_en column; ignore workbook name_en.
  const record: RouteRecord = {
    id: buildId("route", row.slug),
    topo_id: topo.id,
    slug: row.slug,
    name: row.name,
    grade: row.grade,
    grade_num,
    fa: row.fa ?? "",
    description: row.description ?? "",
    line_image_url: lineUrl,
    is_published,
    sort_order,
  };
  routeRows.push(record);
}
assertNoduplicateIds(routeRows.map((r) => r.id), "routes");

// ---------------------------------------------------------------------------
// 9. Generate SQL
// ---------------------------------------------------------------------------

const lines: string[] = [];

lines.push("-- Granite Phase 2 — v1 content seed");
lines.push("-- Generated by scripts/import-content-workbook.ts");
lines.push(`-- Source: ${path.basename(jsonPath)}`);
lines.push(`-- Date:   ${NOW_SENTINEL}`);
lines.push("");

// --- areas ---
lines.push("-- areas");
for (const r of areaRows) {
  lines.push(
    `INSERT INTO areas (id, name, name_en, slug, cover_image_url, is_published, sort_order, created_at, updated_at) VALUES (` +
      [
        sqlVal(r.id),
        sqlVal(r.name),
        sqlVal(r.name_en),
        sqlVal(r.slug),
        sqlVal(r.cover_image_url),
        r.is_published,
        r.sort_order,
        sqlVal(NOW_SENTINEL),
        sqlVal(NOW_SENTINEL),
      ].join(", ") +
      ");",
  );
}
lines.push("");

// --- crags ---
lines.push("-- crags");
for (const r of cragRows) {
  lines.push(
    `INSERT INTO crags (id, area_id, name, name_en, slug, lat, lng, description, season, cover_image_url, is_published, sort_order, created_at, updated_at) VALUES (` +
      [
        sqlVal(r.id),
        sqlVal(r.area_id),
        sqlVal(r.name),
        sqlVal(r.name_en),
        sqlVal(r.slug),
        sqlVal(r.lat),
        sqlVal(r.lng),
        sqlVal(r.description),
        sqlVal(r.season),
        sqlVal(r.cover_image_url),
        r.is_published,
        r.sort_order,
        sqlVal(NOW_SENTINEL),
        sqlVal(NOW_SENTINEL),
      ].join(", ") +
      ");",
  );
}
lines.push("");

// --- sectors ---
lines.push("-- sectors");
for (const r of sectorRows) {
  lines.push(
    `INSERT INTO sectors (id, crag_id, name, name_en, slug, lat, lng, description, season, cover_image_url, is_published, sort_order, created_at, updated_at) VALUES (` +
      [
        sqlVal(r.id),
        sqlVal(r.crag_id),
        sqlVal(r.name),
        sqlVal(r.name_en),
        sqlVal(r.slug),
        sqlVal(r.lat),
        sqlVal(r.lng),
        sqlVal(r.description),
        sqlVal(r.season),
        sqlVal(r.cover_image_url),
        r.is_published,
        r.sort_order,
        sqlVal(NOW_SENTINEL),
        sqlVal(NOW_SENTINEL),
      ].join(", ") +
      ");",
  );
}
lines.push("");

// --- boulders ---
lines.push("-- boulders");
for (const r of boulderRows) {
  lines.push(
    `INSERT INTO boulders (id, sector_id, name, slug, lat, lng, hashtags, cover_image_url, is_published, sort_order, created_at, updated_at) VALUES (` +
      [
        sqlVal(r.id),
        sqlVal(r.sector_id),
        sqlVal(r.name),
        sqlVal(r.slug),
        r.lat,
        r.lng,
        sqlVal(r.hashtags),
        sqlVal(r.cover_image_url),
        r.is_published,
        r.sort_order,
        sqlVal(NOW_SENTINEL),
        sqlVal(NOW_SENTINEL),
      ].join(", ") +
      ");",
  );
}
lines.push("");

// --- topos ---
lines.push("-- topos");
for (const r of topoRows) {
  lines.push(
    `INSERT INTO topos (id, boulder_id, name, base_image_url, is_published, sort_order, created_at, updated_at) VALUES (` +
      [
        sqlVal(r.id),
        sqlVal(r.boulder_id),
        sqlVal(r.name),
        sqlVal(r.base_image_url),
        r.is_published,
        r.sort_order,
        sqlVal(NOW_SENTINEL),
        sqlVal(NOW_SENTINEL),
      ].join(", ") +
      ");",
  );
}
lines.push("");

// --- routes ---
lines.push("-- routes");
for (const r of routeRows) {
  lines.push(
    `INSERT INTO routes (id, topo_id, name, slug, grade, grade_num, fa, description, line_image_url, is_published, sort_order, created_at, updated_at) VALUES (` +
      [
        sqlVal(r.id),
        sqlVal(r.topo_id),
        sqlVal(r.name),
        sqlVal(r.slug),
        sqlVal(r.grade),
        r.grade_num,
        sqlVal(r.fa),
        sqlVal(r.description),
        sqlVal(r.line_image_url),
        r.is_published,
        r.sort_order,
        sqlVal(NOW_SENTINEL),
        sqlVal(NOW_SENTINEL),
      ].join(", ") +
      ");",
  );
}
lines.push("");

// ---------------------------------------------------------------------------
// 10. Write output
// ---------------------------------------------------------------------------

const sqlOutput = lines.join("\n");
fs.mkdirSync(path.dirname(sqlPath), { recursive: true });
fs.writeFileSync(sqlPath, sqlOutput, "utf-8");

const counts = {
  areas:    areaRows.length,
  crags:    cragRows.length,
  sectors:  sectorRows.length,
  boulders: boulderRows.length,
  topos:    topoRows.length,
  routes:   routeRows.length,
};
console.log("Inserted counts:", counts);
console.log(`\nWrote ${sqlPath}`);
