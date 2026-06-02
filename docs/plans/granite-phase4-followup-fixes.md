# Granite Phase 4 Follow-up Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address 7 detailed follow-up issues from Phase 4 review: home slider drag/padding polish, Area page Crag layout + overview map, Boulder → Route deep-linking, admin create-in-drawer flow, and independent admin filters.

**Architecture:** Surgical changes inside the existing Next.js App Router + Server Action architecture. Add one small client-only `DragScroller` component for native pointer-drag scrolling. Reuse the existing `react-kakao-maps-sdk`-based `KakaoMap` (extended to accept multiple markers + a marker-click callback). Refactor admin create flows from inline `AdminCard` forms into the existing `EditDrawer` triggered by a `?new=true` URL param. Loosen the cascading filter coupling so each filter (`areaId`, `cragId`, `sectorId`, `boulderId`, `topoId`) is applied independently in the DB layer and child dropdowns show full options regardless of parent state.

**Tech Stack:** Next.js 15 App Router, React Server Components, TypeScript strict, Tailwind, Cloudflare D1 HTTP, `react-kakao-maps-sdk`, native Pointer Events API.

**Decisions captured up-front:**
- Drag-to-scroll: **native Pointer Events** in one tiny client component (`components/public/drag-scroller.tsx`). No new dependencies.
- Area map: marker click **focuses the corresponding Crag card** below the map (scroll into view + brief highlight). Requires a small client wrapper that ties the map's marker-click event to scrolling the card list.
- Admin filter UI: keep cascading dropdowns visually, but each dropdown shows the FULL option list (no longer gated by parent selection). Filter is applied independently in SQL. Selecting only `cragId` without `areaId` works and filters the row list correctly.

---

## File Map

- Create: `components/public/drag-scroller.tsx` — client component, native pointer-drag scroll wrapper.
- Create: `components/public/area-overview-map.tsx` — client component using `KakaoMap` with multi-marker + click handler; scrolls to focused Crag card.
- Modify: `components/public/kakao-map.tsx` — extend props to support `markers: Array<{ lat, lng, id, name }>`, `onMarkerClick?: (id: string) => void`, while keeping the existing single-point usage backward-compatible.
- Modify: `app/(site)/(public)/page.tsx` — wrap Area + Crag sliders with `DragScroller`; fix edge padding so first/last items align with the section title's left edge.
- Modify: `components/public/crag-carousel.tsx` — same edge-padding fix; wrap with `DragScroller`.
- Modify: `app/(site)/a/[areaSlug]/page.tsx` — center Crag cards horizontally; mount `<AreaOverviewMap>` above the Crag list.
- Modify: `lib/db/queries.ts` — add `getAreaCragsWithCoords(areaId)` returning `Array<{ id, slug, name, lat, lng }>` for the overview map (only Crags whose `lat` AND `lng` are not null).
- Modify: `lib/db/repository.ts` — extend `AreaDetail.crags` shape or expose a separate helper for map markers. Simpler: add `cragLocations` to `AreaDetail` alongside `crags`. Adjust `findAreaDetailBySlug` accordingly.
- Modify: `lib/db/schema.ts` — extend `AreaDetail` type with `cragLocations: Array<{ id, slug, name, lat: number, lng: number }>`.
- Modify: `app/(site)/c/[cragSlug]/page.tsx` — (a) make `BoulderListCard` a `<Link>` that points to `?tab=route&boulderId=<id>`; (b) read `boulderId` from `searchParams` on the Route tab and filter routes by it (in addition to existing `q`); (c) preserve `boulderId` when toggling sort and search on Route tab.
- Modify: `components/admin/edit-drawer.tsx` — no API change expected (already supports any form body). Verify it can host the create form.
- Modify: `app/admin/(protected)/content/areas/page.tsx` — replace top inline `<AdminCard title="Create Area">` with a "Create" link/button (`?new=true`); render the create form inside `<EditDrawer>` when `new === "true"`.
- Modify: `app/admin/(protected)/content/crags/page.tsx` — same pattern.
- Modify: `app/admin/(protected)/content/sectors/page.tsx` — same pattern + filter independence wiring.
- Modify: `app/admin/(protected)/content/boulders/page.tsx` — same.
- Modify: `app/admin/(protected)/content/topos/page.tsx` — same.
- Modify: `app/admin/(protected)/content/routes/page.tsx` — same.
- Modify: `lib/db/admin-read-queries.ts` — `listCragOptionsByArea`, `listSectorOptionsByCrag`, `listBoulderOptionsBySector`, `listTopoOptionsByBoulder` accept an OPTIONAL parent ID. When parent ID is undefined, return the full unfiltered option list (still excluding soft-deleted, still ordered by `sort_order ASC, name ASC`). Add corresponding tests.
- Modify: `components/admin/parent-filter.tsx` — always render every applicable dropdown for the page, regardless of whether the parent is selected.
- Test: `lib/db/admin-read-queries.test.ts` — cover the no-parent option-list cases.
- Test: `lib/db/queries.test.ts` — `getAreaCragsWithCoords` filtering and shape.
- Test: `lib/db/repository.test.ts` — `findAreaDetailBySlug` now returns `cragLocations`.
- Test: `lib/actions/admin-content.test.ts` — sanity check that existing revalidation still fires after the create-form move.

---

### Task 1: DragScroller component

**Files:**
- Create: `components/public/drag-scroller.tsx`

- [x] **Step 1: Create the DragScroller client component.**

```tsx
// components/public/drag-scroller.tsx
"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";

type DragScrollerProps = {
  /** Tailwind/CSS classes applied to the scroll container. Must include `overflow-x-auto`. */
  className?: string;
  children: ReactNode;
};

/**
 * Wraps a horizontal scroll container and adds click-and-drag panning via Pointer Events.
 * Native touch scrolling on mobile is preserved (we only intercept mouse/pen pointers).
 * The component is a leaf client wrapper; children may be Server Components rendered up the tree.
 */
export function DragScroller({ className, children }: DragScrollerProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ startX: number; startScroll: number; pointerId: number } | null>(null);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    // Only intercept mouse/pen — leave touch to native momentum scroll.
    if (e.pointerType === "touch") return;
    const el = ref.current;
    if (!el) return;
    drag.current = { startX: e.clientX, startScroll: el.scrollLeft, pointerId: e.pointerId };
    el.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    const d = drag.current;
    if (!el || !d || d.pointerId !== e.pointerId) return;
    el.scrollLeft = d.startScroll - (e.clientX - d.startX);
  }

  function endDrag(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    const d = drag.current;
    if (!el || !d || d.pointerId !== e.pointerId) return;
    el.releasePointerCapture(e.pointerId);
    drag.current = null;
  }

  return (
    <div
      ref={ref}
      className={className}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{ cursor: "grab", touchAction: "pan-y" }}
    >
      {children}
    </div>
  );
}
```

- [x] **Step 2: Verify typecheck.**

Run: `pnpm typecheck`
Expected: clean exit.

- [x] **Step 3: Commit.**

```bash
git add components/public/drag-scroller.tsx
git commit -m "feat: add DragScroller client wrapper for pointer-drag horizontal scroll"
```

---

### Task 2: Home page sliders — drag-to-scroll + edge padding

**Files:**
- Modify: `app/(site)/(public)/page.tsx`
- Modify: `components/public/crag-carousel.tsx`

The section titles use `px-4` (16px). Today the slider container also uses `px-4`, but that makes the first card's left edge sit at 16px from the viewport. We want the SAME 16px padding to remain at both ends so the first/last card don't butt against the viewport edge during scroll. The current `px-4` already does this, but the snap-mandatory behavior plus the card width can make it look flush. The fix is to ensure:
- The scroll container has `px-4` (16px padding both sides).
- The last card has visible `pr-4` headroom so its right edge isn't clipped during snap.

In addition, both sliders should be wrapped with `<DragScroller>` so desktop users can drag.

- [ ] **Step 1: Read current home page slider markup.**

The Area slider section in `app/(site)/(public)/page.tsx`:

```tsx
<section className="mt-10">
  <div className="mb-5 px-4">
    <h2 className="text-[20px] font-bold leading-7 text-[#090909]">Area</h2>
  </div>
  <div className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3">
    {model.areas.map((area) => (
      <div key={area.id} className="w-[270px] shrink-0 snap-start">
        <AreaCard area={area} href={`/a/${area.slug}`} />
      </div>
    ))}
  </div>
</section>
```

- [ ] **Step 2: Replace Area slider scroll container with DragScroller and keep edge padding.**

```tsx
import { DragScroller } from "@/components/public/drag-scroller";

// ...

<section className="mt-10">
  <div className="mb-5 px-4">
    <h2 className="text-[20px] font-bold leading-7 text-[#090909]">Area</h2>
  </div>
  <DragScroller className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-3">
    {model.areas.map((area) => (
      <div key={area.id} className="w-[270px] shrink-0 snap-start">
        <AreaCard area={area} href={`/a/${area.slug}`} />
      </div>
    ))}
  </DragScroller>
</section>
```

The added `scroll-px-4` keeps the snap origin inset by 16px so first/last cards have breathing room after a snap. `px-4` already provides the title-aligned edge gap.

- [ ] **Step 3: Read current `CragCarousel`.**

`components/public/crag-carousel.tsx` currently wraps a `<div className="... overflow-x-auto px-4 ...">` containing each crag card. Capture its exact JSX before modifying.

- [ ] **Step 4: Update `CragCarousel` to use `DragScroller` and keep `px-4 scroll-px-4`.**

Replace the outer scroll `<div>` with `<DragScroller className="...">` using the same classes plus `scroll-px-4`:

```tsx
// components/public/crag-carousel.tsx
import { DragScroller } from "@/components/public/drag-scroller";

// existing imports + types unchanged

export function CragCarousel({ crags }: CragCarouselProps) {
  return (
    <DragScroller className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-3">
      {crags.map((crag) => (
        <div key={crag.id} className="w-[270px] shrink-0 snap-start">
          <CragCard crag={crag} />
        </div>
      ))}
    </DragScroller>
  );
}
```

(Adjust to match the file's actual existing structure — keep the inner cards/wrappers untouched. Only the outermost scroll container changes.)

- [ ] **Step 5: Run typecheck + build.**

Run: `pnpm typecheck && pnpm build`
Expected: clean.

- [ ] **Step 6: Commit.**

```bash
git add app/\(site\)/\(public\)/page.tsx components/public/crag-carousel.tsx
git commit -m "feat(home): drag-to-scroll on Area/Crag sliders with edge padding"
```

---

### Task 3: Area page — center Crag cards

**Files:**
- Modify: `app/(site)/a/[areaSlug]/page.tsx`

The Crag list on the Area page currently stacks `<CragCard>` left-aligned. `CragCard` has a fixed `w-[270px]`, which leaves visible right whitespace. Center each card horizontally within its column.

- [ ] **Step 1: Read the current Crag list block in `app/(site)/a/[areaSlug]/page.tsx`.** Identify the wrapper that maps `area.crags.map(...)`.

- [ ] **Step 2: Add `items-center` (flex) or `mx-auto` (block) wrapper around each card.**

Replace the existing crag list rendering with:

```tsx
<div className="mt-6 flex flex-col items-center gap-4 px-4">
  {filteredCrags.length === 0 ? (
    <p className="text-sm text-[#7A7A7A]">검색 결과가 없습니다.</p>
  ) : (
    filteredCrags.map((crag) => <CragCard key={crag.id} crag={crag} />)
  )}
</div>
```

(Use the actual variable name from the file — likely `filteredCrags` or similar. The key change is `flex flex-col items-center` on the container, replacing whatever non-centered container exists today.)

- [ ] **Step 3: Run typecheck + build.**

Run: `pnpm typecheck && pnpm build`
Expected: clean.

- [ ] **Step 4: Commit.**

```bash
git add app/\(site\)/a/\[areaSlug\]/page.tsx
git commit -m "fix(area): center-align Crag cards on Area detail page"
```

---

### Task 4: Area page — top overview map with all Crags

**Files:**
- Modify: `components/public/kakao-map.tsx`
- Create: `components/public/area-overview-map.tsx`
- Modify: `lib/db/queries.ts`
- Modify: `lib/db/schema.ts`
- Modify: `lib/db/repository.ts`
- Modify: `app/(site)/a/[areaSlug]/page.tsx`
- Test: `lib/db/queries.test.ts`
- Test: `lib/db/repository.test.ts`

- [ ] **Step 1: Extend `KakaoMap` to support multiple markers + click callback (backward-compatible).**

Edit `components/public/kakao-map.tsx`:

```tsx
"use client";

import { Map, MapMarker } from "react-kakao-maps-sdk";

export type KakaoMapMarker = {
  id: string;
  lat: number;
  lng: number;
  name: string;
};

type KakaoMapProps =
  | {
      /** Single-point mode (existing behavior). */
      lat: number;
      lng: number;
      name: string;
      zoom?: number;
      className?: string;
    }
  | {
      /** Multi-marker mode. */
      markers: KakaoMapMarker[];
      onMarkerClick?: (id: string) => void;
      /** Center override — defaults to the centroid of the markers. */
      center?: { lat: number; lng: number };
      zoom?: number;
      className?: string;
    };

export function KakaoMap(props: KakaoMapProps) {
  if ("markers" in props) {
    const { markers, onMarkerClick, center, zoom = 7, className } = props;
    if (markers.length === 0) {
      return null;
    }
    const computedCenter =
      center ?? {
        lat: markers.reduce((s, m) => s + m.lat, 0) / markers.length,
        lng: markers.reduce((s, m) => s + m.lng, 0) / markers.length,
      };
    return (
      <div className={className}>
        <Map center={computedCenter} level={zoom} style={{ width: "100%", height: "100%" }}>
          {markers.map((m) => (
            <MapMarker
              key={m.id}
              position={{ lat: m.lat, lng: m.lng }}
              title={m.name}
              onClick={onMarkerClick ? () => onMarkerClick(m.id) : undefined}
            />
          ))}
        </Map>
      </div>
    );
  }

  const { lat, lng, name, zoom = 5, className } = props;
  return (
    <div className={className}>
      <Map center={{ lat, lng }} level={zoom} style={{ width: "100%", height: "100%" }}>
        <MapMarker position={{ lat, lng }} title={name} />
      </Map>
    </div>
  );
}
```

- [ ] **Step 2: Add the `getAreaCragsWithCoords` query.**

Append to `lib/db/queries.ts`:

```ts
export interface CragLocation {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
}

/**
 * Published Crags within an Area that have non-null coordinates.
 * Used by the Area overview map. Excludes Crags without lat/lng (they'd render at (0,0)).
 */
export async function getAreaCragsWithCoords(areaId: string): Promise<CragLocation[]> {
  const rows = await queryD1<CragLocation>(
    `SELECT c.id, c.slug, c.name, c.lat AS lat, c.lng AS lng
       FROM crags c
       JOIN areas a ON a.id = c.area_id
      WHERE c.area_id = ?
        AND c.is_published = 1 AND c.deleted_at IS NULL
        AND a.is_published = 1 AND a.deleted_at IS NULL
        AND c.lat IS NOT NULL AND c.lng IS NOT NULL
      ORDER BY c.sort_order ASC, c.id ASC`,
    [areaId]
  );
  return rows;
}
```

- [ ] **Step 3: Write the failing test for `getAreaCragsWithCoords`.**

Append to `lib/db/queries.test.ts`:

```ts
describe("getAreaCragsWithCoords", () => {
  it("filters out crags without lat/lng and ancestor not published", async () => {
    const mock = vi.fn(async (sql: string, params: unknown[]) => ({
      results: [
        { id: "c1", slug: "s1", name: "C1", lat: 37.5, lng: 127.0 },
      ],
    }));
    vi.spyOn(await import("./d1-http"), "queryD1").mockImplementation(mock);

    const result = await getAreaCragsWithCoords("area-1");

    const sql = mock.mock.calls[0][0] as string;
    expect(sql).toMatch(/c\.lat IS NOT NULL AND c\.lng IS NOT NULL/);
    expect(sql).toMatch(/a\.is_published = 1/);
    expect(sql).toMatch(/c\.is_published = 1/);
    expect(sql).toMatch(/ORDER BY c\.sort_order ASC, c\.id ASC/);
    expect(mock.mock.calls[0][1]).toEqual(["area-1"]);
    expect(result).toEqual([{ id: "c1", slug: "s1", name: "C1", lat: 37.5, lng: 127.0 }]);
  });
});
```

(Match the existing test pattern in the file — most tests in this file spy on `queryD1` and assert SQL via regex. Mirror that style; do not add new infra.)

- [ ] **Step 4: Run the new test — should pass with the query in step 2.**

Run: `pnpm test lib/db/queries.test.ts -t getAreaCragsWithCoords`
Expected: PASS.

- [ ] **Step 5: Extend `AreaDetail` type with `cragLocations`.**

Edit `lib/db/schema.ts`:

```ts
// Add to top-level types
import type { CragLocation } from "./queries"; // if not already importable; otherwise inline the shape

// Modify AreaDetail
export type AreaDetail = Area & {
  stats: Stats;
  gradeDistribution: GradeBand[];
  crags: Array<Crag & { stats: Omit<Stats, "crags"> }>;
  cragLocations: CragLocation[];
};
```

If a cyclic-import risk exists, copy the `CragLocation` shape inline:

```ts
export type CragLocation = {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
};
```

- [ ] **Step 6: Populate `cragLocations` in `loadAreaBySlug`.**

Edit `lib/db/repository.ts`:

```ts
async function loadAreaBySlug(slug: string): Promise<AreaDetail | null> {
  const area = await getAreaBySlug(slug);
  if (!area) return null;

  const [stats, gradeDistribution, areaCrags, cragLocations] = await Promise.all([
    getAreaStats(area.id),
    getAreaGradeDistribution(area.id),
    getCragsByAreaId(area.id),
    getAreaCragsWithCoords(area.id),
  ]);

  const cragStats = await Promise.all(areaCrags.map((crag) => getCragStats(crag.id)));

  return {
    ...area,
    stats,
    gradeDistribution,
    crags: areaCrags.map((crag, i) => ({
      ...crag,
      stats: cragStats[i] ?? { sectors: 0, boulders: 0, routes: 0 },
    })),
    cragLocations,
  };
}
```

Also add `getAreaCragsWithCoords` to the top-of-file import list from `./queries`.

- [ ] **Step 7: Update the repository test.**

Edit `lib/db/repository.test.ts`. Mock `getAreaCragsWithCoords` and assert that `findAreaDetailBySlug` returns the `cragLocations` array. Keep the existing assertions intact.

- [ ] **Step 8: Run repository tests.**

Run: `pnpm test lib/db/repository.test.ts`
Expected: all pass (existing + new).

- [ ] **Step 9: Create `AreaOverviewMap` client component.**

`components/public/area-overview-map.tsx`:

```tsx
"use client";

import { useCallback } from "react";
import { KakaoMap, type KakaoMapMarker } from "@/components/public/kakao-map";

type AreaOverviewMapProps = {
  markers: KakaoMapMarker[];
  className?: string;
};

/**
 * Shows all Crags in an Area on a single Kakao Map. Clicking a marker scrolls
 * the corresponding Crag card into view and adds a brief visual highlight.
 *
 * Cards must be siblings somewhere in the DOM with `id="crag-card-${cragId}"`.
 */
export function AreaOverviewMap({ markers, className }: AreaOverviewMapProps) {
  const onMarkerClick = useCallback((id: string) => {
    const el = document.getElementById(`crag-card-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-[#090909]");
    window.setTimeout(() => el.classList.remove("ring-2", "ring-[#090909]"), 1500);
  }, []);

  if (markers.length === 0) return null;

  return <KakaoMap markers={markers} onMarkerClick={onMarkerClick} className={className} />;
}
```

- [ ] **Step 10: Mount `AreaOverviewMap` on the Area page above the Crag list and add `id` to each Crag card wrapper.**

In `app/(site)/a/[areaSlug]/page.tsx`:

```tsx
import { AreaOverviewMap } from "@/components/public/area-overview-map";

// ...
// After hero / stats / search field and BEFORE the Crag list:

{area.cragLocations.length > 0 ? (
  <div className="mt-6 px-4">
    <AreaOverviewMap
      markers={area.cragLocations}
      className="h-[240px] w-full overflow-hidden rounded-lg md:h-[360px]"
    />
  </div>
) : null}

{/* Crag list wrapper — each card gets an id for the map to scroll to */}
<div className="mt-6 flex flex-col items-center gap-4 px-4">
  {filteredCrags.map((crag) => (
    <div key={crag.id} id={`crag-card-${crag.id}`} className="w-full max-w-[360px] rounded-lg transition-shadow">
      <CragCard crag={crag} />
    </div>
  ))}
</div>
```

- [ ] **Step 11: Run typecheck + build.**

Run: `pnpm typecheck && pnpm build`
Expected: clean.

- [ ] **Step 12: Commit.**

```bash
git add components/public/kakao-map.tsx components/public/area-overview-map.tsx \
        lib/db/queries.ts lib/db/queries.test.ts \
        lib/db/schema.ts lib/db/repository.ts lib/db/repository.test.ts \
        app/\(site\)/a/\[areaSlug\]/page.tsx
git commit -m "feat(area): top overview map with marker click → Crag card focus"
```

---

### Task 5: Crag Boulder tab → filtered Route tab

**Files:**
- Modify: `app/(site)/c/[cragSlug]/page.tsx`

- [ ] **Step 1: Read the current `BoulderListCard` definition (around line 425) and the Route tab block (around line 195).**

The Boulder list currently renders `BoulderListCard` as a plain `<article>` (per the Phase 4 review notes). The chevron `›` implies tappability but no `<Link>` exists. The Route tab today filters by `?q=` and `?sort=` only.

- [ ] **Step 2: Wrap `BoulderListCard` content in a `<Link>` to the Route tab filtered by boulder id.**

Modify the existing `BoulderListCard` function so the entire card is a link:

```tsx
import Link from "next/link";

function BoulderListCard({ boulder, cragSlug }: { boulder: CragBoulderListItem; cragSlug: string }) {
  return (
    <Link
      href={`/c/${cragSlug}?tab=route&boulderId=${encodeURIComponent(boulder.id)}`}
      className="flex h-[100px] items-center gap-3 rounded-[8px] bg-white px-3 py-3 shadow-[0_0_6px_2px_rgba(0,0,0,0.06)] hover:shadow-[0_0_6px_2px_rgba(0,0,0,0.1)] transition-shadow"
    >
      {/* existing card body — thumbnail, name, route count, grade bars, chevron */}
    </Link>
  );
}
```

Update the `<BoulderListCard />` call site (around line 188) to pass `cragSlug={crag.slug}`.

- [ ] **Step 3: Read `boulderId` from `searchParams` on the Route tab and filter routes.**

In the Crag page top-level component, extend `searchParams` destructuring:

```tsx
const boulderId = resolvedSearchParams?.boulderId?.trim() ?? "";
```

Add `boulderId` to the `CragPageProps.searchParams` type and to `CragTabPanel` props. In the Route tab block:

```tsx
if (activeTab === "Route") {
  // 1. Filter by boulderId first (if set), then by search query
  let routes = crag.routes;
  if (boulderId) {
    routes = routes.filter((r) => r.boulderId === boulderId);
  }
  const filtered = query
    ? routes.filter((r) => {
        const q = query.toLowerCase();
        return (
          r.name.toLowerCase().includes(q) ||
          r.boulderName.toLowerCase().includes(q) ||
          r.grade.toLowerCase().includes(q)
        );
      })
    : routes;

  // 2. Sort after filtering (existing logic unchanged)
  // ...
}
```

(Verify `RouteListItem` has a `boulderId` field. If it's named differently — e.g. `boulder_id` or only `boulderName` — grep `lib/db/schema.ts` and adjust. If `boulderId` is genuinely missing, add it to the SELECT in `getCragRoutes` and update the row interface accordingly.)

- [ ] **Step 4: Preserve `boulderId` when toggling `q` / `sort` on the Route tab.**

Update `CragTabs` and the search/sort URL builders so `boulderId` is carried alongside `q` and `sort`:

- `CragTabs`: when `tab === "Route"` AND `boulderId` is set, add `params.set("boulderId", boulderId)`.
- `nextGradeSortHref(...)`: also propagate `boulderId`.
- `SearchField` Route-tab usage: include `boulderId` in `hiddenFields` if set, so submitting search keeps it. The implementer should pass `boulderId` through the prop chain mirroring how `sort` flows.

- [ ] **Step 5: Add a "filtered by boulder" indicator above the route list.**

When `boulderId` is set, render a small chip above the table:

```tsx
{boulderId ? (
  <div className="mb-3 flex items-center gap-2 px-4 text-[12px] text-[#7A7A7A]">
    <span>볼더 필터 적용 중</span>
    <Link
      href={`/c/${crag.slug}?tab=route${query ? `&q=${encodeURIComponent(query)}` : ""}${sort ? `&sort=${sort}` : ""}`}
      className="underline"
    >
      필터 해제
    </Link>
  </div>
) : null}
```

- [ ] **Step 6: Run typecheck.**

Run: `pnpm typecheck`
Expected: clean. If `boulderId` is missing from `RouteListItem`, this step will fail — go back to step 3 and extend the schema/SELECT.

- [ ] **Step 7: Run tests.**

Run: `pnpm test`
Expected: all existing tests still pass (no test changes required for this client-side filter).

- [ ] **Step 8: Commit.**

```bash
git add app/\(site\)/c/\[cragSlug\]/page.tsx
git commit -m "feat(crag): boulder card → Route tab filtered by boulderId"
```

---

### Task 6: Admin create → EditDrawer flow

**Files:**
- Modify: all 6 of `app/admin/(protected)/content/{areas,crags,sectors,boulders,topos,routes}/page.tsx`

Each page currently has a top inline `<AdminCard title="Create X">` with the create form. Replace it with a "Create" link button (`?new=true`) and move the entire form into `<EditDrawer>` when `searchParams.new === "true"`.

The exact same pattern applies to all 6 pages. The example below is for Areas — replicate identically (adapting field names) for the other 5 pages.

- [ ] **Step 1: Read `app/admin/(protected)/content/areas/page.tsx` to understand the current Create form structure (lines ~34-71 per the grep).**

- [ ] **Step 2: Add `new` to `searchParams` type and refactor Areas page.**

```tsx
interface Props {
  searchParams: Promise<{ edit?: string; new?: string }>;
}

export default async function AdminAreasPage({ searchParams }: Props) {
  const { edit, new: isNew } = await searchParams;
  const areas = await getAdminAreas();
  const editRow = edit ? areas.find((a) => a.id === edit) : undefined;
  const showCreate = isNew === "true";

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Areas</h1>
        <Link href="?new=true" className={btnPrimaryCls}>+ New Area</Link>
      </div>

      {/* Areas list — existing markup unchanged */}
      <AdminCard title={`All Areas (${areas.length})`}>
        {/* ... existing table ... */}
      </AdminCard>

      {/* Create drawer */}
      {showCreate ? (
        <EditDrawer title="Create Area" closeHref="/admin/content/areas">
          {/* Paste the EXACT same <form action={saveAreaAction}>...</form> markup that was previously inside the top AdminCard. */}
        </EditDrawer>
      ) : null}

      {/* Edit drawer (existing) — unchanged */}
      {editRow ? (
        <EditDrawer title="Edit Area" closeHref="/admin/content/areas">
          {/* existing edit form */}
        </EditDrawer>
      ) : null}
    </AdminShell>
  );
}
```

Important: the inline `<AdminCard title="Create Area">` block at lines ~34-71 is REMOVED. The exact `<form action={saveAreaAction}>...</form>` is preserved verbatim inside the new `<EditDrawer title="Create Area">`. Do not change field names or the `ImageUploadField entityId="new"` value — they drive the existing Server Action.

- [ ] **Step 3: Repeat for `crags/page.tsx`.**

Same pattern. `closeHref="/admin/content/crags"` (preserve current filter params via `URLSearchParams` if any are set — mirror the existing `EditDrawer closeHref` construction in the edit branch).

- [ ] **Step 4: Repeat for `sectors/page.tsx`.**

Same pattern. The create form pre-fills `cragId` from the URL filter when present (Task 10 of the original plan).

- [ ] **Step 5: Repeat for `boulders/page.tsx`.**

- [ ] **Step 6: Repeat for `topos/page.tsx`.**

- [ ] **Step 7: Repeat for `routes/page.tsx`.**

- [ ] **Step 8: Update the "+ New" link on filtered pages to preserve filter params.**

For sectors/boulders/topos/routes (which have parent filters), the "+ New" link should preserve the active filter so create-form prefills work:

```tsx
const createParams = new URLSearchParams();
if (areaId) createParams.set("areaId", areaId);
if (cragId) createParams.set("cragId", cragId);
createParams.set("new", "true");
const createHref = `?${createParams.toString()}`;

// ...
<Link href={createHref} className={btnPrimaryCls}>+ New Sector</Link>
```

- [ ] **Step 9: Run tests + typecheck + build.**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: all clean. Server Action mutation tests in `lib/actions/admin-content.test.ts` should still pass unchanged (the action's form-data shape is preserved).

- [ ] **Step 10: Commit.**

```bash
git add app/admin/\(protected\)/content/
git commit -m "feat(admin): move create forms into EditDrawer triggered by ?new=true"
```

---

### Task 7: Independent admin parent filters

**Files:**
- Modify: `lib/db/admin-read-queries.ts`
- Modify: `lib/db/admin-read-queries.test.ts`
- Modify: `components/admin/parent-filter.tsx`
- Modify: all 5 of `app/admin/(protected)/content/{crags,sectors,boulders,topos,routes}/page.tsx`

Today the option-list queries (`listCragOptionsByArea(areaId)`, etc.) require a parent ID. The page only loads child options when the parent is selected, so the dropdowns hide cascade. We want each dropdown ALWAYS visible with the full option list when the parent is unset.

- [ ] **Step 1: Loosen `listCragOptionsByArea` to accept an optional `areaId`.**

Edit `lib/db/admin-read-queries.ts`:

```ts
export async function listCragOptionsByArea(areaId?: string): Promise<ParentOption[]> {
  const conditions = ["c.deleted_at IS NULL", "a.is_published = 1", "a.deleted_at IS NULL"];
  const params: unknown[] = [];
  if (areaId) {
    conditions.push("c.area_id = ?");
    params.push(areaId);
  }
  const rows = await queryD1<ParentOption>(
    `SELECT c.id, c.name FROM crags c
       JOIN areas a ON a.id = c.area_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY c.sort_order ASC, c.name ASC`,
    params.length > 0 ? params : undefined
  );
  return rows;
}
```

(Function name unchanged so existing callers keep working. The parameter becomes optional.)

- [ ] **Step 2: Apply the same loosening to `listSectorOptionsByCrag`, `listBoulderOptionsBySector`, `listTopoOptionsByBoulder`.**

For each, change the required parent-id parameter to optional. Build `WHERE` conditions dynamically. Keep ancestor `is_published`/`deleted_at` chain checks.

- [ ] **Step 3: Add tests for the no-parent path.**

In `lib/db/admin-read-queries.test.ts`, mirror the existing test pattern. For each function:

```ts
it("listCragOptionsByArea: with no areaId returns all live crags", async () => {
  const mock = vi.fn(async () => ({ results: [{ id: "c1", name: "C1" }] }));
  vi.spyOn(await import("./d1-http"), "queryD1").mockImplementation(mock);

  const result = await listCragOptionsByArea();

  const sql = mock.mock.calls[0][0] as string;
  expect(sql).not.toMatch(/c\.area_id = \?/);
  expect(sql).toMatch(/c\.deleted_at IS NULL/);
  expect(sql).toMatch(/a\.is_published = 1/);
  expect(mock.mock.calls[0][1]).toBeUndefined();
  expect(result).toEqual([{ id: "c1", name: "C1" }]);
});
```

(Add four analogous tests.)

- [ ] **Step 4: Run tests.**

Run: `pnpm test lib/db/admin-read-queries.test.ts`
Expected: all pass.

- [ ] **Step 5: Update each entity page to ALWAYS load every applicable option list.**

Example for `sectors/page.tsx`:

```tsx
const [sectors, areaOptions, cragOptions] = await Promise.all([
  getAdminSectors({ areaId, cragId }),
  listAreaOptions(),
  listCragOptionsByArea(areaId), // pass undefined when no areaId
]);
```

Drop the previous conditional `areaId ? listCragOptionsByArea(areaId) : Promise.resolve([])` — call unconditionally. Repeat for `boulders` (areaOptions, cragOptions, sectorOptions), `topos` (+ boulderOptions), `routes` (+ topoOptions).

Note: when no parent is set, the child option list may be large (potentially hundreds of crags/sectors). This is acceptable for admin — but verify in a build the page still renders fast. If performance becomes a concern, follow-up by paginating the dropdown or switching to typeahead — out of scope here.

- [ ] **Step 6: Update `ParentFilter` to always render every applicable dropdown.**

Edit `components/admin/parent-filter.tsx`. The current code likely uses `{areaOptions && <select>}`-style gating; replace with unconditional rendering for the dropdowns that should always appear on this page. The page passes the full option lists every time (from step 5), so the gating can be removed entirely.

Concretely, change pattern:

```tsx
// Before
{cragOptions ? (
  <select name="cragId" defaultValue={current.cragId ?? ""}>
    ...
  </select>
) : null}

// After (still conditional on the option list being non-empty so empty-option-set pages don't render a phantom select)
{cragOptions && cragOptions.length > 0 ? (
  <select name="cragId" defaultValue={current.cragId ?? ""}>
    ...
  </select>
) : null}
```

The actual logic: each page passes only the dropdowns relevant to its entity (e.g. Sectors page passes `areaOptions` + `cragOptions`; Crags page passes only `areaOptions`). The component should render each dropdown that received a non-empty array.

- [ ] **Step 7: Confirm the DB list queries (`getAdminSectors`, `getAdminBoulders`, etc.) already apply each filter independently.**

Read `lib/db/admin-read-queries.ts`. Per Task 10 of the original plan, the filter builder uses conjunctive AND with each filter applied independently — no requirement on parent presence. If the current implementation requires `areaId` before `cragId` is applied, fix it: each filter param should add its own WHERE condition independently. Add a regression test:

```ts
it("getAdminSectors: filters by cragId alone without areaId", async () => {
  const mock = vi.fn(async () => ({ results: [] }));
  vi.spyOn(await import("./d1-http"), "queryD1").mockImplementation(mock);

  await getAdminSectors({ cragId: "crag-1" });

  const sql = mock.mock.calls[0][0] as string;
  const params = mock.mock.calls[0][1] as unknown[];
  expect(sql).toMatch(/s\.crag_id = \?/);
  expect(sql).not.toMatch(/c\.area_id = \?/);
  expect(params).toEqual(["crag-1"]);
});
```

If the existing implementation already passes this test, great. If not, refactor the WHERE-condition builder so each ID condition is independent.

- [ ] **Step 8: Run tests + typecheck + build.**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: all clean.

- [ ] **Step 9: Commit.**

```bash
git add lib/db/admin-read-queries.ts lib/db/admin-read-queries.test.ts \
        components/admin/parent-filter.tsx \
        app/admin/\(protected\)/content/
git commit -m "feat(admin): independent parent filters with always-visible dropdowns"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run full suite.**

```bash
pnpm test && pnpm typecheck && pnpm build
```

Expected: all green.

- [ ] **Step 2: Local smoke check (manual).**

```bash
pnpm dev
```

Then in the browser at `http://localhost:3000`:

- Home `/` — drag the Area slider and Crag slider horizontally with the mouse. Cards have visible padding at first/last positions.
- Area `/a/<known-slug>` — overview map shows all Crags. Clicking a marker scrolls the corresponding card into view with a brief highlight. Crag cards are horizontally centered.
- Crag `/c/<known-slug>?tab=boulder` — clicking a boulder card navigates to `?tab=route&boulderId=<id>`. The Route tab shows only that boulder's routes plus a "필터 해제" chip.
- Admin `/admin/content/areas` — top toolbar has "+ New Area" button. Clicking opens a Drawer with the Create form. No inline Create card visible above the list.
- Admin `/admin/content/sectors?cragId=<crag-id>` (without areaId) — the list filters correctly by crag. Both Area and Crag dropdowns are visible with full options.
- Admin `/admin/content/sectors?new=true&cragId=<crag-id>` — Drawer opens with `cragId` prefilled in the create form.

- [ ] **Step 3: Confirm no legacy artifacts.**

```bash
# Sanity grep: no <AdminCard title="Create ...> blocks remaining at top of list pages
grep -rn 'AdminCard title="Create' app/admin/
# Expected: zero matches.

# Sanity grep: no /topos/ public links (regression check)
grep -rn '/topos/' app/ components/ lib/
# Expected: only R2 storage URLs under cdn.granite.kr.
```

- [ ] **Step 4: Commit any final docs update if needed.**

```bash
# Only if anything was overlooked above.
```

---

## Out-of-Scope

- Visual design refinements beyond the explicit issues (font, spacing, color tweaks not driven by Figma changes).
- Pagination/typeahead on admin parent dropdowns (deferred until they exceed ~200 options).
- Marker clustering on Area overview map (deferred until an Area exceeds ~30 Crags).
- New schema columns (e.g. address/directions on Crag) — not required by any of the 7 fixes.
