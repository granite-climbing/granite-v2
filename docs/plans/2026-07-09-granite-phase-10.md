# Granite Phase 10 Add Record UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a logged-in user add a completion record (route search + send date, optional star rating and Instagram/YouTube video link) from the records tab and from the route More sheet, with records showing immediately on `/me/records` and attached videos flowing through the existing pending-Beta moderation pipeline.

**Architecture:** New `user_records` table decouples records from public Beta videos. `addRecordAction` server action creates the record (and optionally a pending Beta owned by the user). `lib/records/user-records-view.ts` swaps its Phase 9 mock for real `user_records` + own-Beta queries. A full-screen client dialog (`AddRecordDialog`) per Figma 56-1439/56-1457 is opened from two entry points: the records-tab `기록 추가` button and the More-sheet check button (route prefilled).

**Tech Stack:** Next.js App Router, React Server Components + client leaf components, TypeScript strict, Cloudflare D1 HTTP API (`lib/db/d1-http.ts`), Zod, Tailwind CSS, Vitest + React Testing Library.

**Spec:** `docs/specs/2026-07-09-granite-phase-10-add-record-design.md` (approved 2026-07-09)

---

## Product References

- Roadmap scope: `docs/ROADMAP.md` → "Phase 10 — Add Record UI"
- Figma search-before: [node 56-1439](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=56-1439&t=Nj8NzKW38WUPfN3F-4)
- Figma search-after: [node 56-1457](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=56-1457&t=Nj8NzKW38WUPfN3F-4)
- Existing beta pipeline: `lib/actions/beta.ts`, `lib/db/beta-queries.ts`
- Records read model: `lib/db/record-queries.ts`, `lib/records/user-records-view.ts`
- Entry points: `components/public/record-send-chart.tsx`, `components/public/route-more-sheet.tsx`

## Confirmed Policy Decisions (from spec)

1. Records without a video link are allowed (route + date required only).
2. Own records show immediately on `/me/records`; attached videos are created as `pending` Betas and appear publicly only after admin approval. Own videos show in the "나의 영상" grid immediately (pending included).
3. New `user_records` table; no `betas` schema change.
4. Repeat sends of the same route are allowed.
5. **Caption format constraint (deviation from Figma):** the Instagram webhook (`workers/instagram-webhook/src/match.ts`) matches routes only when the caption contains BOTH `#<boulderName>` and `#<routeName>` hashtags. The Figma caption shows only one hashtag; we adopt the Figma sentence format but keep the full hashtag set (`#볼더명 #루트명 + boulder hashtags`).

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `migrations/0012_user_records.sql` | Create | `user_records` table |
| `lib/beta/caption.ts` (+test) | Modify | New Figma-based caption sentence, hashtags preserved |
| `lib/db/schema.ts` | Modify | `UserRecordWithRoute`, `RouteSearchRowForRecord` types |
| `lib/db/record-queries.ts` (+test) | Modify | `insertUserRecord`, `getUserRecordsByUserId`, `searchPublishedRoutesForRecord`, `buildFixedGradeBuckets`, `getOwnBetaVideosByUserId` |
| `lib/db/beta-queries.ts` (+test) | Modify | `createManualBeta` accepts optional `userId`/`claimStatus` |
| `lib/actions/record-schema.ts` | Create | Zod parsing for add-record form + media URL normalization |
| `lib/actions/record.ts` (+test) | Create | `searchRoutesForRecordAction`, `addRecordAction` |
| `lib/records/user-records-view.ts` (+test) | Modify | Real data instead of mock; view item types |
| `lib/mock/records.ts` | Delete | Phase 9 mock no longer used |
| `components/public/add-record-dialog.tsx` (+test) | Create | Full-screen add-record dialog (client) |
| `components/public/add-record-launcher.tsx` (+test) | Create | `기록 추가` trigger button + dialog (client) |
| `components/public/record-send-chart.tsx` (+test) | Modify | Use launcher; type import swap |
| `components/public/record-list.tsx`, `record-video-grid.tsx` | Modify | Type import swap |
| `components/public/route-more-sheet.tsx` (+test) | Modify | Check button opens prefilled dialog / login redirect |
| `app/(site)/t/[topoId]/page.tsx` | Modify | Pass `recordRoute` + `isLoggedIn` to More sheet |
| `docs/ROADMAP.md`, `docs/DATA_MODEL.md` | Modify | Phase 10 status, `user_records` docs |

Run all commands from the repo root. Test runner: `pnpm test -- <path>` (vitest), or `pnpm vitest run <path>`.

---

### Task 1: `user_records` migration

**Files:**
- Create: `migrations/0012_user_records.sql`

- [x] **Step 1: Write the migration**

```sql
-- Granite Phase 10 user records (완등 기록)
-- Roll-forward only.

CREATE TABLE IF NOT EXISTS user_records (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  route_id   TEXT NOT NULL REFERENCES routes(id),
  beta_id    TEXT REFERENCES betas(id),
  sent_at    TEXT NOT NULL,
  rating     INTEGER CHECK (rating BETWEEN 1 AND 5),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_records_user_id ON user_records (user_id);
CREATE INDEX IF NOT EXISTS idx_user_records_route_id ON user_records (route_id);
```

- [x] **Step 2: Apply locally and verify**

Run: `pnpm wrangler d1 migrations apply granite --local`
Expected: `0012_user_records.sql` listed as applied without error.

- [x] **Step 3: Commit**

```bash
git add migrations/0012_user_records.sql
git commit -m "feat: add user_records table for phase 10 add-record"
```

---

### Task 2: Caption format update

**Files:**
- Modify: `lib/beta/caption.ts`
- Test: `lib/beta/caption.test.ts`

- [x] **Step 1: Update the test to the Figma sentence format (keep hashtag assertions)**

Replace the existing expected caption in `lib/beta/caption.test.ts` with tests equivalent to:

```ts
import { describe, expect, it } from "vitest";
import { buildInstagramCaption } from "./caption";

describe("buildInstagramCaption", () => {
  it("builds the Figma-format caption with mention and hashtags", () => {
    const caption = buildInstagramCaption({
      cragName: "안양예술공원",
      sectorName: "허니1",
      boulderName: "허니 볼더",
      routeName: "Honey No.6",
      grade: "V6",
      boulderHashtags: ["안양_허니넘버6"],
    });

    expect(caption).toBe(
      '"Honey No.6" V6 on 허니1, 허니 볼더, 안양예술공원. @granite.kr #허니볼더 #HoneyNo.6 #안양_허니넘버6'
    );
  });

  it("dedupes hashtags", () => {
    const caption = buildInstagramCaption({
      cragName: "크랙",
      sectorName: "섹터",
      boulderName: "볼더",
      routeName: "볼더",
      grade: "V1",
      boulderHashtags: ["볼더"],
    });

    expect(caption.match(/#볼더/g)).toHaveLength(1);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run lib/beta/caption.test.ts`
Expected: FAIL — current implementation returns the old "방금 보냈어요!" multi-line format.

- [x] **Step 3: Update the implementation**

In `lib/beta/caption.ts`, replace the return statement of `buildInstagramCaption` (keep `hashtag()` and `CaptionRouteContext` unchanged):

```ts
export function buildInstagramCaption(input: CaptionRouteContext): string {
  const tags = [
    hashtag(input.boulderName),
    hashtag(input.routeName),
    ...input.boulderHashtags.map(hashtag),
  ];

  return `"${input.routeName}" ${input.grade} on ${input.sectorName}, ${input.boulderName}, ${input.cragName}. @granite.kr ${Array.from(new Set(tags)).join(" ")}`;
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run lib/beta/caption.test.ts`
Expected: PASS. Also run `pnpm vitest run components/public/route-more-sheet.test.tsx app/` related suites if they assert on caption text; fix any snapshot/text assertions that referenced the old format.

- [x] **Step 5: Commit**

```bash
git add lib/beta/caption.ts lib/beta/caption.test.ts
git commit -m "feat: switch instagram caption to figma phase-10 format"
```

---

### Task 3: `createManualBeta` accepts owner + claim status

**Files:**
- Modify: `lib/db/beta-queries.ts:4-74`
- Test: `lib/db/beta-queries.test.ts`

- [x] **Step 1: Write failing tests**

Add to `lib/db/beta-queries.test.ts` (follow the existing `queryD1Mock` hoisted-mock pattern in that file):

```ts
it("inserts a manual beta owned by a user with claimed status", async () => {
  queryD1Mock.mockResolvedValueOnce([]);

  await createManualBeta({
    id: "beta_1",
    routeId: "route_1",
    userId: "user_1",
    claimStatus: "claimed",
    instagramId: "granite_user",
    displayName: "그래나이트",
    platform: "youtube",
    mediaUrl: "https://youtu.be/abc",
    permalinkUrl: "https://youtu.be/abc",
    externalMediaId: "abc",
    sentAt: "2026-07-09",
  });

  const [sql, params] = queryD1Mock.mock.calls[0];
  expect(sql).toContain("INSERT INTO betas");
  expect(params).toContain("user_1");
  expect(params).toContain("claimed");
});

it("defaults to unowned unclaimed manual beta", async () => {
  queryD1Mock.mockResolvedValueOnce([]);

  await createManualBeta({
    id: "beta_2",
    routeId: "route_1",
    instagramId: "",
    displayName: "",
    platform: "instagram",
    mediaUrl: "https://www.instagram.com/p/xyz/",
    permalinkUrl: "https://www.instagram.com/p/xyz/",
    externalMediaId: null,
    sentAt: "2026-07-09",
  });

  const [, params] = queryD1Mock.mock.calls[0];
  expect(params).toContain(null); // user_id
  expect(params).toContain("unclaimed");
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run lib/db/beta-queries.test.ts`
Expected: FAIL — `userId`/`claimStatus` are not accepted and SQL hardcodes `NULL`/`'unclaimed'`.

- [x] **Step 3: Implement**

In `lib/db/beta-queries.ts`, extend the input type and parameterize the SQL:

```ts
export type CreateManualBetaInput = {
  id: string;
  routeId: string;
  userId?: string | null;
  claimStatus?: "unclaimed" | "claimed";
  instagramId: string;
  displayName: string;
  platform: BetaPlatform;
  mediaUrl: string;
  permalinkUrl: string | null;
  externalMediaId: string | null;
  sentAt: string;
};

export async function createManualBeta(input: CreateManualBetaInput): Promise<void> {
  await queryD1(
    `INSERT INTO betas (
       id, route_id, user_id, instagram_id, display_name, source, platform,
       media_url, permalink_url, external_media_id, thumbnail_url, sent_at, status, claim_status
     ) VALUES (?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?, NULL, ?, 'pending', ?)`,
    [
      input.id,
      input.routeId,
      input.userId ?? null,
      input.instagramId,
      input.displayName,
      input.platform,
      input.mediaUrl,
      input.permalinkUrl,
      input.externalMediaId,
      input.sentAt,
      input.claimStatus ?? "unclaimed",
    ]
  );
}
```

Note: `AdminBetaRow` extends `CreateManualBetaInput` and already declares `userId: string | null` and `claimStatus`; verify `pnpm typecheck` stays green (the optional fields are compatible — if TS complains about the `AdminBetaRow` intersection, change `AdminBetaRow` to extend `Omit<CreateManualBetaInput, "userId" | "claimStatus">` since it already re-declares both).

- [x] **Step 4: Run tests + typecheck**

Run: `pnpm vitest run lib/db/beta-queries.test.ts && pnpm typecheck`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add lib/db/beta-queries.ts lib/db/beta-queries.test.ts
git commit -m "feat: allow user-owned claimed manual beta creation"
```

---

### Task 4: Record queries (insert, list, search, buckets, own videos)

**Files:**
- Modify: `lib/db/schema.ts` (append types)
- Modify: `lib/db/record-queries.ts`
- Test: `lib/db/record-queries.test.ts`

- [x] **Step 1: Add types to `lib/db/schema.ts`**

Append near the existing `UserRecordListItem` types:

```ts
export type UserRecordWithRoute = {
  recordId: string;
  routeId: string;
  topoId: string;
  routeName: string;
  routeGrade: string;
  routeGradeNum: number;
  boulderName: string;
  sectorName: string;
  cragName: string;
  sentAt: string;
  rating: number | null;
};

export type RouteSearchRowForRecord = {
  routeId: string;
  routeName: string;
  routeGrade: string;
  boulderName: string;
  sectorName: string;
  cragName: string;
  boulderHashtags: string; // JSON string; parse with parseHashtags
};
```

- [x] **Step 2: Write failing tests**

Add to `lib/db/record-queries.test.ts` (uses the existing hoisted `queryD1Mock`):

```ts
it("inserts a user record", async () => {
  queryD1Mock.mockResolvedValueOnce([]);

  await insertUserRecord({
    id: "rec_1",
    userId: "user_1",
    routeId: "route_1",
    betaId: null,
    sentAt: "2026-07-09",
    rating: 4
  });

  const [sql, params] = queryD1Mock.mock.calls[0];
  expect(sql).toContain("INSERT INTO user_records");
  expect(params).toEqual(["rec_1", "user_1", "route_1", null, "2026-07-09", 4]);
});

it("loads user records with published route context", async () => {
  queryD1Mock.mockResolvedValueOnce([
    {
      recordId: "rec_1",
      routeId: "route_1",
      topoId: "topo_1",
      routeName: "Honey No.6",
      routeGrade: "V6",
      routeGradeNum: 6,
      boulderName: "허니 볼더",
      sectorName: "허니1",
      cragName: "안양예술공원",
      sentAt: "2026-07-09",
      rating: 4
    }
  ]);

  const records = await getUserRecordsByUserId("user_1");

  const [sql, params] = queryD1Mock.mock.calls[0];
  expect(sql).toContain("FROM user_records ur");
  expect(sql).toContain("ur.user_id = ?");
  expect(sql).toContain("ur.deleted_at IS NULL");
  expect(sql).toContain("r.is_published = 1");
  expect(params).toEqual(["user_1"]);
  expect(records[0]).toMatchObject({ recordId: "rec_1", routeGrade: "V6" });
});

it("searches published routes by escaped LIKE term", async () => {
  queryD1Mock.mockResolvedValueOnce([]);

  await searchPublishedRoutesForRecord("honey_50%");

  const [sql, params] = queryD1Mock.mock.calls[0];
  expect(sql).toContain("r.name LIKE ? ESCAPE");
  expect(params[0]).toBe("%honey\\_50\\%%");
});

it("returns no results for a blank search term without querying", async () => {
  const results = await searchPublishedRoutesForRecord("   ");
  expect(results).toEqual([]);
  expect(queryD1Mock).not.toHaveBeenCalled();
});

it("builds fixed V0-V12+ chart buckets", () => {
  const buckets = buildFixedGradeBuckets([
    { routeGradeNum: 0 },
    { routeGradeNum: 5 },
    { routeGradeNum: 5 },
    { routeGradeNum: 13 }
  ]);

  expect(buckets).toHaveLength(13);
  expect(buckets[0]).toEqual({ grade: "V0", count: 1 });
  expect(buckets[5]).toEqual({ grade: "V5", count: 2 });
  expect(buckets[12]).toEqual({ grade: "V12+", count: 1 });
});

it("loads own beta videos including pending", async () => {
  queryD1Mock.mockResolvedValueOnce([
    { id: "beta_1", thumbnailUrl: null, title: "Honey No.6" }
  ]);

  const videos = await getOwnBetaVideosByUserId("user_1");

  const [sql, params] = queryD1Mock.mock.calls[0];
  expect(sql).toContain("be.user_id = ?");
  expect(sql).toContain("be.status IN ('pending', 'approved')");
  expect(params).toEqual(["user_1"]);
  expect(videos[0].title).toBe("Honey No.6");
});
```

Import the new functions in the test file header:

```ts
import {
  buildFixedGradeBuckets,
  buildUserRecordsModel,
  getApprovedClaimCandidateRecordsByInstagramId,
  getApprovedRecordsByUserId,
  getOwnBetaVideosByUserId,
  getRecordGradeBuckets,
  getUserRecordsByUserId,
  insertUserRecord,
  searchPublishedRoutesForRecord
} from "./record-queries";
```

- [x] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run lib/db/record-queries.test.ts`
Expected: FAIL — functions do not exist.

- [x] **Step 4: Implement in `lib/db/record-queries.ts`**

Add imports: `import type { RouteSearchRowForRecord, UserRecordWithRoute, ... } from "./schema";`

```ts
export type InsertUserRecordInput = {
  id: string;
  userId: string;
  routeId: string;
  betaId: string | null;
  sentAt: string;
  rating: number | null;
};

export async function insertUserRecord(input: InsertUserRecordInput): Promise<void> {
  await queryD1(
    `INSERT INTO user_records (id, user_id, route_id, beta_id, sent_at, rating)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.id, input.userId, input.routeId, input.betaId, input.sentAt, input.rating]
  );
}

const USER_RECORD_ROUTE_JOIN = `
  JOIN routes r ON r.id = ur.route_id
  JOIN topos t ON t.id = r.topo_id
  JOIN boulders b ON b.id = t.boulder_id
  JOIN sectors s ON s.id = b.sector_id
  JOIN crags c ON c.id = s.crag_id
  JOIN areas a ON a.id = c.area_id
`;

export async function getUserRecordsByUserId(userId: string): Promise<UserRecordWithRoute[]> {
  return queryD1<UserRecordWithRoute>(
    `SELECT
       ur.id AS recordId,
       r.id AS routeId,
       r.topo_id AS topoId,
       r.name AS routeName,
       r.grade AS routeGrade,
       r.grade_num AS routeGradeNum,
       b.name AS boulderName,
       s.name AS sectorName,
       c.name AS cragName,
       ur.sent_at AS sentAt,
       ur.rating AS rating
     FROM user_records ur
     ${USER_RECORD_ROUTE_JOIN}
     WHERE ur.user_id = ?
       AND ur.deleted_at IS NULL
       ${PUBLISHED_ROUTE_FILTER}
     ORDER BY ur.sent_at DESC, ur.created_at DESC`,
    [userId]
  );
}

function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

const ROUTE_SEARCH_LIMIT = 20;

export async function searchPublishedRoutesForRecord(term: string): Promise<RouteSearchRowForRecord[]> {
  const trimmed = term.trim();
  if (!trimmed) {
    return [];
  }

  return queryD1<RouteSearchRowForRecord>(
    `SELECT
       r.id AS routeId,
       r.name AS routeName,
       r.grade AS routeGrade,
       b.name AS boulderName,
       s.name AS sectorName,
       c.name AS cragName,
       b.hashtags AS boulderHashtags
     FROM routes r
     JOIN topos t ON t.id = r.topo_id
     JOIN boulders b ON b.id = t.boulder_id
     JOIN sectors s ON s.id = b.sector_id
     JOIN crags c ON c.id = s.crag_id
     JOIN areas a ON a.id = c.area_id
     WHERE r.name LIKE ? ESCAPE '\\'
       ${PUBLISHED_ROUTE_FILTER}
     ORDER BY r.name COLLATE NOCASE ASC
     LIMIT ${ROUTE_SEARCH_LIMIT}`,
    [`%${escapeLikeTerm(trimmed)}%`]
  );
}

const CHART_GRADE_MAX = 12;

export function buildFixedGradeBuckets(
  records: Array<{ routeGradeNum: number }>
): UserRecordGradeBucket[] {
  const counts = new Array<number>(CHART_GRADE_MAX + 1).fill(0);
  for (const record of records) {
    const index = Math.min(Math.max(record.routeGradeNum, 0), CHART_GRADE_MAX);
    counts[index] += 1;
  }

  return counts.map((count, index) => ({
    grade: index === CHART_GRADE_MAX ? "V12+" : `V${index}`,
    gradeNum: index,
    count
  }));
}

export async function getOwnBetaVideosByUserId(
  userId: string
): Promise<Array<{ id: string; thumbnailUrl: string | null; title: string }>> {
  return queryD1(
    `SELECT
       be.id AS id,
       be.thumbnail_url AS thumbnailUrl,
       r.name AS title
     FROM betas be
     JOIN routes r ON r.id = be.route_id
     WHERE be.user_id = ?
       AND be.status IN ('pending', 'approved')
       AND be.deleted_at IS NULL
     ORDER BY be.sent_at DESC, be.created_at DESC`,
    [userId]
  );
}
```

Note: `PUBLISHED_ROUTE_FILTER` already exists in this file and starts with `AND`, so it composes after the `WHERE` clauses above. Check `UserRecordGradeBucket` in `lib/db/schema.ts` — if it requires `gradeNum`, include it as shown; if the buckets test asserts exact object equality, match the type's actual shape (adjust the test's expected objects to include `gradeNum` if present).

- [x] **Step 5: Run tests + typecheck**

Run: `pnpm vitest run lib/db/record-queries.test.ts && pnpm typecheck`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add lib/db/schema.ts lib/db/record-queries.ts lib/db/record-queries.test.ts
git commit -m "feat: add user_records queries, route search, fixed grade buckets"
```

---

### Task 5: Add-record server actions

**Files:**
- Create: `lib/actions/record-schema.ts`
- Create: `lib/actions/record.ts`
- Test: `lib/actions/record.test.ts`

- [x] **Step 1: Write `lib/actions/record-schema.ts`**

```ts
import { z } from "zod";
import {
  detectMediaPlatform,
  extractCanonicalMediaId,
  normalizeYouTubeOrInstagramUrl,
} from "@/lib/beta/normalize";

const addRecordSchema = z.object({
  routeId: z.string().min(1),
  sentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rating: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : null))
    .pipe(z.union([z.null(), z.number().int().min(1).max(5)])),
  mediaUrl: z
    .string()
    .optional()
    .transform((value) => (value && value.trim().length > 0 ? value.trim() : null))
    .pipe(z.union([z.null(), z.string().url()])),
});

export type AddRecordInput = z.output<typeof addRecordSchema>;

export function parseAddRecordForm(raw: Record<string, FormDataEntryValue>): AddRecordInput {
  return addRecordSchema.parse(raw);
}

export function parseRecordMediaUrl(rawUrl: string) {
  const mediaUrl = normalizeYouTubeOrInstagramUrl(rawUrl);
  const platform = detectMediaPlatform(mediaUrl);
  return {
    mediaUrl,
    permalinkUrl: mediaUrl,
    externalMediaId: extractCanonicalMediaId(mediaUrl, platform),
    platform,
  };
}
```

(Before writing, check how `detectMediaPlatform` signals an unsupported URL in `lib/beta/normalize.ts` — if it throws, the action's try/catch below covers it; if it returns a sentinel, convert that to a thrown `Error` inside `parseRecordMediaUrl`.)

- [x] **Step 2: Write failing action tests**

Create `lib/actions/record.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const cookiesMock = vi.hoisted(() => vi.fn());
const verifySessionMock = vi.hoisted(() => vi.fn());
const findActiveUserMock = vi.hoisted(() => vi.fn());
const findPublishedRouteMock = vi.hoisted(() => vi.fn());
const findByExternalMediaMock = vi.hoisted(() => vi.fn());
const findByPermalinkMock = vi.hoisted(() => vi.fn());
const createManualBetaMock = vi.hoisted(() => vi.fn());
const updateThumbnailMock = vi.hoisted(() => vi.fn());
const acquireThumbnailMock = vi.hoisted(() => vi.fn());
const insertUserRecordMock = vi.hoisted(() => vi.fn());
const searchRoutesMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("@/lib/auth/session", () => ({
  USER_SESSION_COOKIE_NAME: "granite_session",
  verifyUserSessionToken: verifySessionMock
}));
vi.mock("@/lib/db/user-auth-queries", () => ({ findActiveUserById: findActiveUserMock }));
vi.mock("@/lib/db/beta-queries", () => ({
  createManualBeta: createManualBetaMock,
  findExistingBetaByExternalMedia: findByExternalMediaMock,
  findExistingBetaByPermalink: findByPermalinkMock,
  findPublishedRouteIdForBeta: findPublishedRouteMock,
  updateBetaThumbnailUrl: updateThumbnailMock
}));
vi.mock("@/lib/beta/thumbnail-r2", () => ({ acquireAndStoreBetaThumbnail: acquireThumbnailMock }));
vi.mock("@/lib/db/record-queries", () => ({
  insertUserRecord: insertUserRecordMock,
  searchPublishedRoutesForRecord: searchRoutesMock
}));

import { addRecordAction, searchRoutesForRecordAction } from "./record";

function loggedInUser() {
  cookiesMock.mockResolvedValue({ get: () => ({ value: "token" }) });
  verifySessionMock.mockResolvedValue({ userId: "user_1" });
  findActiveUserMock.mockResolvedValue({
    id: "user_1",
    displayName: "그래나이트",
    instagramId: "granite_user"
  });
}

function formDataOf(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("addRecordAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    acquireThumbnailMock.mockResolvedValue(null);
  });

  it("rejects when not logged in", async () => {
    cookiesMock.mockResolvedValue({ get: () => undefined });

    const result = await addRecordAction(formDataOf({ routeId: "route_1", sentAt: "2026-07-09" }));

    expect(result.ok).toBe(false);
    expect(insertUserRecordMock).not.toHaveBeenCalled();
  });

  it("rejects an unpublished route", async () => {
    loggedInUser();
    findPublishedRouteMock.mockResolvedValue(null);

    const result = await addRecordAction(formDataOf({ routeId: "route_x", sentAt: "2026-07-09" }));

    expect(result).toEqual({ ok: false, message: "유효하지 않은 루트입니다." });
  });

  it("creates a record without media", async () => {
    loggedInUser();
    findPublishedRouteMock.mockResolvedValue({ id: "route_1" });

    const result = await addRecordAction(
      formDataOf({ routeId: "route_1", sentAt: "2026-07-09", rating: "4" })
    );

    expect(result.ok).toBe(true);
    expect(createManualBetaMock).not.toHaveBeenCalled();
    expect(insertUserRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_1", routeId: "route_1", betaId: null, rating: 4 })
    );
  });

  it("rejects duplicate media URLs", async () => {
    loggedInUser();
    findPublishedRouteMock.mockResolvedValue({ id: "route_1" });
    findByExternalMediaMock.mockResolvedValue({ id: "beta_existing", status: "approved" });

    const result = await addRecordAction(
      formDataOf({
        routeId: "route_1",
        sentAt: "2026-07-09",
        mediaUrl: "https://youtu.be/abc123"
      })
    );

    expect(result).toEqual({ ok: false, message: "이미 등록된 영상입니다." });
    expect(insertUserRecordMock).not.toHaveBeenCalled();
  });

  it("creates a pending user-owned beta and links it to the record", async () => {
    loggedInUser();
    findPublishedRouteMock.mockResolvedValue({ id: "route_1" });
    findByExternalMediaMock.mockResolvedValue(null);
    findByPermalinkMock.mockResolvedValue(null);

    const result = await addRecordAction(
      formDataOf({
        routeId: "route_1",
        sentAt: "2026-07-09",
        rating: "5",
        mediaUrl: "https://youtu.be/abc123"
      })
    );

    expect(result.ok).toBe(true);
    expect(createManualBetaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        claimStatus: "claimed",
        platform: "youtube",
        displayName: "그래나이트"
      })
    );
    const betaId = createManualBetaMock.mock.calls[0][0].id;
    expect(insertUserRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({ betaId, rating: 5 })
    );
  });
});

describe("searchRoutesForRecordAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps rows and parses hashtags", async () => {
    searchRoutesMock.mockResolvedValue([
      {
        routeId: "route_1",
        routeName: "Honey No.6",
        routeGrade: "V6",
        boulderName: "허니 볼더",
        sectorName: "허니1",
        cragName: "안양예술공원",
        boulderHashtags: '["안양_허니넘버6"]'
      }
    ]);

    const results = await searchRoutesForRecordAction("honey");

    expect(results).toEqual([
      expect.objectContaining({
        routeId: "route_1",
        boulderHashtags: ["안양_허니넘버6"]
      })
    ]);
  });
});
```

(If `lib/db/queries.ts`'s `parseHashtags` pulls heavy imports into the test graph, mock `@/lib/db/queries` with a passthrough `parseHashtags: (json: string) => JSON.parse(json)` — check the real function's defensive behavior first and mirror it.)

- [x] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run lib/actions/record.test.ts`
Expected: FAIL — `./record` does not exist.

- [x] **Step 4: Write `lib/actions/record.ts`**

```ts
"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import { findActiveUserById } from "@/lib/db/user-auth-queries";
import {
  createManualBeta,
  findExistingBetaByExternalMedia,
  findExistingBetaByPermalink,
  findPublishedRouteIdForBeta,
  updateBetaThumbnailUrl,
} from "@/lib/db/beta-queries";
import { insertUserRecord, searchPublishedRoutesForRecord } from "@/lib/db/record-queries";
import { acquireAndStoreBetaThumbnail } from "@/lib/beta/thumbnail-r2";
import { normalizeHandle } from "@/lib/beta/normalize";
import { parseHashtags } from "@/lib/db/queries";
import { parseAddRecordForm, parseRecordMediaUrl, type AddRecordInput } from "./record-schema";

export type AddRecordActionResult = {
  ok: boolean;
  message: string;
};

export type RouteSearchItemForRecord = {
  routeId: string;
  routeName: string;
  routeGrade: string;
  boulderName: string;
  sectorName: string;
  cragName: string;
  boulderHashtags: string[];
};

export async function searchRoutesForRecordAction(term: string): Promise<RouteSearchItemForRecord[]> {
  const rows = await searchPublishedRoutesForRecord(term);
  return rows.map((row) => ({
    routeId: row.routeId,
    routeName: row.routeName,
    routeGrade: row.routeGrade,
    boulderName: row.boulderName,
    sectorName: row.sectorName,
    cragName: row.cragName,
    boulderHashtags: parseHashtags(row.boulderHashtags),
  }));
}

export async function addRecordAction(formData: FormData): Promise<AddRecordActionResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifyUserSessionToken(token) : null;
  const user = session ? await findActiveUserById(session.userId) : null;
  if (!user) {
    return { ok: false, message: "로그인이 필요합니다." };
  }

  let parsed: AddRecordInput;
  try {
    parsed = parseAddRecordForm(Object.fromEntries(formData));
  } catch {
    return { ok: false, message: "입력값을 확인해주세요." };
  }

  const publishedRoute = await findPublishedRouteIdForBeta(parsed.routeId);
  if (!publishedRoute) {
    return { ok: false, message: "유효하지 않은 루트입니다." };
  }

  let betaId: string | null = null;
  if (parsed.mediaUrl) {
    let media: ReturnType<typeof parseRecordMediaUrl>;
    try {
      media = parseRecordMediaUrl(parsed.mediaUrl);
    } catch {
      return { ok: false, message: "Instagram 또는 YouTube 링크만 등록할 수 있습니다." };
    }

    let existing = media.externalMediaId
      ? await findExistingBetaByExternalMedia(media.platform, media.externalMediaId)
      : null;
    if (!existing) {
      existing = await findExistingBetaByPermalink(media.platform, media.permalinkUrl);
    }
    if (existing) {
      return { ok: false, message: "이미 등록된 영상입니다." };
    }

    betaId = `beta_${randomUUID()}`;
    await createManualBeta({
      id: betaId,
      routeId: parsed.routeId,
      userId: user.id,
      claimStatus: "claimed",
      instagramId: user.instagramId ? normalizeHandle(user.instagramId) : "",
      displayName: user.displayName,
      platform: media.platform,
      mediaUrl: media.mediaUrl,
      permalinkUrl: media.permalinkUrl,
      externalMediaId: media.externalMediaId,
      sentAt: parsed.sentAt,
    });

    try {
      const cdnUrl = await acquireAndStoreBetaThumbnail({
        betaId,
        platform: media.platform,
        postUrl: media.permalinkUrl,
      });
      if (cdnUrl) {
        await updateBetaThumbnailUrl(betaId, cdnUrl);
      }
    } catch (err) {
      console.warn("thumbnail acquisition failed:", err);
    }
  }

  await insertUserRecord({
    id: `rec_${randomUUID()}`,
    userId: user.id,
    routeId: parsed.routeId,
    betaId,
    sentAt: parsed.sentAt,
    rating: parsed.rating,
  });

  return { ok: true, message: "기록이 추가되었습니다." };
}
```

Check the actual shape of `findActiveUserById`'s return (`User` in `lib/db/schema.ts`) — field names `displayName` / `instagramId` are used above; verify they match.

- [x] **Step 5: Run tests + typecheck**

Run: `pnpm vitest run lib/actions/record.test.ts && pnpm typecheck`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add lib/actions/record-schema.ts lib/actions/record.ts lib/actions/record.test.ts
git commit -m "feat: add-record server actions with optional pending beta"
```

---

### Task 6: Swap records view to real data

**Files:**
- Modify: `lib/records/user-records-view.ts`
- Modify: `components/public/record-send-chart.tsx:1,16` (type import)
- Modify: `components/public/record-list.tsx:1,3` (type import)
- Modify: `components/public/record-video-grid.tsx:1,3` (type import)
- Delete: `lib/mock/records.ts`
- Test: `lib/records/user-records-view.test.ts`

- [x] **Step 1: Rewrite the view test**

Replace `lib/records/user-records-view.test.ts` content:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/lib/db/schema";

const getUserRecordsMock = vi.hoisted(() => vi.fn());
const getOwnVideosMock = vi.hoisted(() => vi.fn());
const buildBucketsMock = vi.hoisted(() =>
  vi.fn(() => [{ grade: "V0", gradeNum: 0, count: 0 }])
);

vi.mock("@/lib/db/record-queries", () => ({
  getUserRecordsByUserId: getUserRecordsMock,
  getOwnBetaVideosByUserId: getOwnVideosMock,
  buildFixedGradeBuckets: buildBucketsMock
}));

import { getUserRecordsView } from "./user-records-view";

const user = {
  id: "user_1",
  displayName: "그래나이트",
  instagramId: "@granite_user",
  avatarUrl: null,
  apeIndexCm: 180,
  heightCm: 175,
  weightKg: 70
} as unknown as User;

describe("getUserRecordsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds the view from user records and own videos", async () => {
    getUserRecordsMock.mockResolvedValue([
      {
        recordId: "rec_2",
        routeId: "route_2",
        topoId: "topo_2",
        routeName: "Honey No.6",
        routeGrade: "V6",
        routeGradeNum: 6,
        boulderName: "허니 볼더",
        sectorName: "허니1",
        cragName: "안양예술공원",
        sentAt: "2026-07-09",
        rating: 4
      },
      {
        recordId: "rec_1",
        routeId: "route_1",
        topoId: "topo_1",
        routeName: "Even Flow",
        routeGrade: "V3",
        routeGradeNum: 3,
        boulderName: "볼더",
        sectorName: "섹터",
        cragName: "인수봉",
        sentAt: "2026-07-01",
        rating: null
      }
    ]);
    getOwnVideosMock.mockResolvedValue([{ id: "beta_1", thumbnailUrl: null, title: "Honey No.6" }]);

    const view = await getUserRecordsView(user);

    expect(view.totalSends).toBe(2);
    expect(view.highestGrade).toBe("V6");
    expect(view.recentRecords[0]).toEqual({
      id: "rec_2",
      routeName: "Honey No.6",
      grade: "V6",
      location: "안양예술공원"
    });
    expect(view.videos).toEqual([{ id: "beta_1", thumbnailUrl: null, title: "Honey No.6" }]);
    expect(view.profile.instagramId).toBe("granite_user");
  });

  it("returns empty-state values without records", async () => {
    getUserRecordsMock.mockResolvedValue([]);
    getOwnVideosMock.mockResolvedValue([]);

    const view = await getUserRecordsView(user);

    expect(view.totalSends).toBe(0);
    expect(view.highestGrade).toBe("-");
    expect(view.recentRecords).toEqual([]);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run lib/records/user-records-view.test.ts`
Expected: FAIL — view still returns mock data.

- [x] **Step 3: Rewrite `lib/records/user-records-view.ts`**

```ts
import { normalizeHandle } from "@/lib/beta/normalize";
import type { User, UserRecordWithRoute } from "@/lib/db/schema";
import {
  buildFixedGradeBuckets,
  getOwnBetaVideosByUserId,
  getUserRecordsByUserId
} from "@/lib/db/record-queries";

export type UserRecordsProfile = {
  displayName: string;
  instagramId: string | null;
  avatarUrl: string | null;
  armSpanCm: number | null;
  heightCm: number | null;
  weightKg: number | null;
};

export type RecordGradeBucket = {
  grade: string;
  count: number;
};

export type RecentRecordItem = {
  id: string;
  routeName: string;
  grade: string;
  location: string;
};

export type RecordVideoItem = {
  id: string;
  thumbnailUrl: string | null;
  title: string;
};

export type UserRecordsView = {
  profile: UserRecordsProfile;
  totalSends: number;
  highestGrade: string;
  gradeBuckets: RecordGradeBucket[];
  recentRecords: RecentRecordItem[];
  videos: RecordVideoItem[];
};

const RECENT_RECORD_LIMIT = 3;

// 기록탭 화면 데이터의 단일 진입점. 프로필은 사용자 설정값(회원가입 온보딩)에서 오고,
// 기록/영상은 user_records 및 본인 소유 betas 실데이터를 사용한다 (Phase 10).
export async function getUserRecordsView(user: User): Promise<UserRecordsView> {
  const [records, videos] = await Promise.all([
    getUserRecordsByUserId(user.id),
    getOwnBetaVideosByUserId(user.id)
  ]);

  const highest = records.reduce<UserRecordWithRoute | null>((current, record) => {
    if (!current || record.routeGradeNum > current.routeGradeNum) {
      return record;
    }
    return current;
  }, null);

  return {
    profile: {
      displayName: user.displayName,
      instagramId: user.instagramId ? normalizeHandle(user.instagramId) : null,
      avatarUrl: user.avatarUrl,
      // users.ape_index_cm 은 온보딩에서 암스팬 절대값(cm)으로 입력받는다.
      armSpanCm: user.apeIndexCm,
      heightCm: user.heightCm,
      weightKg: user.weightKg
    },
    totalSends: records.length,
    highestGrade: highest?.routeGrade ?? "-",
    gradeBuckets: buildFixedGradeBuckets(records),
    recentRecords: records.slice(0, RECENT_RECORD_LIMIT).map((record) => ({
      id: record.recordId,
      routeName: record.routeName,
      grade: record.routeGrade,
      location: record.cragName
    })),
    videos
  };
}
```

(`buildFixedGradeBuckets` returns `UserRecordGradeBucket` with `gradeNum`; `RecordGradeBucket` above is structurally satisfied by it. If TS complains, map to `{ grade, count }`.)

- [x] **Step 4: Swap component type imports and delete the mock**

- `components/public/record-send-chart.tsx`: replace `import type { MockRecordGradeBucket } from "@/lib/mock/records";` with `import type { RecordGradeBucket } from "@/lib/records/user-records-view";` and change the prop type `{ buckets: MockRecordGradeBucket[] }` → `{ buckets: RecordGradeBucket[] }`.
- `components/public/record-list.tsx`: `MockRecentRecord` → `RecentRecordItem` (import from `@/lib/records/user-records-view`).
- `components/public/record-video-grid.tsx`: `MockRecordVideo` → `RecordVideoItem` (import from `@/lib/records/user-records-view`).
- Delete `lib/mock/records.ts`. Fix any other references: run `grep -rn "lib/mock/records" app components lib` and update remaining imports (component test files may import the mock types — switch them to the new types).

- [x] **Step 5: Run the full test suite + typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS (component tests updated as needed).

- [x] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: drive records tab from user_records and own beta videos"
```

---

### Task 7: AddRecordDialog component

**Files:**
- Create: `components/public/add-record-dialog.tsx`
- Test: `components/public/add-record-dialog.test.tsx`

- [x] **Step 1: Write failing component tests**

Create `components/public/add-record-dialog.test.tsx`:

```tsx
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const searchActionMock = vi.hoisted(() => vi.fn());
const addActionMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/actions/record", () => ({
  searchRoutesForRecordAction: searchActionMock,
  addRecordAction: addActionMock
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() })
}));

import { AddRecordDialog } from "./add-record-dialog";

const honeyRoute = {
  routeId: "route_1",
  routeName: "Honey No.6",
  routeGrade: "V6",
  boulderName: "허니 볼더",
  sectorName: "허니1",
  cragName: "안양예술공원",
  boulderHashtags: ["안양_허니넘버6"]
};

describe("AddRecordDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the search-first state without optional sections", () => {
    render(<AddRecordDialog onClose={() => {}} />);

    expect(screen.getByRole("dialog", { name: "기록 추가" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("문제 이름을 검색해주세요")).toBeInTheDocument();
    expect(screen.queryByText("루트 평가")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Youtube 혹은 Instagram 링크")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "추가하기" })).toBeDisabled();
  });

  it("searches and selects a route, revealing rating/media sections", async () => {
    searchActionMock.mockResolvedValue([honeyRoute]);
    render(<AddRecordDialog onClose={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText("문제 이름을 검색해주세요"), {
      target: { value: "honey" }
    });

    const option = await screen.findByRole("button", { name: /Honey No\.6/ });
    fireEvent.click(option);

    expect(screen.getByText("루트 평가")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Youtube 혹은 Instagram 링크")).toBeInTheDocument();
    expect(screen.getByText(/"Honey No\.6" V6 on 허니1, 허니 볼더, 안양예술공원/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "추가하기" })).toBeEnabled();
  });

  it("starts prefilled from a route entry point", () => {
    render(<AddRecordDialog prefilledRoute={honeyRoute} onClose={() => {}} />);

    expect(screen.getByText("루트 평가")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "추가하기" })).toBeEnabled();
  });

  it("submits and closes on success", async () => {
    addActionMock.mockResolvedValue({ ok: true, message: "기록이 추가되었습니다." });
    const onClose = vi.fn();
    render(<AddRecordDialog prefilledRoute={honeyRoute} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "별점 4점" }));
    fireEvent.click(screen.getByRole("button", { name: "추가하기" }));

    await waitFor(() => expect(addActionMock).toHaveBeenCalled());
    const formData = addActionMock.mock.calls[0][0] as FormData;
    expect(formData.get("routeId")).toBe("route_1");
    expect(formData.get("rating")).toBe("4");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(refreshMock).toHaveBeenCalled();
  });

  it("shows the failure message and stays open", async () => {
    addActionMock.mockResolvedValue({ ok: false, message: "이미 등록된 영상입니다." });
    const onClose = vi.fn();
    render(<AddRecordDialog prefilledRoute={honeyRoute} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "추가하기" }));

    expect(await screen.findByText("이미 등록된 영상입니다.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
```

(Follow the setup style of `components/public/route-more-actions.test.tsx` for RTL config. The debounce uses a 300 ms timer — if `findByRole` times out, use `vi.useFakeTimers()` + `vi.advanceTimersByTime(300)` in the search test, matching whatever timer style existing component tests use.)

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run components/public/add-record-dialog.test.tsx`
Expected: FAIL — component does not exist.

- [x] **Step 3: Implement `components/public/add-record-dialog.tsx`**

```tsx
"use client";

import React, { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buildInstagramCaption } from "@/lib/beta/caption";
import {
  addRecordAction,
  searchRoutesForRecordAction,
  type RouteSearchItemForRecord
} from "@/lib/actions/record";

export type AddRecordDialogProps = {
  prefilledRoute?: RouteSearchItemForRecord | null;
  onClose: () => void;
};

const SEARCH_DEBOUNCE_MS = 300;

function todayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

export function AddRecordDialog({ prefilledRoute = null, onClose }: AddRecordDialogProps) {
  const router = useRouter();
  const [selectedRoute, setSelectedRoute] = useState<RouteSearchItemForRecord | null>(prefilledRoute);
  const [term, setTerm] = useState(prefilledRoute?.routeName ?? "");
  const [results, setResults] = useState<RouteSearchItemForRecord[]>([]);
  const [, startSearch] = useTransition();
  const [sentAt, setSentAt] = useState(todayString());
  const [rating, setRating] = useState(0);

  useEffect(() => {
    const trimmed = term.trim();
    if (!trimmed || (selectedRoute && trimmed === selectedRoute.routeName)) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      startSearch(async () => {
        setResults(await searchRoutesForRecordAction(trimmed));
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, selectedRoute]);

  const caption = useMemo(() => {
    if (!selectedRoute) {
      return "";
    }
    return buildInstagramCaption({
      cragName: selectedRoute.cragName,
      sectorName: selectedRoute.sectorName,
      boulderName: selectedRoute.boulderName,
      routeName: selectedRoute.routeName,
      grade: selectedRoute.routeGrade,
      boulderHashtags: selectedRoute.boulderHashtags
    });
  }, [selectedRoute]);

  const [state, formAction, pending] = useActionState(
    async (_state: { message: string } | null, formData: FormData) => {
      const result = await addRecordAction(formData);
      if (result.ok) {
        router.refresh();
        onClose();
      }
      return { message: result.message };
    },
    null
  );

  function selectRoute(route: RouteSearchItemForRecord) {
    setSelectedRoute(route);
    setTerm(route.routeName);
    setResults([]);
  }

  async function copyCaptionAndOpenInstagram() {
    try {
      await navigator.clipboard.writeText(caption);
    } catch {
      // clipboard denied — still open Instagram so the user can paste manually later
    }
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="기록 추가"
      className="fixed inset-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 overflow-y-auto bg-white"
    >
      <form action={formAction} className="flex min-h-full flex-col pb-8">
        <input type="hidden" name="routeId" value={selectedRoute?.routeId ?? ""} />
        <input type="hidden" name="rating" value={rating > 0 ? String(rating) : ""} />

        <header className="relative flex h-14 shrink-0 items-center justify-center">
          <h1 className="text-[18px] font-medium leading-6 text-[#090909]">기록 추가</h1>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="absolute right-4 grid size-6 place-items-center text-[#121212]"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-6 fill-none stroke-current" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <section className="border-b-4 border-[#F1F1F1] px-4 pb-5 pt-2">
          <label className="block text-[14px] font-medium leading-5 text-[#090909]">
            루트명 <span className="text-[#FF3B30]">*</span>
            <span className="relative mt-2 block">
              <input
                type="text"
                value={term}
                onChange={(event) => {
                  setTerm(event.target.value);
                  setSelectedRoute(null);
                }}
                placeholder="문제 이름을 검색해주세요"
                className="h-12 w-full rounded-[8px] border border-[#E8E8E8] pl-4 pr-11 text-[14px] leading-5 text-[#090909] placeholder:text-[#B8B8B8]"
              />
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="absolute right-4 top-1/2 size-5 -translate-y-1/2 fill-none stroke-[#090909]"
                strokeWidth="1.8"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M16.5 16.5L21 21" />
              </svg>
            </span>
          </label>
          {results.length > 0 ? (
            <ul className="mt-2 max-h-60 overflow-y-auto rounded-[8px] border border-[#E8E8E8]">
              {results.map((route) => (
                <li key={route.routeId} className="border-b border-[#E8E8E8] last:border-b-0">
                  <button
                    type="button"
                    onClick={() => selectRoute(route)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                  >
                    <span>
                      <span className="block text-[14px] font-medium leading-5 text-[#090909]">
                        {route.routeName}
                      </span>
                      <span className="block text-[11px] leading-4 text-[#7A7A7A]">
                        {route.boulderName} · {route.cragName}
                      </span>
                    </span>
                    <span className="text-[14px] font-medium leading-5 text-[#2A2A2A]">{route.routeGrade}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="border-b-4 border-[#F1F1F1] px-4 py-5">
          <label className="block text-[14px] font-medium leading-5 text-[#090909]">
            완등 날짜 <span className="text-[#FF3B30]">*</span>
            <input
              type="date"
              name="sentAt"
              value={sentAt}
              onChange={(event) => setSentAt(event.target.value)}
              className="mt-2 h-12 w-full rounded-[8px] border border-[#E8E8E8] px-4 text-[14px] leading-5 text-[#090909]"
            />
          </label>
        </section>

        {selectedRoute ? (
          <>
            <section className="border-b-4 border-[#F1F1F1] px-4 py-5">
              <h2 className="text-[14px] font-medium leading-5 text-[#090909]">루트 평가</h2>
              <div className="mt-3 flex items-center gap-3">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={`별점 ${value}점`}
                    aria-pressed={rating >= value}
                    onClick={() => setRating(rating === value ? 0 : value)}
                    className="grid size-9 place-items-center"
                  >
                    <svg
                      aria-hidden
                      viewBox="0 0 24 24"
                      className={`size-9 ${rating >= value ? "fill-[#FFD60A]" : "fill-[#E8E8E8]"}`}
                    >
                      <path d="M12 2l2.9 6.26L21.5 9.2l-4.75 4.4 1.15 6.6L12 17.1l-5.9 3.1 1.15-6.6L2.5 9.2l6.6-.94L12 2z" />
                    </svg>
                  </button>
                ))}
              </div>
            </section>

            <section className="px-4 py-5">
              <h2 className="text-[14px] font-medium leading-5 text-[#090909]">영상 추가</h2>
              <p className="mt-1 text-[12px] leading-4 text-[#7A7A7A]">
                아래 캡션을 복사 후, 인스타그램 게시물 포스트 하단에 작성해주세요.
              </p>
              <p className="mt-3 rounded-[8px] bg-[#F7F8F8] px-4 py-3 text-[12px] leading-5 text-[#3A3A3A]">
                {caption}
              </p>
              <button
                type="button"
                onClick={copyCaptionAndOpenInstagram}
                className="mt-3 h-11 w-full rounded-full bg-[#1A1A1A] text-[14px] font-semibold leading-5 text-white"
              >
                캡션 복사하고 → Instagram 열기
              </button>

              <label className="mt-5 block text-[14px] font-medium leading-5 text-[#090909]">
                링크로 영상 추가
                <input
                  type="url"
                  name="mediaUrl"
                  placeholder="Youtube 혹은 Instagram 링크"
                  className="mt-2 h-12 w-full rounded-[8px] border border-[#E8E8E8] px-4 text-[14px] leading-5 text-[#090909] placeholder:text-[#B8B8B8]"
                />
              </label>
            </section>
          </>
        ) : null}

        {state?.message ? (
          <p className="px-4 pb-2 text-[13px] leading-5 text-[#7A7A7A]">{state.message}</p>
        ) : null}

        <div className="mt-auto px-4 pt-4">
          <button
            type="submit"
            disabled={pending || !selectedRoute || !sentAt}
            className="h-14 w-full rounded-full bg-[#1A1A1A] text-[16px] font-semibold leading-6 text-white disabled:opacity-40"
          >
            {pending ? "추가 중" : "추가하기"}
          </button>
        </div>
      </form>
    </div>
  );
}
```

Also add the body-scroll-lock + Escape-close effects following the exact pattern in `route-more-sheet.tsx` (`useEffect` blocks at lines 57-81) — copy those two effects into this component.

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run components/public/add-record-dialog.test.tsx`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add components/public/add-record-dialog.tsx components/public/add-record-dialog.test.tsx
git commit -m "feat: add-record dialog per figma 56-1439/56-1457"
```

---

### Task 8: Records-tab entry point (기록 추가 button)

**Files:**
- Create: `components/public/add-record-launcher.tsx`
- Modify: `components/public/record-send-chart.tsx:22-33`
- Test: `components/public/record-send-chart.test.tsx`, `components/public/add-record-launcher.test.tsx`

- [x] **Step 1: Write failing tests**

Create `components/public/add-record-launcher.test.tsx`:

```tsx
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/actions/record", () => ({
  searchRoutesForRecordAction: vi.fn(),
  addRecordAction: vi.fn()
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() })
}));

import { AddRecordLauncher } from "./add-record-launcher";

describe("AddRecordLauncher", () => {
  it("opens and closes the add-record dialog", () => {
    render(<AddRecordLauncher />);

    fireEvent.click(screen.getByRole("button", { name: "기록 추가" }));
    expect(screen.getByRole("dialog", { name: "기록 추가" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog", { name: "기록 추가" })).not.toBeInTheDocument();
  });
});
```

Update `components/public/record-send-chart.test.tsx`: the existing assertion `expect(screen.getByRole("button", { name: "기록 추가" })).toBeDisabled()` becomes `toBeEnabled()` (add the same two `vi.mock` blocks above since the launcher renders inside).

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run components/public/add-record-launcher.test.tsx components/public/record-send-chart.test.tsx`
Expected: FAIL.

- [x] **Step 3: Implement**

Create `components/public/add-record-launcher.tsx`:

```tsx
"use client";

import React, { useState } from "react";
import { AddRecordDialog } from "./add-record-dialog";

export function AddRecordLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-[14px] font-medium leading-5 text-[#090909]"
      >
        기록 추가
        <svg aria-hidden viewBox="0 0 16 16" className="size-4 fill-none stroke-[#090909]" strokeWidth="1.4">
          <path d="M8 3v10M3 8h10" />
        </svg>
      </button>
      {open ? <AddRecordDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}
```

In `components/public/record-send-chart.tsx`, replace the disabled button block (lines 23-33) with:

```tsx
<AddRecordLauncher />
```

and add `import { AddRecordLauncher } from "./add-record-launcher";` at the top. `RecordSendChart` stays a server-safe component; the launcher is the client leaf.

- [x] **Step 4: Run tests**

Run: `pnpm vitest run components/public/add-record-launcher.test.tsx components/public/record-send-chart.test.tsx`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add components/public/add-record-launcher.tsx components/public/add-record-launcher.test.tsx components/public/record-send-chart.tsx components/public/record-send-chart.test.tsx
git commit -m "feat: enable add-record entry on records tab"
```

---

### Task 9: More-sheet check-button entry point

**Files:**
- Modify: `components/public/route-more-sheet.tsx` (props + check button at line 116)
- Modify: `app/(site)/t/[topoId]/page.tsx` (pass new props)
- Test: `components/public/route-more-sheet.test.tsx` (or the `route-more-actions.test.tsx` that covers the sheet)

- [x] **Step 1: Write failing tests**

In the test file covering `RouteMoreSheet` (check which of `route-more-actions.test.tsx` / a sheet-specific file renders it; add the shared props to its existing fixture). Add tests:

```tsx
// fixture additions for every render of RouteMoreSheet / RouteMoreActions:
const recordRoute = {
  routeId: "route_1",
  routeName: "Honey No.6",
  routeGrade: "V6",
  boulderName: "허니 볼더",
  sectorName: "허니1",
  cragName: "안양예술공원",
  boulderHashtags: ["안양_허니넘버6"]
};
// ...pass recordRoute={recordRoute} isLoggedIn={true} (or false per test)

it("opens the add-record dialog prefilled when logged in", () => {
  renderSheet({ isLoggedIn: true });

  fireEvent.click(screen.getByRole("button", { name: "완등 기록" }));

  expect(screen.getByRole("dialog", { name: "기록 추가" })).toBeInTheDocument();
  expect(screen.getByText("루트 평가")).toBeInTheDocument(); // prefilled state
});

it("sends logged-out users to login with returnTo", () => {
  renderSheet({ isLoggedIn: false });

  fireEvent.click(screen.getByRole("button", { name: "완등 기록" }));

  expect(screen.queryByRole("dialog", { name: "기록 추가" })).not.toBeInTheDocument();
  // assert on the login navigation: with next/navigation mocked,
  // expect push to have been called with "/login?returnTo=..." containing the encoded returnTo
});
```

Mock `next/navigation`'s `useRouter` (`push`, `refresh`) and `@/lib/actions/record` as in Task 7's test.

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run components/public/route-more-actions.test.tsx` (plus the sheet test file if separate)
Expected: FAIL — props don't exist, button has no handler.

- [x] **Step 3: Implement**

In `components/public/route-more-sheet.tsx`:

1. Add imports:

```tsx
import { useRouter } from "next/navigation";
import { AddRecordDialog } from "./add-record-dialog";
import type { RouteSearchItemForRecord } from "@/lib/actions/record";
```

2. Extend `RouteMoreSheetProps`:

```ts
recordRoute: RouteSearchItemForRecord;
isLoggedIn: boolean;
```

3. In the component body add:

```tsx
const router = useRouter();
const [showAddRecord, setShowAddRecord] = useState(false);

function handleAddRecordClick() {
  if (!isLoggedIn) {
    router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    return;
  }
  setShowAddRecord(true);
}
```

4. Replace the placeholder check button (line 116):

```tsx
<button
  type="button"
  aria-label="완등 기록"
  onClick={handleAddRecordClick}
  className="size-6 text-[#121212]"
>
  <DoubleCheckIcon className="size-6" />
</button>
```

5. Render the dialog next to the existing `BetaVideoSheet` conditional:

```tsx
{showAddRecord ? (
  <AddRecordDialog prefilledRoute={recordRoute} onClose={() => setShowAddRecord(false)} />
) : null}
```

In `app/(site)/t/[topoId]/page.tsx`:

1. Thread `isLoggedIn` into `TopoRouteSheet` — the page already computes `session` (line 42); pass `isLoggedIn={Boolean(session)}` down through `TopoRouteSheet` props.
2. In the route map, add to `<RouteMoreActions ...>`:

```tsx
recordRoute={{
  routeId: route.id,
  routeName: route.name,
  routeGrade: route.grade,
  boulderName: topo.boulder.name,
  sectorName: topo.sector.name,
  cragName: topo.crag.name,
  boulderHashtags: parseHashtags(topo.boulder.hashtags)
}}
isLoggedIn={isLoggedIn}
```

(`RouteMoreActionsProps = Omit<RouteMoreSheetProps, "onClose">`, so the new props flow through `RouteMoreActions` automatically.)

- [x] **Step 4: Run tests + typecheck**

Run: `pnpm vitest run components/public/ && pnpm typecheck`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add components/public/route-more-sheet.tsx components/public/route-more-actions.test.tsx "app/(site)/t/[topoId]/page.tsx"
git commit -m "feat: open prefilled add-record dialog from route more sheet"
```

---

### Task 10: Docs + final verification

**Files:**
- Modify: `docs/ROADMAP.md` (Phase 10 status + gates)
- Modify: `docs/DATA_MODEL.md` (add `user_records`)

- [x] **Step 1: Full verification**

Run in order; all must pass before docs are updated:

```bash
pnpm test
pnpm typecheck
pnpm build
```

If the local D1 is available, smoke the flow: `pnpm dev`, log in, add a record from `/me/records` (search a route, set date/rating), confirm it appears in the chart/recent list; add one with a YouTube URL and confirm a pending beta row exists (admin betas page) and the video shows in 나의 영상.

- [x] **Step 2: Update `docs/DATA_MODEL.md`**

Add a `user_records` section next to the betas section describing the table (columns as in Task 1), ownership semantics (record = user's own send log, immediately visible to the owner; `beta_id` links the optional pending video), and the Phase 10 note that user-added manual betas carry `user_id` + `claim_status='claimed'`.

- [x] **Step 3: Update `docs/ROADMAP.md`**

- Mark Phase 10 milestone row 상태 as 완료 and check off the 출시 게이트 items that are done, following the exact style used for Phase 9 (반영 note with PR/merge references is added at merge time — leave a 반영 placeholder note referencing this branch).
- Update the line 16 Phase 9 note: the mock read model swap promised for Phase 10 is now done.

- [x] **Step 4: Commit**

```bash
git add docs/ROADMAP.md docs/DATA_MODEL.md
git commit -m "docs: mark phase 10 add-record scope and user_records model"
```

---

## Self-Review Checklist (done at plan time)

- **Spec coverage:** entry points (Tasks 8, 9), route search (Tasks 4, 5), date/rating/media inputs (Task 7), pending beta + duplicate prevention (Tasks 3, 5), immediate own-record visibility (Task 6), caption (Task 2), migration (Task 1), docs/gates (Task 10). Login redirect for the More-sheet entry: Task 9. Error messages: Task 5.
- **Type consistency:** `RouteSearchItemForRecord` (actions) is the dialog/sheet prop type; `RouteSearchRowForRecord` (db, hashtags as JSON string) maps to it in `searchRoutesForRecordAction`. `UserRecordWithRoute.recordId` feeds `RecentRecordItem.id`.
- **Known runtime checks left to implementers:** `detectMediaPlatform` failure mode (Task 5 Step 1 note), `UserRecordGradeBucket` exact shape (Task 4 note), `AdminBetaRow` extends-compat (Task 3 note), which test file renders `RouteMoreSheet` (Task 9 note).
