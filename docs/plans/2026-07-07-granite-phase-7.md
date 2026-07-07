# Granite Phase 7 Route Detail UX Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the Route detail experience so the Topo route row uses the new Figma-driven `More` action, shows route detail information with `Location` wording, and preserves the existing Beta video and manual submission paths.

**Architecture:** Keep `/r/[routeId]` as the canonical redirect into `/t/[topoId]?route=<routeId>` and implement the Phase 7 UI inside the Topo route sheet. Replace the small `beta` pill with a new client-side `RouteMoreActions` entrypoint that opens a `RouteMoreSheet`; the sheet owns route metadata display, Location wording, approved Beta video grid, caption copy, and manual Beta upload entry. Do not add schema or query changes unless the Figma inspection proves a field is unavailable from the existing `TopoDetail` and `Route` objects.

**Tech Stack:** Next.js App Router, React Server Components by default, TypeScript strict, Tailwind CSS, Vitest, React Testing Library, existing D1-backed repository reads.

---

## Product References

- Route detail update: [Figma node `56-1738`](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=56-1738&t=Nj8NzKW38WUPfN3F-4)
- More sheet detail: [Figma node `56-1870`](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=56-1870&t=Nj8NzKW38WUPfN3F-4)

## Scope

In scope:

- `Beta` pill text changes to `More`.
- More click opens route detail information.
- More sheet includes `Location` wording.
- Existing approved Beta videos remain reachable.
- Existing manual Beta upload remains reachable.
- `/r/[routeId]` redirect behavior remains unchanged.
- No Favorites/Project work.
- No Records/Add Record work.
- No Claims work.

Out of scope:

- `favorites` migration and route save action.
- `/me/projects` implementation.
- `/me/records` implementation.
- Beta claim mutation.
- New route database columns.

## Current Code Map

- `app/(site)/r/[routeId]/page.tsx`
  - Current route detail URL handler.
  - Fetches `findRouteById(routeId)` and redirects to `/t/${route.topoId}?route=${route.id}`.
  - Keep this behavior.
- `app/(site)/t/[topoId]/page.tsx`
  - Current Topo detail page and route row rendering.
  - Builds caption per route.
  - Fetches approved Beta videos per route.
  - Currently imports `BetaRouteActions`.
- `components/public/beta-route-actions.tsx`
  - Current small `beta` button and Beta sheet opener.
  - Replace usage with the new `RouteMoreActions`.
- `components/public/beta-video-sheet.tsx`
  - Current Beta-specific sheet.
  - Keep available. Phase 7 can move its useful behavior into `RouteMoreSheet` without deleting this file.
- `components/public/beta-video-grid.tsx`
  - Reuse for approved Beta videos inside More.
- `components/public/manual-beta-form.tsx`
  - Reuse for manual Beta submission inside More.
- `lib/db/schema.ts`
  - Existing `Route`, `TopoDetail`, `Boulder`, `Sector`, `Crag` types provide route, boulder, sector, crag, and coordinates.

## Planned File Changes

- Create: `components/public/route-more-sheet.tsx`
  - Client component for the More bottom sheet.
  - Displays route details and the Beta video/manual submission section.
- Create: `components/public/route-more-actions.tsx`
  - Client component for the `More` pill button and sheet open state.
- Create: `components/public/route-more-actions.test.tsx`
  - Tests button label, sheet open/close behavior, route detail rendering, and manual form entrypoint.
- Modify: `app/(site)/t/[topoId]/page.tsx`
  - Replace `BetaRouteActions` import and usage with `RouteMoreActions`.
  - Pass route, topo/boulder/sector/crag context, caption, and beta videos.
- Create: `app/(site)/t/[topoId]/page.test.tsx`
  - Source-level regression test that verifies Topo page imports `RouteMoreActions` and no longer renders `BetaRouteActions`.
- Optional delete after verification: `components/public/beta-route-actions.tsx`
  - Delete only if no remaining import exists.
  - If deleted, also remove its tests if added during implementation.

---

## Task 1: Add Route More Component Tests

**Files:**
- Create: `components/public/route-more-actions.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `components/public/route-more-actions.test.tsx`:

```tsx
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouteMoreActions } from "./route-more-actions";
import type { BetaVideoItem } from "./beta-video-grid";

const betaVideos: BetaVideoItem[] = [
  {
    id: "beta_1",
    mediaUrl: "https://www.instagram.com/reel/example/",
    thumbnailUrl: "https://cdn.granite.kr/betas/beta_1/thumb.jpg",
    displayName: "granite_user"
  }
];

const baseProps = {
  route: {
    id: "route_1",
    name: "Little Finger",
    grade: "V5",
    fa: "FA Unknown",
    description: "왼손 언더와 오른손 크림프를 이용해 오른다."
  },
  locationLabel: "Location",
  locationValue: "현충바위 · 메인섹터 · 리틀핑거 바위",
  caption: "[현충바위] 메인섹터 / 리틀핑거 바위 / Little Finger (V5)\n@granite.kr #리틀핑거바위 #LittleFinger",
  betaVideos
};

describe("RouteMoreActions", () => {
  it("opens route details from the More button", () => {
    render(<RouteMoreActions {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "More" }));

    expect(screen.getByRole("dialog", { name: "Little Finger 상세 정보" })).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByText("현충바위 · 메인섹터 · 리틀핑거 바위")).toBeInTheDocument();
    expect(screen.getByText("V5")).toBeInTheDocument();
    expect(screen.getByText("FA Unknown")).toBeInTheDocument();
    expect(screen.getByText("베타 동영상")).toBeInTheDocument();
    expect(screen.getByLabelText("granite_user 베타 영상 열기")).toBeInTheDocument();
  });

  it("closes the sheet", () => {
    render(<RouteMoreActions {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(screen.queryByRole("dialog", { name: "Little Finger 상세 정보" })).not.toBeInTheDocument();
  });

  it("opens the manual beta form from the More sheet", () => {
    render(<RouteMoreActions {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("button", { name: "베타 영상 올리기" }));

    expect(screen.getByText("Instagram 또는 YouTube 링크")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
pnpm test -- components/public/route-more-actions.test.tsx
```

Expected: FAIL because `components/public/route-more-actions.tsx` does not exist.

- [ ] **Step 3: Commit the failing test**

```bash
git add components/public/route-more-actions.test.tsx
git commit -m "test: add route more action coverage"
```

---

## Task 2: Implement Route More Actions and Sheet

**Files:**
- Create: `components/public/route-more-actions.tsx`
- Create: `components/public/route-more-sheet.tsx`
- Test: `components/public/route-more-actions.test.tsx`

- [ ] **Step 1: Add the More action wrapper**

Create `components/public/route-more-actions.tsx`:

```tsx
"use client";

import { useState } from "react";
import { RouteMoreSheet, type RouteMoreSheetProps } from "./route-more-sheet";

export type RouteMoreActionsProps = Omit<RouteMoreSheetProps, "onClose">;

export function RouteMoreActions(props: RouteMoreActionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-6 w-[72px] items-center justify-center rounded-full bg-[#E8E8E8] text-[12px] font-medium leading-4 text-[#3A3A3A]"
      >
        More
      </button>
      {open ? <RouteMoreSheet {...props} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
```

- [ ] **Step 2: Add the More sheet**

Create `components/public/route-more-sheet.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ManualBetaForm } from "./manual-beta-form";
import { BetaVideoGrid, type BetaVideoItem } from "./beta-video-grid";

export type RouteMoreSheetProps = {
  route: {
    id: string;
    name: string;
    grade: string;
    fa: string;
    description: string;
  };
  locationLabel: string;
  locationValue: string;
  caption: string;
  betaVideos: BetaVideoItem[];
  onClose: () => void;
};

export function RouteMoreSheet({
  route,
  locationLabel,
  locationValue,
  caption,
  betaVideos,
  onClose
}: RouteMoreSheetProps) {
  const [showManualForm, setShowManualForm] = useState(false);

  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, []);

  const instagramHref = useMemo(
    () => `https://www.instagram.com/?caption=${encodeURIComponent(caption)}`,
    [caption]
  );

  async function copyAndOpenInstagram() {
    await navigator.clipboard.writeText(caption);
    window.open(instagramHref, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="fixed inset-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 bg-black/60">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${route.name} 상세 정보`}
        className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-[12px] bg-white"
      >
        <div className="mx-auto mt-2 h-[2px] w-8 rounded-full bg-[#B8B8B8]" />
        <header className="relative flex h-[44px] items-center justify-center border-b border-[#E8E8E8]">
          <h2 className="text-[18px] font-medium leading-6 text-[#090909]">More</h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 grid size-6 place-items-center text-[28px] leading-none text-[#121212]"
            aria-label="닫기"
          >
            ×
          </button>
        </header>

        <div className="px-4 pb-6 pt-4">
          <div className="border-b border-[#E8E8E8] pb-4">
            <h3 className="text-[20px] font-semibold leading-7 text-[#090909]">{route.name}</h3>
            <dl className="mt-4 space-y-3 text-[14px] leading-5">
              <RouteDetailRow label="Grade" value={route.grade} />
              <RouteDetailRow label={locationLabel} value={locationValue} />
              <RouteDetailRow label="FA" value={route.fa || "-"} />
              <RouteDetailRow label="Description" value={route.description || "-"} />
            </dl>
          </div>

          <section className="pt-4">
            <h3 className="text-[18px] font-medium leading-6 text-[#090909]">베타 동영상</h3>
            <p className="mt-2 text-[14px] font-normal leading-5 text-[#2A2A2A]">
              캡션을 복사하여 인스타그램 게시물에 넣어주면 베타 영상이 루트에 연결됩니다.
            </p>
            <div className="mt-4 rounded-[10px] bg-[#F7F8F8] px-4 py-3 text-[14px] font-normal leading-5 text-[#2A2A2A]">
              <p>캡션</p>
              <p className="line-clamp-2 whitespace-pre-wrap">{caption}</p>
            </div>
            <div className="mt-2 space-y-2">
              <button
                type="button"
                onClick={copyAndOpenInstagram}
                className="h-8 w-full rounded-full bg-[#1A1A1A] text-[14px] font-medium leading-5 text-white"
              >
                캡션 복사하고 Instagram 열기
              </button>
              <button
                type="button"
                onClick={() => setShowManualForm(true)}
                className="h-8 w-full rounded-full bg-[#1A1A1A] text-[14px] font-medium leading-5 text-white"
              >
                베타 영상 올리기
              </button>
            </div>
          </section>
        </div>

        <BetaVideoGrid items={betaVideos} />
      </section>

      {showManualForm ? (
        <ManualBetaForm routeId={route.id} onClose={() => setShowManualForm(false)} />
      ) : null}
    </div>
  );
}

function RouteDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[86px_1fr] gap-3">
      <dt className="font-medium text-[#7A7A7A]">{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap font-medium text-[#2A2A2A]">{value}</dd>
    </div>
  );
}
```

- [ ] **Step 3: Run the component test**

Run:

```bash
pnpm test -- components/public/route-more-actions.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/public/route-more-actions.tsx components/public/route-more-sheet.tsx components/public/route-more-actions.test.tsx
git commit -m "feat: add route more sheet"
```

---

## Task 3: Wire More Into the Topo Route Sheet

**Files:**
- Modify: `app/(site)/t/[topoId]/page.tsx`
- Create: `app/(site)/t/[topoId]/page.test.tsx`

- [ ] **Step 1: Add a source-level regression test**

Create `app/(site)/t/[topoId]/page.test.tsx`:

```tsx
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFileSync(join(process.cwd(), "app/(site)/t/[topoId]/page.tsx"), "utf8");

describe("Topo route detail page Phase 7 wiring", () => {
  it("uses the RouteMoreActions entrypoint instead of the old beta action", () => {
    const text = source();

    expect(text).toContain('import { RouteMoreActions } from "@/components/public/route-more-actions"');
    expect(text).not.toContain("BetaRouteActions");
    expect(text).toContain("locationLabel=\"Location\"");
    expect(text).toContain("locationValue=");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
pnpm test -- 'app/(site)/t/[topoId]/page.test.tsx'
```

Expected: FAIL because the page still imports `BetaRouteActions`.

- [ ] **Step 3: Replace the import**

In `app/(site)/t/[topoId]/page.tsx`, replace:

```tsx
import { BetaRouteActions } from "@/components/public/beta-route-actions";
```

with:

```tsx
import { RouteMoreActions } from "@/components/public/route-more-actions";
```

- [ ] **Step 4: Replace the route action usage**

Inside `TopoRouteSheet`, replace:

```tsx
<BetaRouteActions routeId={route.id} caption={caption} betaVideos={betaVideos} />
```

with:

```tsx
<RouteMoreActions
  route={{
    id: route.id,
    name: route.name,
    grade: route.grade,
    fa: route.fa,
    description: route.description
  }}
  locationLabel="Location"
  locationValue={`${topo.crag.name} · ${topo.sector.name} · ${topo.boulder.name}`}
  caption={caption}
  betaVideos={betaVideos}
/>
```

- [ ] **Step 5: Run the wiring test**

Run:

```bash
pnpm test -- 'app/(site)/t/[topoId]/page.test.tsx'
```

Expected: PASS.

- [ ] **Step 6: Run the route More component test**

Run:

```bash
pnpm test -- components/public/route-more-actions.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add 'app/(site)/t/[topoId]/page.tsx' 'app/(site)/t/[topoId]/page.test.tsx'
git commit -m "feat: wire route more actions into topo detail"
```

---

## Task 4: Clean Up Old Beta Action Entrypoint

**Files:**
- Optional delete: `components/public/beta-route-actions.tsx`
- Modify if deleted: no page files should import it

- [ ] **Step 1: Check remaining imports**

Run:

```bash
rg -n "BetaRouteActions|beta-route-actions" app components lib
```

Expected after Task 3: no output.

- [ ] **Step 2: Delete the old component if there are no remaining imports**

Run:

```bash
git rm components/public/beta-route-actions.tsx
```

Expected: file removed from git index.

- [ ] **Step 3: Run focused tests**

Run:

```bash
pnpm test -- components/public/route-more-actions.test.tsx 'app/(site)/t/[topoId]/page.test.tsx'
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/public/route-more-actions.tsx components/public/route-more-sheet.tsx
git commit -m "refactor: remove old beta route action"
```

If `git rm` already staged the deletion, the `git add` command keeps the final commit index complete.

---

## Task 5: Visual and Interaction Verification

**Files:**
- No planned source changes unless verification reveals a concrete layout defect.

- [ ] **Step 1: Run unit tests**

Run:

```bash
pnpm test -- components/public/route-more-actions.test.tsx 'app/(site)/t/[topoId]/page.test.tsx'
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: exit code 0.

- [ ] **Step 3: Run full test suite**

Run:

```bash
pnpm test
```

Expected: exit code 0.

- [ ] **Step 4: Run build**

Run:

```bash
pnpm build
```

Expected: exit code 0.

- [ ] **Step 5: Browser smoke check**

Start the app:

```bash
pnpm dev
```

Open a known Topo route URL such as:

```text
http://localhost:3000/t/<topoId>?route=<routeId>
```

Verify:

- The selected route row shows `More`, not `beta`.
- Tapping `More` opens a bottom sheet.
- The sheet title and content match the Figma hierarchy.
- `Location` appears exactly as the label.
- Location value uses `Crag · Sector · Boulder`.
- Grade, FA, and description are visible.
- Approved Beta videos still render in a grid.
- `베타 영상 올리기` opens the existing manual Beta form.
- Closing the sheet restores page scroll.
- The page remains within the mobile max width and has no horizontal overflow.

- [ ] **Step 6: Commit verification-only adjustments if needed**

If visual QA requires CSS-only adjustments, commit them with:

```bash
git add components/public/route-more-actions.tsx components/public/route-more-sheet.tsx 'app/(site)/t/[topoId]/page.tsx'
git commit -m "fix: polish route more sheet layout"
```

---

## Implementation Notes

- Keep `RouteMoreActions` as the only stateful button entrypoint used by Topo route rows.
- Keep `RouteMoreSheet` focused on one route. Do not make it aware of all routes in a topo.
- Keep the route detail data passed from the server-rendered Topo page. Do not add a client fetch.
- Keep the `caption` generation in `app/(site)/t/[topoId]/page.tsx`; Phase 7 changes presentation, not caption semantics.
- Keep Beta creation status behavior unchanged. Manual submissions still use existing Phase 5 pending/moderation flow.
- Keep `/r/[routeId]` redirect behavior unchanged, because existing links and Route table rows rely on `/t/[topoId]?route=<routeId>`.

## Self-Review

- Spec coverage: Phase 7 Route detail update, `Location` wording, `Beta -> More`, and More-click detail information are covered by Tasks 1-3 and the browser smoke checklist.
- Explicit exclusions: Favorites, Claims, Records, Add Record UI, and schema changes are excluded from this plan.
- Placeholder scan: This plan contains concrete file paths, commands, expected outcomes, and code snippets for each implementation step.
- Type consistency: `RouteMoreActionsProps` is defined as `Omit<RouteMoreSheetProps, "onClose">`, and all page usage passes the same fields consumed by `RouteMoreSheet`.
