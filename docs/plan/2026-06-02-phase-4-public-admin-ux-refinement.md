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

Out of scope:

- 하단 바텀 탭
- 사용자 로그인, 사용자 계정 화면, 마이페이지 확장
- Instagram webhook, manual Beta registration, Beta moderation

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

- Modify: `app/(site)/(public)/page.tsx` — home Area/Crag slider entry points.
- Create: `app/(site)/a/[areaSlug]/page.tsx` — Area detail route.
- Move: `app/(site)/topos/[topoId]/page.tsx` → `app/(site)/t/[topoId]/page.tsx` — Topo canonical route.
- Modify: `app/(site)/r/[routeId]/page.tsx` — redirect to `/t/<topo-id>?route=<route-id>`.
- Modify: `app/(site)/c/[cragSlug]/page.tsx` — Crag tab refinements, shared search UI, Grade sort.
- Modify: `components/public/crag-carousel.tsx`, `components/public/crag-card.tsx`, `components/public/route-table.tsx`, `components/public/boulder-card.tsx` — public cards, sliders, route table.
- Create: `components/public/area-card.tsx`, `components/public/search-field.tsx`, `components/public/topo-nav.tsx` — focused reusable UI.
- Modify: `components/layout/footer.tsx` — Instagram icon.
- Modify: `lib/db/queries.ts`, `lib/db/repository.ts`, `lib/db/schema.ts` if needed — Area detail and Topo sibling read models.
- Modify tests: `lib/db/queries.test.ts`, `lib/db/repository.test.ts`, `lib/actions/admin-content.test.ts`.
- Modify admin pages: `app/admin/(protected)/content/{areas,crags,sectors,boulders,topos,routes}/page.tsx`.
- Create: `components/admin/parent-filter.tsx` — shared parent cascade filter.
- Modify: `lib/db/admin-read-queries.ts`, `lib/db/admin-read-queries.test.ts` — parent-filter option queries.

---

### Task 1: Canonical Route Shortening

**Files:**
- Move: `app/(site)/topos/[topoId]/page.tsx` → `app/(site)/t/[topoId]/page.tsx`
- Modify: `app/(site)/r/[routeId]/page.tsx`
- Modify: `components/public/route-table.tsx`
- Modify: `app/(site)/c/[cragSlug]/page.tsx`
- Modify: `lib/actions/admin-content.ts`
- Test: `lib/actions/admin-content.test.ts`

- [ ] Replace all user-facing Topo links from `/topos/${topoId}` to `/t/${topoId}`.
- [ ] Update route share redirect from `/topos/${route.topoId}?route=${route.id}` to `/t/${route.topoId}?route=${route.id}`.
- [ ] Update admin revalidation paths from `/topos/<id>` to `/t/<id>`.
- [ ] Update tests that assert `revalidatePath("/topos/...")` to assert `revalidatePath("/t/...")`.
- [ ] Keep no canonical `/topos/<id>` public link in active app code.
- [ ] Run: `pnpm test lib/actions/admin-content.test.ts`
- [ ] Run: `pnpm typecheck`

### Task 2: Area Detail Read Model

**Files:**
- Modify: `lib/db/queries.ts`
- Modify: `lib/db/repository.ts`
- Modify: `lib/db/schema.ts` if existing exported types need extension
- Test: `lib/db/queries.test.ts`
- Test: `lib/db/repository.test.ts`

- [ ] Add an Area detail query by slug that returns published Area metadata, aggregate counts, grade distribution, and published Crags.
- [ ] Ensure the query filters `is_published = 1` and `deleted_at IS NULL` for Area and descendant public rows.
- [ ] Return `null` when Area slug does not exist, is unpublished, or is soft-deleted.
- [ ] Add repository wrapper `findAreaDetailBySlug(areaSlug)`.
- [ ] Add tests for published Area, unpublished Area, soft-deleted Area, and Crag filtering.
- [ ] Run: `pnpm test lib/db/queries.test.ts lib/db/repository.test.ts`

### Task 3: Area Detail Page

**Files:**
- Create: `app/(site)/a/[areaSlug]/page.tsx`
- Create: `components/public/area-card.tsx`
- Modify: `components/public/crag-card.tsx`
- Modify: `components/public/stat-bar.tsx` if grade distribution rendering needs reuse

- [ ] Implement `/a/<area-slug>` using `findAreaDetailBySlug`.
- [ ] Call `notFound()` when the repository returns `null`.
- [ ] Render Area hero/header, aggregate stats, grade distribution, search field, and Crag list/cards.
- [ ] Link Crag cards to `/c/<crag-slug>`.
- [ ] Keep the page mobile-first with max-width behavior inherited from `app/(site)/layout.tsx`.
- [ ] Run: `pnpm typecheck`
- [ ] Manually verify: `/a/<known-area-slug>` renders and `/a/not-real` returns 404.

### Task 4: Home Area and Crag Sliders

**Files:**
- Modify: `app/(site)/(public)/page.tsx`
- Create or modify: `components/public/area-card.tsx`
- Modify: `components/public/crag-carousel.tsx`
- Modify: `components/public/crag-card.tsx`

- [ ] Remove the Area chip/filter UI from the home page.
- [ ] Render Area cards in a horizontal snap slider.
- [ ] Link each Area card to `/a/<area-slug>`.
- [ ] Add the requested Crag section margin before the Crag slider.
- [ ] Ensure Crag cards remain horizontally scrollable and link to `/c/<crag-slug>`.
- [ ] Keep slider dimensions stable so card text and image loading do not shift layout.
- [ ] Run: `pnpm typecheck`
- [ ] Manually verify mobile viewport horizontal scrolling for Area and Crag sliders.

### Task 5: Crag Info/Sector/Boulder Tab Refinement

**Files:**
- Modify: `app/(site)/c/[cragSlug]/page.tsx`
- Modify: `components/public/boulder-card.tsx`
- Modify: `components/public/crag-card.tsx` if shared card style applies
- Create: `components/public/search-field.tsx`

- [ ] Match the Crag Info tab structure to Figma `30:889`.
- [ ] Match the Sector tab card/list structure to Figma `30:2070`.
- [ ] Match the Boulder tab card/list structure to Figma `30:2155`.
- [ ] Keep each tab using DB-backed data already loaded for the Crag detail page.
- [ ] Introduce a reusable `SearchField` for Sector/Boulder/Route tabs.
- [ ] Use the same height, icon placement, placeholder, border, and focus treatment for all three tab search inputs.
- [ ] Run: `pnpm typecheck`
- [ ] Manually verify Info/Sector/Boulder tabs at mobile width.

### Task 6: Route Tab Grade Sorting

**Files:**
- Modify: `components/public/route-table.tsx`
- Modify: `app/(site)/c/[cragSlug]/page.tsx` if sort state belongs at page level
- Test: add or update component/repository test only if existing route table behavior is already tested

- [ ] Make Grade header sorting actually change route order.
- [ ] Sort by numeric grade field when available, not lexicographic label.
- [ ] Provide ascending and descending states.
- [ ] Place the sort icon next to the Grade label without overlapping table content.
- [ ] Keep Route, Grade, Boulder columns readable at mobile width.
- [ ] Run: `pnpm typecheck`
- [ ] Manually verify Grade sort toggles on the Crag Route tab.

### Task 7: Route/Topo Icon Updates

**Files:**
- Modify: `components/layout/footer.tsx`
- Modify: `app/(site)/t/[topoId]/page.tsx`
- Modify: `components/public/route-table.tsx` or the local Route/Topo action button component
- Add assets under: `public/images/figma/` only if exported static assets are needed

- [ ] Replace Footer Instagram icon using Figma `1:186`.
- [ ] Replace Route/Topo map icon using Figma `1:1420`.
- [ ] Replace Route/Topo beta icon using Figma `1:1417`.
- [ ] Ensure icon buttons have a 44px recommended touch target.
- [ ] Align icons visually in their button containers at 1x and high-density displays.
- [ ] Run: `pnpm typecheck`
- [ ] Manually verify Footer, Topo page, and Route action buttons.

### Task 8: Topo Previous/Next Navigation

**Files:**
- Modify: `lib/db/queries.ts`
- Modify: `lib/db/repository.ts`
- Modify: `app/(site)/t/[topoId]/page.tsx`
- Create: `components/public/topo-nav.tsx`
- Test: `lib/db/queries.test.ts`, `lib/db/repository.test.ts`

- [ ] Add a read model that returns current Topo plus sibling Topos in the same Boulder.
- [ ] Sort sibling Topos by `sort_order ASC`, then `name ASC`.
- [ ] Compute previous and next Topo IDs for the current Topo.
- [ ] Render left/right arrows on the Topo page.
- [ ] Link enabled arrows to `/t/<topo-id>`.
- [ ] Disable previous on the first Topo and next on the last Topo.
- [ ] Add tests for middle, first, last, and single-Topo Boulder cases.
- [ ] Run: `pnpm test lib/db/queries.test.ts lib/db/repository.test.ts`
- [ ] Run: `pnpm typecheck`

### Task 9: Admin Sidebar on Creation/Edit Surfaces

**Files:**
- Modify: `app/admin/(protected)/content/{areas,crags,sectors,boulders,topos,routes}/page.tsx`
- Modify: `components/admin/edit-drawer.tsx` if drawer routing prevents sidebar visibility
- Modify: `components/admin/admin-shell.tsx` only if current layout cannot host create/edit surfaces

- [ ] Confirm current create/edit flows that hide the sidebar.
- [ ] Move create/edit UI into the protected admin layout surface rather than a standalone screen without shell.
- [ ] Keep the Admin sidebar visible for Area, Crag, Sector, Boulder, Topo, and Route create/edit workflows.
- [ ] Preserve existing Server Action form field names so mutations do not change behavior.
- [ ] Run: `pnpm typecheck`
- [ ] Manually verify each content type create/edit screen has the sidebar.

### Task 10: Admin Parent Cascade Filters

**Files:**
- Create: `components/admin/parent-filter.tsx`
- Modify: `app/admin/(protected)/content/crags/page.tsx`
- Modify: `app/admin/(protected)/content/sectors/page.tsx`
- Modify: `app/admin/(protected)/content/boulders/page.tsx`
- Modify: `app/admin/(protected)/content/topos/page.tsx`
- Modify: `app/admin/(protected)/content/routes/page.tsx`
- Modify: `lib/db/admin-read-queries.ts`
- Test: `lib/db/admin-read-queries.test.ts`

- [ ] Implement URL search param filters for Area, Crag, Sector, Boulder, and Topo parents.
- [ ] Crag list filters by `areaId`.
- [ ] Sector list filters by `areaId` and `cragId`.
- [ ] Boulder list filters by `areaId`, `cragId`, and `sectorId`.
- [ ] Topo list filters by `areaId`, `cragId`, `sectorId`, and `boulderId`.
- [ ] Route list filters by `areaId`, `cragId`, `sectorId`, `boulderId`, and `topoId`.
- [ ] When a parent filter is selected, use it as the default value in the create form.
- [ ] Add a clear-filter link that returns to the unfiltered list.
- [ ] Add query tests for each filtered read path.
- [ ] Run: `pnpm test lib/db/admin-read-queries.test.ts`
- [ ] Run: `pnpm typecheck`

### Task 11: Final Phase 4 Verification

**Files:**
- No new implementation files expected.

- [ ] Run: `pnpm test`
- [ ] Run: `pnpm typecheck`
- [ ] Run: `pnpm build`
- [ ] Start local app: `pnpm dev`
- [ ] Browser QA: `/`, `/a/<known-area-slug>`, `/c/<known-crag-slug>`, `/t/<known-topo-id>`, `/r/<known-route-id>`.
- [ ] Browser QA admin: `/admin/content/areas`, `/admin/content/crags`, `/admin/content/sectors`, `/admin/content/boulders`, `/admin/content/topos`, `/admin/content/routes`.
- [ ] Confirm no public route or visible link points to old Area/Topo routes or to a public user profile route.
- [ ] Confirm Phase 4 excludes bottom tab, login, manual Beta registration, webhook inbox, and Beta moderation.
