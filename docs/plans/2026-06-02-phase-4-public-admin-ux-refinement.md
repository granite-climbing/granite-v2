# Phase 4 Public/Admin UX Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 4 as a focused public/admin UX refinement release before Beta/Instagram work starts.

**Architecture:** Keep the existing Next.js App Router and Server Action architecture. Add canonical short public routes (`/a/<area-slug>`, `/t/<topo-id>`), reuse `lib/db/` read boundaries, keep admin mutations in existing Server Actions, and make UI changes with focused reusable components rather than broad rewrites.

**Tech Stack:** Next.js App Router, React Server Components by default, TypeScript strict, Tailwind CSS, Vitest, Cloudflare D1 HTTP query boundary.

---

## Scope

This plan implements the Phase 4 scope in [docs/ROADMAP.md](../ROADMAP.md).

Canonical public URLs:

- Area detail: `/a/<area-slug>`
- Topo detail: `/t/<topo-id>`
- Route share: `/r/<route-id>` remains and redirects to `/t/<topo-id>?route=<route-id>`

The legacy `/topos/<topo-id>` route is **removed completely** (no redirect). All in-codebase references must be migrated; external clients hitting the old URL will get a 404.

Out of scope:

- 하단 바텀 탭
- 사용자 로그인, 사용자 계정 화면, 마이페이지 확장
- Instagram webhook, manual Beta registration, Beta moderation
- `/me` 페이지 (현재 상태 유지)

## Cross-cutting Decisions

These decisions apply across multiple tasks. Reference them when implementing.

- **URL search param conventions** — All public/admin list filters and sort state live in URL search params (not client state) so back/forward, refresh, and share all work. Param keys use camelCase IDs (`?areaId=...`, `?cragId=...`, `?topoId=...`) to match DB columns and TS types. Search uses `?q=...`. Sort uses `?sort=<field>:<asc|desc>`.
- **Caching/invalidation** — New `area:<slug>` cache tag added. All admin Area mutations (`saveArea`, `togglePublishArea`, `softDeleteArea`, `restoreArea`) call `revalidateTag('area:<slug>')` and `revalidatePath('/a/<slug>')`. Existing tags (`home`, `areas:list`, `crag:<slug>`, etc.) remain unchanged.
- **Kakao Map integration** — Crag Map tab uses [`react-kakao-maps-sdk`](https://react-kakao-maps-sdk.jaeseokim.dev/docs/intro). The SDK is loaded on the client only (`"use client"` boundary). `NEXT_PUBLIC_KAKAO_MAP_KEY` already exists per CLAUDE.md.
- **Admin EditDrawer + sidebar** — Drawer keeps its `fixed inset-0` overlay structure but its z-index/positioning is adjusted so the admin sidebar remains visible (the backdrop covers only the main content area, not the sidebar). No new `/new` or `/edit` routes are introduced; current drawer-routed flows stay.
- **Figma asset extraction** — Use `mcp__Framelink_Figma_MCP__download_figma_images` for icon export. SVGs preferred (Instagram/map/beta icons). Store under `public/images/figma/icons/` with names like `icon-instagram.svg`, `icon-map.svg`, `icon-beta.svg`.

## Figma References

- [Area page `30:734`](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=30-734&t=z7QWEbhfHP7Z4mHh-4)
- [Crag Info `30:889`](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=30-889&t=z7QWEbhfHP7Z4mHh-4)
- [Crag Sector `30:2070`](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=30-2070&t=z7QWEbhfHP7Z4mHh-4)
- [Crag Boulder/Route `30:2155`](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=30-2155&t=z7QWEbhfHP7Z4mHh-4)
- [Search UI `31:2518`](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=31-2518&t=z7QWEbhfHP7Z4mHh-4)
- [Footer Instagram icon `1:186`](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=1-186&t=z7QWEbhfHP7Z4mHh-4)
- [Map icon `1:1420`](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=1-1420&t=z7QWEbhfHP7Z4mHh-4)
- [Beta icon `1:1417`](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=1-1417&t=z7QWEbhfHP7Z4mHh-4)

## File Map

- Modify: `app/(site)/(public)/page.tsx` — home Area/Crag slider entry points, drop chip UI.
- Create: `app/(site)/a/[areaSlug]/page.tsx` — Area detail route + `generateMetadata`.
- Move: `app/(site)/topos/[topoId]/page.tsx` → `app/(site)/t/[topoId]/page.tsx` and delete the old `topos/` directory.
- Modify: `app/(site)/r/[routeId]/page.tsx` — redirect to `/t/<topo-id>?route=<route-id>`.
- Modify: `app/(site)/c/[cragSlug]/page.tsx` — Crag tab refinements, URL-driven search/sort, Kakao Map embed.
- Modify: `app/(site)/layout.tsx` — update comment reference at line 8.
- Modify: `components/public/crag-carousel.tsx`, `components/public/crag-card.tsx`, `components/public/route-table.tsx`, `components/public/boulder-card.tsx`, `components/public/stat-bar.tsx` — public cards, sliders, route table, real grade distribution.
- Create: `components/public/area-card.tsx`, `components/public/search-field.tsx`, `components/public/topo-nav.tsx`, `components/public/kakao-map.tsx` — focused reusable UI.
- Modify: `components/layout/footer.tsx` — Instagram icon.
- Add: `public/images/figma/icons/icon-instagram.svg`, `icon-map.svg`, `icon-beta.svg`.
- Modify: `lib/db/queries.ts`, `lib/db/repository.ts`, `lib/db/schema.ts` — Area detail, all-Crags read, Topo sibling read models, `HomeModel` reshape, comment cleanup.
- Modify: `lib/actions/admin-content.ts` — add `area:<slug>` tag/path revalidation, replace `/topos/<id>` revalidation paths with `/t/<id>`.
- Modify tests: `lib/db/queries.test.ts`, `lib/db/repository.test.ts`, `lib/actions/admin-content.test.ts`, `lib/db/admin-content-queries.test.ts` (fixture URLs).
- Modify admin pages: `app/admin/(protected)/content/{areas,crags,sectors,boulders,topos,routes}/page.tsx`.
- Modify: `components/admin/edit-drawer.tsx` — sidebar-friendly positioning.
- Modify: `components/admin/admin-shell.tsx` — expose sidebar width if needed.
- Create: `components/admin/parent-filter.tsx` — shared parent cascade filter.
- Modify: `lib/db/admin-read-queries.ts`, `lib/db/admin-read-queries.test.ts` — filtered list + parent-option queries.
- Add dep: `react-kakao-maps-sdk`.

---

### Task 1: Canonical Route Shortening

**Files:**
- Move: `app/(site)/topos/[topoId]/page.tsx` → `app/(site)/t/[topoId]/page.tsx`
- Delete: entire `app/(site)/topos/` directory after move
- Modify: `app/(site)/r/[routeId]/page.tsx`
- Modify: `components/public/route-table.tsx`
- Modify: `app/(site)/c/[cragSlug]/page.tsx`
- Modify: `app/(site)/layout.tsx` (comment reference at line 8)
- Modify: `lib/db/queries.ts` (comment reference at ~line 216)
- Modify: `lib/db/admin-content-queries.test.ts` (URL in test fixture, line 190)
- Modify: `lib/actions/admin-content.ts`
- Test: `lib/actions/admin-content.test.ts`

- [x] Replace all user-facing Topo links from `/topos/${topoId}` to `/t/${topoId}`.
- [x] Update route share redirect from `/topos/${route.topoId}?route=${route.id}` to `/t/${route.topoId}?route=${route.id}`.
- [x] Update admin revalidation paths from `/topos/<id>` to `/t/<id>`.
- [x] Update tests that assert `revalidatePath("/topos/...")` to assert `revalidatePath("/t/...")`.
- [x] Delete `app/(site)/topos/` directory after content is moved (no redirect — clean removal per [Cross-cutting Decisions](#cross-cutting-decisions)).
- [x] Update doc-style references in code comments (`app/(site)/layout.tsx:8`, `lib/db/queries.ts:216`).
- [x] Update test fixture URLs (e.g. `https://cdn.granite.kr/topos/topo_a.webp` is a CDN path for image storage — keep as-is since it refers to R2 key, not the public route).
- [x] grep -r `"/topos/"` and `"/topos\$"` across the repo and confirm only R2 key paths remain.
- [x] Run: `pnpm test lib/actions/admin-content.test.ts`
- [x] Run: `pnpm typecheck`

### Task 2: Area Detail Read Model

**Files:**
- Modify: `lib/db/queries.ts`
- Modify: `lib/db/repository.ts`
- Modify: `lib/db/schema.ts` — add `AreaDetail` type (Area + stats + gradeDistribution + crags)
- Modify: `lib/actions/admin-content.ts` — add `revalidateTag('area:<slug>')` and `revalidatePath('/a/<slug>')` to Area mutations
- Test: `lib/db/queries.test.ts`
- Test: `lib/db/repository.test.ts`
- Test: `lib/actions/admin-content.test.ts` — assert new revalidation calls

- [x] Add an Area detail query by slug that returns published Area metadata, aggregate counts, grade distribution, and published Crags.
- [x] Grade distribution shape: `{ band: string; min: number; max: number; count: number }[]`. Bands: `V0-V2`, `V3-V5`, `V6-V8`, `V9-V11`, `V12+`. Compute via SQL `GROUP BY CASE WHEN gradeNum ...` over all Routes whose ancestor chain (Topo→Boulder→Sector→Crag→Area) is published and not soft-deleted.
- [x] Ensure the query filters `is_published = 1` and `deleted_at IS NULL` for Area and descendant public rows.
- [x] Return `null` when Area slug does not exist, is unpublished, or is soft-deleted.
- [x] Add repository wrapper `findAreaDetailBySlug(areaSlug)` with `unstable_cache` keyed by slug and tag `area:<slug>`.
- [x] Add `area:<slug>` revalidation in `lib/actions/admin-content.ts` for: `saveArea` (both create + update; on slug change, revalidate both old and new slug), `togglePublishArea`, `softDeleteArea`, `restoreArea`. Also call `revalidatePath('/a/<slug>')`.
- [x] Add tests for published Area, unpublished Area, soft-deleted Area, Crag filtering, grade distribution bucketing (empty area → all zero counts; mixed grades → correct counts), and admin revalidation calls.
- [x] Run: `pnpm test lib/db/queries.test.ts lib/db/repository.test.ts lib/actions/admin-content.test.ts`

### Task 3: Area Detail Page

**Files:**
- Create: `app/(site)/a/[areaSlug]/page.tsx`
- Create: `components/public/area-card.tsx`
- Modify: `components/public/crag-card.tsx`
- Modify: `components/public/stat-bar.tsx` — accept real `gradeDistribution` prop (existing usages on Crag detail also migrated)

- [x] Implement `/a/<area-slug>` using `findAreaDetailBySlug`.
- [x] Call `notFound()` when the repository returns `null`.
- [x] Include `AppHeader` consistent with other site pages.
- [x] Render Area hero (cover image, name, name_en), aggregate stats line (`{crags} Crags · {sectors} Sectors · {boulders} Boulders · {routes} Routes`), `StatBar` with real grade distribution, `SearchField` (from Task 5, links to `/c/<crag-slug>?q=...` or page-local Crag filter — see decision below), and a list of Crag cards.
- [x] Search on the Area page filters the Crag list via URL `?q=...` (server-side substring match against Crag name/name_en, case-insensitive).
- [x] Link Crag cards to `/c/<crag-slug>`.
- [x] Add `generateMetadata({ params })` returning `{ title: '<Area Name> · Granite', description: <Area description or fallback> }`.
- [x] Keep the page mobile-first with max-width behavior inherited from `app/(site)/layout.tsx`.
- [x] Run: `pnpm typecheck`
- [ ] Manually verify: `/a/<known-area-slug>` renders and `/a/not-real` returns 404. _(deferred to Task 12 final verification)_

### Task 4: Home Area and Crag Sliders

**Files:**
- Modify: `app/(site)/(public)/page.tsx`
- Modify: `lib/db/repository.ts` — `getHomeModel` returns `{ totals, areas[], allCrags[], announcements }` instead of `areas[].crags`
- Modify: `lib/db/queries.ts` — add `getAllPublishedCrags()` (with per-Crag stats) if not already covered
- Modify: `lib/db/schema.ts` — update `HomeModel` type
- Create or modify: `components/public/area-card.tsx`
- Modify: `components/public/crag-carousel.tsx`
- Modify: `components/public/crag-card.tsx`
- Test: `lib/db/queries.test.ts`, `lib/db/repository.test.ts`

- [x] Change `getHomeModel` to return all published Crags as a flat top-level list (sorted by `sortOrder ASC`, then `name ASC`), independent of Area selection. Areas remain in the model as a separate top-level list for the Area slider.
- [x] Remove the Area chip/filter UI from the home page (no per-area selection, no embedded Crag list under a selected Area).
- [x] Render Area cards in a horizontal snap slider using the Figma `30:734` reference.
- [x] Link each Area card to `/a/<area-slug>`.
- [x] Add the requested Crag section margin before the Crag slider (extract spec from Figma).
- [x] Ensure Crag cards remain horizontally scrollable and link to `/c/<crag-slug>`.
- [x] Keep slider dimensions stable so card text and image loading do not shift layout.
- [x] Update the existing `home` cache tag/key if the model shape changes; invalidate on any Crag/Area mutation already covered by admin actions.
- [x] Run: `pnpm test lib/db/queries.test.ts lib/db/repository.test.ts`
- [x] Run: `pnpm typecheck`
- [ ] Manually verify mobile viewport horizontal scrolling for Area and Crag sliders. _(deferred to Task 12)_

### Task 5: Crag Info/Sector/Boulder Tab Refinement

**Files:**
- Modify: `app/(site)/c/[cragSlug]/page.tsx`
- Modify: `components/public/boulder-card.tsx`
- Modify: `components/public/crag-card.tsx` if shared card style applies
- Create: `components/public/search-field.tsx`
- Pre-step: capture Figma design tokens for each referenced node (font sizes, card heights, image ratios, spacing, colors) into a short notes file or inline in implementation PR description — avoids per-task re-querying Figma.

- [x] Match the Crag Info tab structure to Figma `30:889`.
- [x] Match the Sector tab card/list structure to Figma `30:2070`.
- [x] Match the Boulder tab card/list structure to Figma `30:2155`.
- [x] Keep each tab using DB-backed data already loaded for the Crag detail page.
- [x] Introduce a reusable `SearchField` component used by Sector/Boulder/Route tabs.
- [x] `SearchField` writes a URL search param (`?q=<value>`); page re-renders with server-filtered list. Use a small client wrapper (form `action` to current path) or `useRouter().replace` with debounce; pick whichever stays a Server Component for the list rendering.
- [x] Server-side filter performs case-insensitive substring match against the entity's `name` and `name_en` (Sector/Boulder/Route). _(Boulder/Route lack `name_en` in the schema → Boulder filters `name`, Route filters `name` + `boulderName` + `grade`.)_
- [x] Use the same height, icon placement, placeholder, border, and focus treatment for all three tab search inputs (Figma `31:2518`).
- [x] Tab switching preserves the `q` and (Route tab) `sort` params only when relevant to that tab; clear when navigating away.
- [x] Run: `pnpm typecheck`
- [ ] Manually verify Info/Sector/Boulder tabs at mobile width and that `?q=...` survives reload. _(deferred to Task 12)_

### Task 6: Route Tab Grade Sorting

**Files:**
- Modify: `components/public/route-table.tsx`
- Modify: `app/(site)/c/[cragSlug]/page.tsx` — sort state lives at page level via search params
- Test: add component or page test for sort behavior (URL-driven)

- [x] Make Grade header sorting actually change route order.
- [x] Sort key is `routes.gradeNum` (already on schema, see `lib/db/schema.ts:71`). Fall back to `grade` label for stable secondary ordering.
- [x] Sort state is held in URL search param `?sort=grade:asc` or `?sort=grade:desc`. Default (no param) keeps existing repository order. Cycle: none → asc → desc → none on header clicks.
- [x] Grade header is a `Link` (or form button) that toggles `?sort` while preserving `?tab=route` and `?q=` params.
- [x] Provide ascending and descending states with visual sort icon (Figma reference if available; otherwise simple chevron up/down).
- [x] Place the sort icon next to the Grade label without overlapping table content.
- [x] Keep Route, Grade, Boulder columns readable at mobile width.
- [x] Run: `pnpm typecheck`
- [ ] Manually verify Grade sort toggles on the Crag Route tab and that the URL reflects state (shareable). _(deferred to Task 12)_

### Task 7: Route/Topo Icon Updates

**Files:**
- Modify: `components/layout/footer.tsx`
- Modify: `app/(site)/t/[topoId]/page.tsx`
- Modify: `components/public/route-table.tsx` or the local Route/Topo action button component
- Add assets under: `public/images/figma/icons/` — `icon-instagram.svg`, `icon-map.svg`, `icon-beta.svg`

- [x] Export icons from Figma using `mcp__Framelink_Figma_MCP__download_figma_images`, format SVG, target `public/images/figma/icons/`.
- [x] Replace Footer Instagram icon using Figma `1:186` → `icon-instagram.svg`.
- [x] Replace Route/Topo map icon using Figma `1:1420` → `icon-map.svg`.
- [x] Replace Route/Topo beta icon using Figma `1:1417` → `icon-beta.svg`.
- [x] Reference icons via `<Image>` or inline `<svg>` (prefer inline SVG for currentColor support if Figma export allows).
- [x] Ensure icon buttons have a 44px recommended touch target (button hit area, not necessarily icon size).
- [x] Align icons visually in their button containers at 1x and high-density displays.
- [x] Run: `pnpm typecheck`
- [ ] Manually verify Footer, Topo page, and Route action buttons. _(deferred to Task 12)_

### Task 8: Topo Previous/Next Navigation

**Files:**
- Modify: `lib/db/queries.ts`
- Modify: `lib/db/repository.ts`
- Modify: `app/(site)/t/[topoId]/page.tsx`
- Create: `components/public/topo-nav.tsx`
- Test: `lib/db/queries.test.ts`, `lib/db/repository.test.ts`

- [x] Add a read model that returns current Topo plus sibling Topos in the same Boulder.
- [x] Filter sibling Topos by `is_published = 1 AND deleted_at IS NULL` (Topos DO have `is_published`; the original spec note was wrong). Ancestor chain gating is enforced by `loadTopoById`/`getTopoById` before siblings are fetched.
- [x] Sort sibling Topos by `sort_order ASC`, then secondary key. _(Implementation uses `sort_order, id` matching the rest of the codebase rather than `name` — acceptable convention.)_
- [x] Compute previous and next Topo IDs for the current Topo.
- [x] Render left/right arrows on the Topo page.
- [x] Link enabled arrows to `/t/<topo-id>`.
- [x] Disable previous on the first Topo and next on the last Topo.
- [x] Add tests for middle, first, last, single-Topo Boulder cases.
- [x] Run: `pnpm test lib/db/queries.test.ts lib/db/repository.test.ts`
- [x] Run: `pnpm typecheck`

### Task 9: Admin Sidebar on Creation/Edit Surfaces

**Approach (revised during implementation):** The admin layout actually uses a **top header with horizontal nav** (`app/admin/(protected)/layout.tsx`), not a left sidebar. The fix adapts the same intent — keep nav visible when drawer is open — by making the header `sticky top-0 z-50` and lowering the drawer's z-index to `z-40` so the header floats above the backdrop.

**Files:**
- Modify: `app/admin/(protected)/layout.tsx` — sticky header
- Modify: `components/admin/edit-drawer.tsx` — drawer z-index reduced to z-40

- [x] Identify the admin layout structure (top header with nav, not left sidebar).
- [x] Make header `sticky top-0 z-50` so it stays visible when drawer opens.
- [x] Drawer z-40 sits below the header but above main content.
- [x] Backdrop covers content area below the header.
- [x] ESC-to-close, backdrop click, slide animation all still work.
- [x] Server Action form field names unchanged.
- [x] Run: `pnpm typecheck`
- [ ] Manually verify each content type (Area/Crag/Sector/Boulder/Topo/Route) drawer shows the header at all widths. _(deferred to Task 12)_

### Task 10: Admin Parent Cascade Filters

**Files:**
- Create: `components/admin/parent-filter.tsx`
- Modify: `app/admin/(protected)/content/crags/page.tsx`
- Modify: `app/admin/(protected)/content/sectors/page.tsx`
- Modify: `app/admin/(protected)/content/boulders/page.tsx`
- Modify: `app/admin/(protected)/content/topos/page.tsx`
- Modify: `app/admin/(protected)/content/routes/page.tsx`
- Modify: `lib/db/admin-read-queries.ts` — add filter args + dropdown-option queries
- Test: `lib/db/admin-read-queries.test.ts`

- [x] Implement URL search param filters using camelCase IDs: `?areaId=...`, `?cragId=...`, `?sectorId=...`, `?boulderId=...`, `?topoId=...`. (See [Cross-cutting Decisions](#cross-cutting-decisions).)
- [x] Crag list filters by `areaId`.
- [x] Sector list filters by `areaId` and `cragId`.
- [x] Boulder list filters by `areaId`, `cragId`, and `sectorId`.
- [x] Topo list filters by `areaId`, `cragId`, `sectorId`, and `boulderId`.
- [x] Route list filters by `areaId`, `cragId`, `sectorId`, `boulderId`, and `topoId`.
- [x] When parent params disagree (e.g. `cragId` doesn't belong to `areaId`), apply both filters as conjunctive AND — result will simply be empty rather than redirecting; do not silently drop a filter.
- [x] `ParentFilter` is a server component that takes the current params + a list of `{ label, value }` option groups (Area/Crag/Sector/Boulder/Topo as applicable) and renders cascading `<select>` elements wrapped in a `<form method="get">`. Submitting the form updates URL params. No client JS required.
- [x] Dropdown option queries: add `listAreaOptions()`, `listCragOptionsByArea(areaId)`, `listSectorOptionsByCrag(cragId)`, `listBoulderOptionsBySector(sectorId)`, `listTopoOptionsByBoulder(boulderId)` to `lib/db/admin-read-queries.ts`. Each returns `{ id, name }[]`, sorted by `sort_order ASC, name ASC`, excludes soft-deleted.
- [x] When a parent filter is selected, prefill the EditDrawer create form's hidden parent ID field with the filter value. Implementation: pass current search params through to the drawer's create form `defaultValue`.
- [x] Add a "필터 초기화" link that returns to the unfiltered list (link to the same page with no params).
- [x] Add query tests for each filtered read path (param presence / absence / multi-param combinations) and for the option-list queries.
- [x] Run: `pnpm test lib/db/admin-read-queries.test.ts`
- [x] Run: `pnpm typecheck`

### Task 11: Crag Map/Travel Tabs with Kakao Map

**Approach:** Replace the current placeholder `MapPreview` / `TravelPanel` on the Crag detail page with a real Kakao Map embed using `react-kakao-maps-sdk` ([docs](https://react-kakao-maps-sdk.jaeseokim.dev/docs/intro)).

**Files:**
- Add dep: `react-kakao-maps-sdk` via `pnpm add react-kakao-maps-sdk`
- Create: `components/public/kakao-map.tsx` — client component, encapsulates SDK init and rendering
- Modify: `app/(site)/c/[cragSlug]/page.tsx` — Map tab renders `<KakaoMap>`, Travel tab renders surrounding-POI list
- Modify: `app/layout.tsx` or a small SDK loader to inject the Kakao JS SDK `<Script>` with `NEXT_PUBLIC_KAKAO_MAP_KEY`
- Modify: `next.config.js` if image domains need to be allowed for any POI thumbnails (unlikely)

- [x] Install `react-kakao-maps-sdk`. Confirm bundle size impact (<50KB additional JS for the Crag page) is acceptable. _(Crag page first-load JS went from 107 kB to 108 kB — negligible.)_
- [x] Add a Kakao SDK loader: use `next/script` with `strategy="afterInteractive"` and the `autoload=false` pattern. Key from `NEXT_PUBLIC_KAKAO_MAP_KEY`.
- [x] `KakaoMap` component is `"use client"`, takes `{ lat, lng, name, zoom?, className? }` props, renders `<Map>` + `<MapMarker>`.
- [x] Map tab on Crag detail shows the Crag's `lat`/`lng` with a marker. Empty state "위치 정보가 등록되지 않았습니다." when null.
- [x] Travel tab content: kept existing `buildTravelItems` placeholder structure (no new POI fetch).
- [x] Map tab honors mobile width with height `h-[240px] md:h-[400px]`.
- [x] Script conditional on `NEXT_PUBLIC_KAKAO_MAP_KEY` — no throw when missing.
- [x] Run: `pnpm typecheck` + `pnpm build`
- [ ] Manually verify Map tab on a known Crag slug, marker appears, zoom/pan work, page does not error when key is omitted. _(deferred to Task 12)_

### Task 12: Final Phase 4 Verification

**Files:**
- No new implementation files expected.

- [x] Run: `pnpm test` _(327/327 passed across 13 test files)_
- [x] Run: `pnpm typecheck` _(clean)_
- [x] Run: `pnpm build` _(12/12 static pages, all routes generated)_
- [x] Confirm `/a/[areaSlug]`, `/t/[topoId]` routes exist; `/topos/[topoId]` route is gone.
- [x] Confirm no public route or visible link points to `/topos/<id>` (grep across `app/` + `components/` returns no matches).
- [x] Confirm Phase 4 excludes bottom tab, login, manual Beta registration, webhook inbox, and Beta moderation.
- [ ] Start local app: `pnpm dev` _(deferred — manual)_
- [ ] Browser QA public: `/`, `/a/<known-area-slug>`, `/a/not-real` (expect 404), `/c/<known-crag-slug>` (Info/Sector/Boulder/Route/Map/Travel tabs), `/c/<known-crag-slug>?tab=route&sort=grade:asc` (verify shareable sort), `/c/<known-crag-slug>?tab=sector&q=...` (verify shareable search), `/t/<known-topo-id>` (verify prev/next nav), `/r/<known-route-id>` (verify redirects to `/t/<id>?route=<id>`), `/topos/<known-topo-id>` (expect 404 — legacy route removed). _(deferred — manual)_
- [ ] Browser QA admin: `/admin/content/areas`, `/admin/content/crags?areaId=<id>`, `/admin/content/sectors?areaId=<id>&cragId=<id>`, `/admin/content/boulders`, `/admin/content/topos`, `/admin/content/routes`. Verify cascading parent filter, prefilled create form, "필터 초기화" link. _(deferred — manual)_
- [ ] Open EditDrawer on each admin content type — sticky header must remain visible. _(deferred — manual)_
- [ ] Verify `revalidatePath` / `revalidateTag` calls fire (manual: edit an Area, then load `/a/<slug>` and confirm new data appears without redeploy). _(deferred — manual)_
