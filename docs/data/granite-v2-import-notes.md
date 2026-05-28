# Granite v2 Data Import Notes

Phase 2 data migration contract: cleanup, validation, and import specification.

## Slug Convention & ID Generation

- **Slug format**: lowercase `snake_case` only
- **Numeric-leading slugs**: explicitly allowed (e.g., `3m`)
- **ID generation rule**:
  - Area: `area_${slug}`
  - Crag: `crag_${slug}`
  - Sector: `sector_${slug}`
  - Boulder: `boulder_${slug}`
  - Topo: `topo_${slug}`
  - Route: `route_${slug}`

## Source Data

**Cleaned workbook path**: `docs/data/granite-v2-migration-prep.xlsx`

Import sources (6 sheets only):
- Areas
- Crags
- Sectors
- Boulders
- Topos
- Routes

**Current clean counts** (after blank-row filtering):
| Entity | Count |
|--------|-------|
| Areas | 5 |
| Crags | 6 |
| Sectors | 14 |
| Boulders | 31 |
| Topos | 50 |
| Routes | 97 |

## Import Tooling

Node xlsx/tsx packages unavailable in sandbox. Workflow:

1. **Export**: Python script `scripts/export-workbook.py` (openpyxl) exports cleaned workbook to JSON snapshot in `docs/data/`
2. **Validate & Generate SQL**: TypeScript script `scripts/import-content-workbook.ts` reads JSON snapshot, performs:
   - Zod validation
   - Normalization (slugs, IDs)
   - Foreign key checks
   - Emits `migrations/0002_import_v1_content.sql`
3. **Execute**: Node native TypeScript support (`node scripts/import-content-workbook.ts ...`), no tsx wrapper needed

## Semantic Review Items (Operator Confirmation Required)

- `hyunchung_boulder_*` topos attach routes to `memorial_boulder`
- `Fat Cat` route attaches to `fatboy_boulder_1` (imports under `fatboy_boulder`)
- Route slug `3m` starts with a number (allowed per slug policy)

## Optional Display Fields (May Remain Empty)

The following columns may be empty strings for preview import; no NULL values:
- `description` (all entities)
- `season` (all entities)
- Image URL columns (all entities)
- Areas: no `cover_image_url` in workbook → default empty string
- Sectors: empty `description`, `season`, `cover_image_url` expected

## Required Schema Changes (Phase 1 → Phase 2)

Apply these changes to align Phase 1 schema with import contract:

**Areas**:
- Add `name_en` (text, nullable)
- Add `cover_image_url` (text, nullable)
- Add `is_published` (boolean, default false)

**Crags**:
- Add `name_en` (text, nullable)
- Rename `summary` → `description`
- Remove `access_desc`
- Remove `parking_desc`
- Add `is_published` (boolean, default false)
- Add `sort_order` (integer, nullable)

**Sectors**:
- Add `name_en` (text, nullable)
- Rename `summary` → `description`
- Remove `access_desc`
- Remove `parking_desc`
- Add `is_published` (boolean, default false)
- Add `sort_order` (integer, nullable)
- Add `cover_image_url` (text, nullable)

**Boulders**:
- Remove `coord_precision`
- Remove `rock_type`
- Add `is_published` (boolean, default false)
- Add `sort_order` (integer, nullable)

**Topos**:
- Add `is_published` (boolean, default false)
- Add `sort_order` (integer, nullable)

**Routes**:
- Add `is_published` (boolean, default false)
- Add `sort_order` (integer, nullable)
- **Note**: `routes` table does NOT include `boulder_id`. Boulder context derived via: `routes.topo_id → topos.boulder_id`

## Image URL Policy

- **Local/preview imports**: Use local paths `/images/{entity}/{slug}/{purpose}.{ext}`
- **Production imports**: Use CDN URLs (`https://cdn.granite.kr/...`) or CDN-compatible paths for Cloudflare image loader
- **Never store**: Private R2 URLs, signed URLs, or raw S3 endpoint URLs

## Image Staging Status (Referenced Images)

Current local image count:
| Entity | Count |
|--------|-------|
| Areas | 0 |
| Crags | 6 |
| Boulders | 31 |
| Topos | 50 |
| Routes | 8 |
| Routes (unmapped) | 25 |

**Unmapped routes**: 25 route-like images in `docs/data/images/routes/unmapped/` excluded from import until manually matched to route records.

## Notes

- This document records the exact import contract for Phase 2 data migration
- All counts reflect cleaned workbook state (blank rows removed)
- Schema changes must be applied before running import script
- Operator must confirm semantic review items before production import
