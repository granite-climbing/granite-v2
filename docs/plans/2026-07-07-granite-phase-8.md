# Granite Phase 8 Project Tab / Favorites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the scaffolded Project tab into a working logged-in Route save list, with Route detail save/remove actions backed by a D1 `favorites` table.

**Architecture:** Keep personalization behind the existing `granite_session` cookie and implement all mutations as Server Actions. Store saved Routes in a generic `favorites` table using `target_type = 'route'`, but only expose Route favorites in Phase 8. Public route reads stay in `lib/db/queries.ts`; user-specific favorites reads and writes live in a new `lib/db/project-queries.ts` boundary and are never cached with public content tags.

**Tech Stack:** Next.js App Router, React Server Components by default, Server Actions, TypeScript strict, Cloudflare D1 HTTP API, Tailwind CSS, Vitest, React Testing Library.

---

## Product References

- Roadmap scope: `docs/ROADMAP.md#phase-8--project-tab--favorites`
- Figma: [Project tab node `56-975`](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=56-975&t=Nj8NzKW38WUPfN3F-4)
- Existing scaffold: `app/(site)/me/projects/page.tsx`
- Existing auth pattern: `app/(site)/me/page.tsx`
- Existing session helper: `lib/auth/session.ts`

## Scope

In scope:

- Add `favorites` D1 migration.
- Add typed favorites/project query boundary.
- Add Route save/remove Server Actions.
- Add logged-in `/me/projects` page with saved Route cards, empty state, and remove UX.
- Add a Route detail save/remove entrypoint after Phase 7 More UI is in place.
- Redirect anonymous Project tab access to `/login?returnTo=/me/projects`.
- When an anonymous user taps save on a Route, route them to `/login?returnTo=<current-route-url>`.
- Prevent duplicate saves with a DB unique constraint and idempotent Server Action behavior.

Out of scope:

- Records tab, add-record flow, and record analytics.
- Instagram/YouTube account ownership verification.
- Unclaimed Beta claim.
- Crag/Sector/Boulder favorites.
- Public sharing of project lists.
- A working project privacy toggle. Keep the `/me` Project privacy row disabled until public profile semantics are specified.

## Assumptions

- "Project" means a user's saved Route list, not a named collection system.
- The first implementation supports only `target_type = 'route'` even though the table shape leaves room for future target types.
- Project list order is newest saved first unless the Figma inspection requires another order.
- Route save state is user-specific and must not be placed inside `unstable_cache` public read models.
- The save action should be available from Route detail/More UI. If Phase 7 is not merged yet, implement the action in the current Topo route row and move it into More during Phase 7 integration.

## Current Code Map

- `migrations/0009_user_auth.sql`
  - Last migration. Phase 8 should add `migrations/0010_user_favorites.sql`.
- `lib/db/schema.ts`
  - Add `FavoriteTargetType`, `Favorite`, and `SavedRouteListItem` types.
- `lib/db/queries.ts`
  - Existing public route hierarchy queries. Do not add user-specific favorites here unless a helper is purely public.
- `lib/db/user-auth-queries.ts`
  - Existing logged-in user lookup patterns.
- `lib/actions/beta.ts`
  - Server Action style example with D1 writes and revalidation.
- `app/(site)/me/page.tsx`
  - Existing protected user page pattern.
- `app/(site)/me/projects/page.tsx`
  - Current scaffold to replace.
- `app/(site)/t/[topoId]/page.tsx`
  - Topo detail route rows. Add save state/action props here or in Phase 7 More component.
- `components/layout/bottom-nav.tsx`
  - Existing bottom tab behavior. No expected Phase 8 structural change.

## Planned File Changes

- Create: `migrations/0010_user_favorites.sql`
  - Adds `favorites` table, uniqueness, target type check, and read indexes. `target_id` is validated against published Routes in Server Actions because the table is intentionally shaped for future non-Route targets.
- Modify: `lib/db/schema.ts`
  - Adds typed favorite and saved route list item models.
- Create: `lib/db/project-queries.ts`
  - User-specific favorites reads and writes.
- Create: `lib/db/project-queries.test.ts`
  - Tests SQL boundaries and idempotent operations with mocked D1 helpers.
- Create: `lib/actions/project.ts`
  - Server Actions for save/remove Route favorite.
- Create: `lib/actions/project.test.ts`
  - Tests auth guard, published route validation, duplicate-safe save, remove, and redirects.
- Create: `components/public/route-save-action.tsx`
  - Client leaf for save/remove button state and form submission.
- Create: `components/public/route-save-action.test.tsx`
  - Tests logged-in/logged-out labels and action form payloads.
- Create: `components/public/project-route-card.tsx`
  - Saved Route card used by `/me/projects`.
- Create: `components/public/project-route-card.test.tsx`
  - Tests route context rendering and remove affordance.
- Modify: `app/(site)/me/projects/page.tsx`
  - Replace scaffold with protected saved Route list page.
- Create: `app/(site)/me/projects/page.test.ts`
  - Source-level regression for auth redirect and query usage.
- Modify: `app/(site)/t/[topoId]/page.tsx`
  - Include route save state/action in route detail UI.
- Modify: `components/public/route-more-actions.tsx` and/or `components/public/route-more-sheet.tsx`
  - If Phase 7 files exist, place Route save action in the More sheet.

---

## Task 1: Add Favorites Migration

**Files:**
- Create: `migrations/0010_user_favorites.sql`

- [ ] **Step 1: Create the migration**

Create `migrations/0010_user_favorites.sql`:

```sql
-- Granite Phase 8 user favorites schema
-- Roll-forward only.

CREATE TABLE IF NOT EXISTS favorites (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('route')),
  target_id   TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_created_at
  ON favorites (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_favorites_target
  ON favorites (target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_favorites_user_target
  ON favorites (user_id, target_type, target_id);
```

- [ ] **Step 2: Validate migration order**

Run:

```bash
ls migrations
```

Expected: `0010_user_favorites.sql` appears after `0009_user_auth.sql`.

- [ ] **Step 3: Commit**

```bash
git add migrations/0010_user_favorites.sql
git commit -m "feat: add user favorites migration"
```

## Task 2: Add Project Query Boundary

**Files:**
- Modify: `lib/db/schema.ts`
- Create: `lib/db/project-queries.ts`
- Create: `lib/db/project-queries.test.ts`

- [ ] **Step 1: Add schema types**

Add to `lib/db/schema.ts` near user types:

```ts
export type FavoriteTargetType = "route";

export type Favorite = {
  id: string;
  userId: string;
  targetType: FavoriteTargetType;
  targetId: string;
  createdAt: string;
};

export type SavedRouteListItem = RouteListItem & {
  favoriteId: string;
  savedAt: string;
};
```

- [ ] **Step 2: Write query tests**

Create `lib/db/project-queries.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addRouteFavorite,
  findPublishedRouteForFavorite,
  isRouteFavoritedByUser,
  listSavedRoutesForUser,
  removeRouteFavorite
} from "./project-queries";

const queryD1Mock = vi.hoisted(() => vi.fn());
const queryD1FirstMock = vi.hoisted(() => vi.fn());
const executeD1Mock = vi.hoisted(() => vi.fn());
const randomUUIDMock = vi.hoisted(() => vi.fn());

vi.mock("./d1-http", () => ({
  queryD1: queryD1Mock,
  queryD1First: queryD1FirstMock,
  executeD1: executeD1Mock
}));

vi.mock("node:crypto", () => ({
  randomUUID: randomUUIDMock
}));

describe("project queries", () => {
  beforeEach(() => {
    queryD1Mock.mockReset();
    queryD1FirstMock.mockReset();
    executeD1Mock.mockReset();
    randomUUIDMock.mockReset();
    randomUUIDMock.mockReturnValue("favorite-uuid");
  });

  it("lists saved routes for a user newest first", async () => {
    queryD1Mock.mockResolvedValueOnce([
      {
        favoriteId: "fav_1",
        savedAt: "2026-07-07 10:00:00",
        id: "route_1",
        topoId: "topo_1",
        name: "Little Finger",
        slug: "little-finger",
        grade: "V5",
        gradeNum: 5,
        fa: "Unknown",
        description: "Route description",
        lineImageUrl: "https://cdn.granite.kr/routes/route_1/line.jpg",
        isPublished: 1,
        sortOrder: 1,
        boulderId: "boulder_1",
        boulderName: "리틀핑거 바위",
        sectorName: "메인 섹터",
        cragName: "현충바위",
        cragSlug: "hyeonchung",
        sectorSlug: "main"
      }
    ]);

    const routes = await listSavedRoutesForUser("user_1");

    expect(queryD1Mock).toHaveBeenCalledWith(expect.stringContaining("FROM favorites f"), ["user_1"]);
    expect(queryD1Mock.mock.calls[0][0]).toContain("ORDER BY f.created_at DESC");
    expect(routes).toEqual([
      expect.objectContaining({
        favoriteId: "fav_1",
        savedAt: "2026-07-07 10:00:00",
        id: "route_1",
        name: "Little Finger",
        isPublished: true,
        cragName: "현충바위"
      })
    ]);
  });

  it("checks that a route is published before saving", async () => {
    queryD1FirstMock.mockResolvedValueOnce({ id: "route_1" });

    const route = await findPublishedRouteForFavorite("route_1");

    expect(queryD1FirstMock).toHaveBeenCalledWith(expect.stringContaining("WHERE r.id = ?"), ["route_1"]);
    expect(queryD1FirstMock.mock.calls[0][0]).toContain("r.is_published = 1");
    expect(route).toEqual({ id: "route_1" });
  });

  it("adds a route favorite idempotently", async () => {
    await addRouteFavorite("user_1", "route_1");

    expect(executeD1Mock).toHaveBeenCalledWith(expect.stringContaining("INSERT OR IGNORE INTO favorites"), [
      "fav_favorite-uuid",
      "user_1",
      "route",
      "route_1"
    ]);
  });

  it("removes a route favorite for the current user", async () => {
    await removeRouteFavorite("user_1", "route_1");

    expect(executeD1Mock).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM favorites"), [
      "user_1",
      "route",
      "route_1"
    ]);
  });

  it("checks whether a route is already saved", async () => {
    queryD1FirstMock.mockResolvedValueOnce({ id: "fav_1" });

    const saved = await isRouteFavoritedByUser("user_1", "route_1");

    expect(saved).toBe(true);
    expect(queryD1FirstMock).toHaveBeenCalledWith(expect.stringContaining("LIMIT 1"), [
      "user_1",
      "route",
      "route_1"
    ]);
  });
});
```

- [ ] **Step 3: Run the tests and verify they fail**

Run:

```bash
pnpm test -- lib/db/project-queries.test.ts
```

Expected: FAIL because `lib/db/project-queries.ts` does not exist.

- [ ] **Step 4: Implement query functions**

Create `lib/db/project-queries.ts`:

```ts
import { randomUUID } from "node:crypto";
import { executeD1, queryD1, queryD1First } from "./d1-http";
import type { SavedRouteListItem } from "./schema";

type SavedRouteListItemRow = Omit<SavedRouteListItem, "isPublished"> & {
  isPublished: 0 | 1;
};

function mapSavedRoute(row: SavedRouteListItemRow): SavedRouteListItem {
  return { ...row, isPublished: row.isPublished === 1 };
}

export async function listSavedRoutesForUser(userId: string): Promise<SavedRouteListItem[]> {
  const rows = await queryD1<SavedRouteListItemRow>(
    `SELECT
       f.id AS favoriteId,
       f.created_at AS savedAt,
       r.id,
       r.topo_id AS topoId,
       r.name,
       r.slug,
       r.grade,
       r.grade_num AS gradeNum,
       r.fa,
       r.description,
       r.line_image_url AS lineImageUrl,
       r.is_published AS isPublished,
       r.sort_order AS sortOrder,
       b.id AS boulderId,
       b.name AS boulderName,
       s.name AS sectorName,
       c.name AS cragName,
       c.slug AS cragSlug,
       s.slug AS sectorSlug
     FROM favorites f
     JOIN routes r ON r.id = f.target_id
     JOIN topos t ON t.id = r.topo_id
     JOIN boulders b ON b.id = t.boulder_id
     JOIN sectors s ON s.id = b.sector_id
     JOIN crags c ON c.id = s.crag_id
     JOIN areas a ON a.id = c.area_id
     WHERE f.user_id = ?
       AND f.target_type = 'route'
       AND r.is_published = 1
       AND t.is_published = 1
       AND b.is_published = 1
       AND s.is_published = 1
       AND c.is_published = 1
       AND a.is_published = 1
       AND r.deleted_at IS NULL
       AND t.deleted_at IS NULL
       AND b.deleted_at IS NULL
       AND s.deleted_at IS NULL
       AND c.deleted_at IS NULL
       AND a.deleted_at IS NULL
     ORDER BY f.created_at DESC`,
    [userId]
  );

  return rows.map(mapSavedRoute);
}

export async function findPublishedRouteForFavorite(routeId: string): Promise<{ id: string } | null> {
  return queryD1First<{ id: string }>(
    `SELECT r.id
     FROM routes r
     JOIN topos t ON t.id = r.topo_id
     JOIN boulders b ON b.id = t.boulder_id
     JOIN sectors s ON s.id = b.sector_id
     JOIN crags c ON c.id = s.crag_id
     JOIN areas a ON a.id = c.area_id
     WHERE r.id = ?
       AND r.is_published = 1
       AND t.is_published = 1
       AND b.is_published = 1
       AND s.is_published = 1
       AND c.is_published = 1
       AND a.is_published = 1
       AND r.deleted_at IS NULL
       AND t.deleted_at IS NULL
       AND b.deleted_at IS NULL
       AND s.deleted_at IS NULL
       AND c.deleted_at IS NULL
       AND a.deleted_at IS NULL
     LIMIT 1`,
    [routeId]
  );
}

export async function addRouteFavorite(userId: string, routeId: string): Promise<void> {
  await executeD1(
    `INSERT OR IGNORE INTO favorites (id, user_id, target_type, target_id)
     VALUES (?, ?, ?, ?)`,
    [`fav_${randomUUID()}`, userId, "route", routeId]
  );
}

export async function removeRouteFavorite(userId: string, routeId: string): Promise<void> {
  await executeD1(
    `DELETE FROM favorites
     WHERE user_id = ? AND target_type = ? AND target_id = ?`,
    [userId, "route", routeId]
  );
}

export async function isRouteFavoritedByUser(userId: string, routeId: string): Promise<boolean> {
  const row = await queryD1First<{ id: string }>(
    `SELECT id
     FROM favorites
     WHERE user_id = ? AND target_type = ? AND target_id = ?
     LIMIT 1`,
    [userId, "route", routeId]
  );

  return Boolean(row);
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm test -- lib/db/project-queries.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.ts lib/db/project-queries.ts lib/db/project-queries.test.ts
git commit -m "feat: add project favorites queries"
```

## Task 3: Add Route Favorite Server Actions

**Files:**
- Create: `lib/actions/project.ts`
- Create: `lib/actions/project.test.ts`

- [ ] **Step 1: Write Server Action tests**

Create `lib/actions/project.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { USER_SESSION_COOKIE_NAME, createUserSessionToken } from "@/lib/auth/session";
import {
  addRouteFavorite,
  findPublishedRouteForFavorite,
  removeRouteFavorite
} from "@/lib/db/project-queries";
import { saveRouteProjectAction, removeRouteProjectAction } from "./project";

const cookiesMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  })
);
const revalidatePathMock = vi.hoisted(() => vi.fn());
const addRouteFavoriteMock = vi.hoisted(() => vi.fn());
const removeRouteFavoriteMock = vi.hoisted(() => vi.fn());
const findPublishedRouteForFavoriteMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/db/project-queries", () => ({
  addRouteFavorite: addRouteFavoriteMock,
  removeRouteFavorite: removeRouteFavoriteMock,
  findPublishedRouteForFavorite: findPublishedRouteForFavoriteMock
}));

describe("project actions", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "project-action-test-secret";
    cookiesMock.mockReset();
    redirectMock.mockClear();
    revalidatePathMock.mockReset();
    addRouteFavoriteMock.mockReset();
    removeRouteFavoriteMock.mockReset();
    findPublishedRouteForFavoriteMock.mockReset();
  });

  it("redirects anonymous users to login when saving", async () => {
    cookiesMock.mockResolvedValue({ get: () => undefined });
    const formData = new FormData();
    formData.set("routeId", "route_1");
    formData.set("returnTo", "/t/topo_1?route=route_1");

    await expect(saveRouteProjectAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/login?returnTo=%2Ft%2Ftopo_1%3Froute%3Droute_1"
    );
  });

  it("saves a published route for the logged-in user", async () => {
    const token = await createUserSessionToken({ userId: "user_1" });
    cookiesMock.mockResolvedValue({
      get: (name: string) => (name === USER_SESSION_COOKIE_NAME ? { value: token } : undefined)
    });
    findPublishedRouteForFavoriteMock.mockResolvedValue({ id: "route_1" });
    const formData = new FormData();
    formData.set("routeId", "route_1");
    formData.set("returnTo", "/t/topo_1?route=route_1");

    const result = await saveRouteProjectAction(formData);

    expect(findPublishedRouteForFavorite).toHaveBeenCalledWith("route_1");
    expect(addRouteFavorite).toHaveBeenCalledWith("user_1", "route_1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/me/projects");
    expect(revalidatePathMock).toHaveBeenCalledWith("/t/topo_1?route=route_1");
    expect(result).toEqual({ ok: true, message: "프로젝트에 저장했습니다." });
  });

  it("rejects an unpublished or missing route", async () => {
    const token = await createUserSessionToken({ userId: "user_1" });
    cookiesMock.mockResolvedValue({
      get: (name: string) => (name === USER_SESSION_COOKIE_NAME ? { value: token } : undefined)
    });
    findPublishedRouteForFavoriteMock.mockResolvedValue(null);
    const formData = new FormData();
    formData.set("routeId", "route_missing");
    formData.set("returnTo", "/me/projects");

    const result = await saveRouteProjectAction(formData);

    expect(result).toEqual({ ok: false, message: "저장할 수 없는 루트입니다." });
    expect(addRouteFavoriteMock).not.toHaveBeenCalled();
  });

  it("removes a route favorite for the logged-in user", async () => {
    const token = await createUserSessionToken({ userId: "user_1" });
    cookiesMock.mockResolvedValue({
      get: (name: string) => (name === USER_SESSION_COOKIE_NAME ? { value: token } : undefined)
    });
    const formData = new FormData();
    formData.set("routeId", "route_1");
    formData.set("returnTo", "/me/projects");

    const result = await removeRouteProjectAction(formData);

    expect(removeRouteFavorite).toHaveBeenCalledWith("user_1", "route_1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/me/projects");
    expect(result).toEqual({ ok: true, message: "프로젝트에서 제거했습니다." });
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
pnpm test -- lib/actions/project.test.ts
```

Expected: FAIL because `lib/actions/project.ts` does not exist.

- [ ] **Step 3: Implement Server Actions**

Create `lib/actions/project.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import {
  addRouteFavorite,
  findPublishedRouteForFavorite,
  removeRouteFavorite
} from "@/lib/db/project-queries";

export type ProjectActionResult = {
  ok: boolean;
  message: string;
};

const projectRouteSchema = z.object({
  routeId: z.string().min(1),
  returnTo: z.string().min(1).default("/me/projects")
});

async function requireUserSessionOrRedirect(returnTo: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifyUserSessionToken(token) : null;

  if (!session) {
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  return session;
}

function revalidateProjectPaths(returnTo: string) {
  revalidatePath("/me/projects");
  revalidatePath(returnTo);
}

export async function saveRouteProjectAction(formData: FormData): Promise<ProjectActionResult> {
  const parsed = projectRouteSchema.parse(Object.fromEntries(formData));
  const session = await requireUserSessionOrRedirect(parsed.returnTo);
  const route = await findPublishedRouteForFavorite(parsed.routeId);

  if (!route) {
    return { ok: false, message: "저장할 수 없는 루트입니다." };
  }

  await addRouteFavorite(session.userId, parsed.routeId);
  revalidateProjectPaths(parsed.returnTo);

  return { ok: true, message: "프로젝트에 저장했습니다." };
}

export async function removeRouteProjectAction(formData: FormData): Promise<ProjectActionResult> {
  const parsed = projectRouteSchema.parse(Object.fromEntries(formData));
  const session = await requireUserSessionOrRedirect(parsed.returnTo);

  await removeRouteFavorite(session.userId, parsed.routeId);
  revalidateProjectPaths(parsed.returnTo);

  return { ok: true, message: "프로젝트에서 제거했습니다." };
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm test -- lib/actions/project.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/project.ts lib/actions/project.test.ts
git commit -m "feat: add route project actions"
```

## Task 4: Build Route Save Action Component

**Files:**
- Create: `components/public/route-save-action.tsx`
- Create: `components/public/route-save-action.test.tsx`

- [ ] **Step 1: Write component tests**

Create `components/public/route-save-action.test.tsx`:

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RouteSaveAction } from "./route-save-action";

const saveAction = vi.fn();
const removeAction = vi.fn();

describe("RouteSaveAction", () => {
  it("renders a save form when the route is not saved", () => {
    render(
      <RouteSaveAction
        routeId="route_1"
        saved={false}
        loggedIn={true}
        returnTo="/t/topo_1?route=route_1"
        saveAction={saveAction}
        removeAction={removeAction}
      />
    );

    expect(screen.getByRole("button", { name: "프로젝트 저장" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("route_1")).toHaveAttribute("name", "routeId");
    expect(screen.getByDisplayValue("/t/topo_1?route=route_1")).toHaveAttribute("name", "returnTo");
  });

  it("renders a remove form when the route is saved", () => {
    render(
      <RouteSaveAction
        routeId="route_1"
        saved={true}
        loggedIn={true}
        returnTo="/t/topo_1?route=route_1"
        saveAction={saveAction}
        removeAction={removeAction}
      />
    );

    expect(screen.getByRole("button", { name: "저장됨" })).toBeInTheDocument();
  });

  it("renders a login prompt label for anonymous users", () => {
    render(
      <RouteSaveAction
        routeId="route_1"
        saved={false}
        loggedIn={false}
        returnTo="/t/topo_1?route=route_1"
        saveAction={saveAction}
        removeAction={removeAction}
      />
    );

    expect(screen.getByRole("button", { name: "로그인 후 저장" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
pnpm test -- components/public/route-save-action.test.tsx
```

Expected: FAIL because `components/public/route-save-action.tsx` does not exist.

- [ ] **Step 3: Implement component**

Create `components/public/route-save-action.tsx`:

```tsx
import type { ProjectActionResult } from "@/lib/actions/project";

type RouteSaveActionProps = {
  routeId: string;
  saved: boolean;
  loggedIn: boolean;
  returnTo: string;
  saveAction: (formData: FormData) => Promise<ProjectActionResult>;
  removeAction: (formData: FormData) => Promise<ProjectActionResult>;
};

export function RouteSaveAction({
  routeId,
  saved,
  loggedIn,
  returnTo,
  saveAction,
  removeAction
}: RouteSaveActionProps) {
  const action = saved ? removeAction : saveAction;
  const label = saved ? "저장됨" : loggedIn ? "프로젝트 저장" : "로그인 후 저장";
  const className = saved
    ? "h-9 rounded-full bg-black px-4 text-[13px] font-bold text-white"
    : "h-9 rounded-full border border-black px-4 text-[13px] font-bold text-black";

  return (
    <form action={action}>
      <input type="hidden" name="routeId" value={routeId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm test -- components/public/route-save-action.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/public/route-save-action.tsx components/public/route-save-action.test.tsx
git commit -m "feat: add route save action"
```

## Task 5: Implement Project Route Cards

**Files:**
- Create: `components/public/project-route-card.tsx`
- Create: `components/public/project-route-card.test.tsx`

- [ ] **Step 1: Write component tests**

Create `components/public/project-route-card.test.tsx`:

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectRouteCard } from "./project-route-card";
import type { SavedRouteListItem } from "@/lib/db/schema";

const removeAction = vi.fn();

const route: SavedRouteListItem = {
  favoriteId: "fav_1",
  savedAt: "2026-07-07 10:00:00",
  id: "route_1",
  topoId: "topo_1",
  name: "Little Finger",
  slug: "little-finger",
  grade: "V5",
  gradeNum: 5,
  fa: "Unknown",
  description: "Route description",
  lineImageUrl: "https://cdn.granite.kr/routes/route_1/line.jpg",
  isPublished: true,
  sortOrder: 1,
  boulderId: "boulder_1",
  boulderName: "리틀핑거 바위",
  sectorName: "메인 섹터",
  cragName: "현충바위",
  cragSlug: "hyeonchung",
  sectorSlug: "main"
};

describe("ProjectRouteCard", () => {
  it("renders saved route context", () => {
    render(<ProjectRouteCard route={route} removeAction={removeAction} />);

    expect(screen.getByRole("link", { name: "Little Finger V5" })).toHaveAttribute(
      "href",
      "/t/topo_1?route=route_1"
    );
    expect(screen.getByText("현충바위 · 메인 섹터 · 리틀핑거 바위")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "프로젝트에서 제거" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("route_1")).toHaveAttribute("name", "routeId");
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
pnpm test -- components/public/project-route-card.test.tsx
```

Expected: FAIL because `components/public/project-route-card.tsx` does not exist.

- [ ] **Step 3: Implement card**

Create `components/public/project-route-card.tsx`:

```tsx
import Link from "next/link";
import type { ProjectActionResult } from "@/lib/actions/project";
import type { SavedRouteListItem } from "@/lib/db/schema";

type ProjectRouteCardProps = {
  route: SavedRouteListItem;
  removeAction: (formData: FormData) => Promise<ProjectActionResult>;
};

export function ProjectRouteCard({ route, removeAction }: ProjectRouteCardProps) {
  const href = `/t/${route.topoId}?route=${route.id}`;
  const context = `${route.cragName} · ${route.sectorName} · ${route.boulderName}`;

  return (
    <article className="border-b border-[#ECECEC] px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <Link href={href} className="min-w-0">
          <span className="block text-[17px] font-black leading-6 text-black">
            {route.name} <span className="text-[#6F7477]">{route.grade}</span>
          </span>
          <span className="mt-1 block text-[12px] font-semibold leading-4 text-[#6F7477]">{context}</span>
        </Link>
        <form action={removeAction}>
          <input type="hidden" name="routeId" value={route.id} />
          <input type="hidden" name="returnTo" value="/me/projects" />
          <button
            type="submit"
            className="h-8 shrink-0 rounded-full border border-[#D9D9D9] px-3 text-[12px] font-bold text-[#4F5558]"
          >
            프로젝트에서 제거
          </button>
        </form>
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm test -- components/public/project-route-card.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/public/project-route-card.tsx components/public/project-route-card.test.tsx
git commit -m "feat: add project route card"
```

## Task 6: Replace `/me/projects` Scaffold

**Files:**
- Modify: `app/(site)/me/projects/page.tsx`
- Create: `app/(site)/me/projects/page.test.ts`

- [ ] **Step 1: Add source-level page test**

Create `app/(site)/me/projects/page.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("app/(site)/me/projects/page.tsx", "utf8");

describe("projects page source", () => {
  it("uses user session auth and redirects anonymous users", () => {
    expect(source).toContain("USER_SESSION_COOKIE_NAME");
    expect(source).toContain("verifyUserSessionToken");
    expect(source).toContain('redirect("/login?returnTo=/me/projects")');
  });

  it("loads saved routes and renders project route cards", () => {
    expect(source).toContain("listSavedRoutesForUser");
    expect(source).toContain("ProjectRouteCard");
    expect(source).toContain("removeRouteProjectAction");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
pnpm test -- app/'(site)'/me/projects/page.test.ts
```

Expected: FAIL because the current page is still scaffolded.

- [ ] **Step 3: Implement protected projects page**

Replace `app/(site)/me/projects/page.tsx` with:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { ProjectRouteCard } from "@/components/public/project-route-card";
import { removeRouteProjectAction } from "@/lib/actions/project";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import { listSavedRoutesForUser } from "@/lib/db/project-queries";

export default async function ProjectsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifyUserSessionToken(token) : null;

  if (!session) {
    redirect("/login?returnTo=/me/projects");
  }

  const routes = await listSavedRoutesForUser(session.userId);

  return (
    <main data-hide-site-footer className="min-h-screen bg-white pb-[90px]">
      <AppHeader />
      <section className="px-5 pb-4 pt-6">
        <h1 className="text-[28px] font-black leading-9 text-black">프로젝트</h1>
        <p className="mt-1 text-[13px] font-semibold leading-5 text-[#6F7477]">
          다음에 오를 Route를 저장하고 한곳에서 확인하세요.
        </p>
      </section>
      {routes.length > 0 ? (
        <section aria-label="저장한 프로젝트">
          {routes.map((route) => (
            <ProjectRouteCard key={route.favoriteId} route={route} removeAction={removeRouteProjectAction} />
          ))}
        </section>
      ) : (
        <section className="grid min-h-[50vh] place-items-center px-5 text-center">
          <div>
            <h2 className="text-[20px] font-black leading-7 text-black">저장한 프로젝트가 없습니다</h2>
            <p className="mt-2 text-[13px] font-semibold leading-5 text-[#6F7477]">
              Route 상세에서 프로젝트 저장을 누르면 이곳에 표시됩니다.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm test -- app/'(site)'/me/projects/page.test.ts components/public/project-route-card.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/'(site)'/me/projects/page.tsx app/'(site)'/me/projects/page.test.ts
git commit -m "feat: implement projects page"
```

## Task 7: Add Save State to Route Detail UI

**Files:**
- Modify: `app/(site)/t/[topoId]/page.tsx`
- Modify if present: `components/public/route-more-actions.tsx`
- Modify if present: `components/public/route-more-sheet.tsx`
- Test: existing Phase 7 route more tests or a new `app/(site)/t/[topoId]/page.test.tsx`

- [ ] **Step 1: Inspect Phase 7 integration point**

Run:

```bash
rg "RouteMoreActions|BetaRouteActions|routes.map|route=" app/'(site)'/t/[topoId]/page.tsx components/public
```

Expected:
- If `RouteMoreActions` exists, inject `RouteSaveAction` into the More sheet.
- If only `BetaRouteActions` exists, render `RouteSaveAction` alongside the current route action pill and move it into More after Phase 7 lands.

- [ ] **Step 2: Add user session lookup to Topo page**

In `app/(site)/t/[topoId]/page.tsx`, add imports:

```tsx
import { cookies } from "next/headers";
import { RouteSaveAction } from "@/components/public/route-save-action";
import { removeRouteProjectAction, saveRouteProjectAction } from "@/lib/actions/project";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import { isRouteFavoritedByUser } from "@/lib/db/project-queries";
```

Inside the page function, after loading the topo model:

```tsx
const cookieStore = await cookies();
const token = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value;
const session = token ? await verifyUserSessionToken(token) : null;
const savedRouteIds = new Set<string>();

if (session) {
  await Promise.all(
    topo.routes.map(async (route) => {
      if (await isRouteFavoritedByUser(session.userId, route.id)) {
        savedRouteIds.add(route.id);
      }
    })
  );
}
```

When rendering each selected route action, add:

```tsx
<RouteSaveAction
  routeId={route.id}
  saved={savedRouteIds.has(route.id)}
  loggedIn={Boolean(session)}
  returnTo={`/t/${topo.id}?route=${route.id}`}
  saveAction={saveRouteProjectAction}
  removeAction={removeRouteProjectAction}
/>
```

- [ ] **Step 3: Prefer batch query if the page becomes noisy**

If the route loop grows beyond a few routes or test fixtures expose repeated calls as a problem, add this helper to `lib/db/project-queries.ts` and use it instead of per-route `isRouteFavoritedByUser` calls:

```ts
export async function listFavoritedRouteIdsForUser(userId: string, routeIds: string[]): Promise<Set<string>> {
  if (routeIds.length === 0) {
    return new Set();
  }

  const placeholders = routeIds.map(() => "?").join(", ");
  const rows = await queryD1<{ targetId: string }>(
    `SELECT target_id AS targetId
     FROM favorites
     WHERE user_id = ?
       AND target_type = ?
       AND target_id IN (${placeholders})`,
    [userId, "route", ...routeIds]
  );

  return new Set(rows.map((row) => row.targetId));
}
```

Also add a focused test in `lib/db/project-queries.test.ts` that asserts the `IN` query receives `[userId, "route", ...routeIds]`.

- [ ] **Step 4: Run route UI tests**

Run:

```bash
pnpm test -- components/public/route-save-action.test.tsx app/'(site)'/t/[topoId]/page.test.tsx
```

Expected: PASS. If `page.test.tsx` does not exist yet, create a source-level test that verifies `RouteSaveAction`, `saveRouteProjectAction`, and `isRouteFavoritedByUser` or `listFavoritedRouteIdsForUser` are imported by the Topo page.

- [ ] **Step 5: Commit**

```bash
git add app/'(site)'/t/[topoId]/page.tsx components/public/route-more-actions.tsx components/public/route-more-sheet.tsx lib/db/project-queries.ts lib/db/project-queries.test.ts
git commit -m "feat: add route project save UI"
```

## Task 8: Final Verification

**Files:**
- All Phase 8 files

- [ ] **Step 1: Run targeted tests**

Run:

```bash
pnpm test -- lib/db/project-queries.test.ts lib/actions/project.test.ts components/public/route-save-action.test.tsx components/public/project-route-card.test.tsx app/'(site)'/me/projects/page.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Run production build**

Run:

```bash
pnpm build
```

Expected: PASS.

- [ ] **Step 5: Manual QA**

Run:

```bash
pnpm dev
```

Expected manual checks:

- Anonymous `/me/projects` redirects to `/login?returnTo=/me/projects`.
- Logged-in `/me/projects` shows the empty state when no Routes are saved.
- Route detail save button says `프로젝트 저장` for a logged-in user.
- Saving a Route changes the action to `저장됨`.
- `/me/projects` shows the saved Route with crag/sector/boulder context.
- Removing a Route from `/me/projects` removes it from the list.
- Re-saving the same Route does not create duplicates.
- Anonymous Route save click redirects to login with the current Route URL in `returnTo`.

- [ ] **Step 6: Final commit**

```bash
git status --short
git add migrations/0010_user_favorites.sql lib/db/schema.ts lib/db/project-queries.ts lib/db/project-queries.test.ts lib/actions/project.ts lib/actions/project.test.ts components/public/route-save-action.tsx components/public/route-save-action.test.tsx components/public/project-route-card.tsx components/public/project-route-card.test.tsx app/'(site)'/me/projects/page.tsx app/'(site)'/me/projects/page.test.ts app/'(site)'/t/[topoId]/page.tsx
git commit -m "feat: implement phase 8 projects"
```

---

## Release Gates

- [ ] `favorites` migration exists and is roll-forward only.
- [ ] `favorites` has a unique constraint on `user_id + target_type + target_id`.
- [ ] Route favorite writes go through Server Actions.
- [ ] Server Actions verify the user session from `granite_session`.
- [ ] Server Actions validate that the Route and all ancestors are published before saving.
- [ ] `/me/projects` is no longer scaffold text.
- [ ] `/me/projects` is protected and redirects anonymous users to login.
- [ ] Saved Route list includes route name, grade, crag, sector, and boulder context.
- [ ] Saved Route list has a clear empty state.
- [ ] Route detail save/remove UX works for logged-in users.
- [ ] Anonymous save attempts redirect to login with `returnTo`.
- [ ] Public content cache is not used for user-specific project data.
- [ ] `pnpm test`, `pnpm typecheck`, and `pnpm build` pass.

## Follow-Up Decisions

- Decide whether Project privacy should become a real persisted user preference in Phase 8 follow-up or stay disabled until public profiles exist.
- Decide whether future favorites should support Boulder/Crag targets or whether Route-only projects are the long-term product language.
- Decide whether saved Routes should support user notes, priority, season, or custom folders. These are intentionally excluded from this plan.
