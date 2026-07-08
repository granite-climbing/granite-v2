# Granite Phase 9 Records Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **구현 노트 (2026-07-09):** 본 플랜의 Task 1-9는 모두 수행되어 PR #8로 머지되었다. 머지 과정에서 Figma 최신안(56-1299/56-1399)에 맞춰 화면이 재구성되었다: 요약 그리드/가로 분포/썸네일 리스트/연결 가능한 기록 섹션은 다크 프로필 헤더 + 나의 영상/나의 기록 탭 + 완등 차트 + 최근 기록 + 세부 분석 placeholder로 대체되었고, 기록 추가가 없는 동안 화면 데이터는 mock(`lib/records/user-records-view.ts`)이다. 본 플랜에서 구현한 read model(`lib/db/record-queries.ts`)과 인증 보호는 그대로 유지되며 Phase 10에서 실데이터 연결에 사용된다.

**Goal:** Turn the scaffolded Records tab into a logged-in, read-only record dashboard that shows the user's approved Beta records, grade distribution, recent records, and clearly separated claim candidates.

**Architecture:** Keep Phase 9 query-only from the user's perspective: no record creation, no claim mutation, and no account ownership verification. Build a user-specific read model in `lib/db/record-queries.ts` from existing `betas`, `routes`, `topos`, `boulders`, `sectors`, `crags`, and `users` data; protect `/me/records` with the existing `granite_session` cookie. Render the dashboard through focused server-safe components, with any future interactions left disabled or routed to Phase 10.

**Tech Stack:** Next.js App Router, React Server Components by default, TypeScript strict, Cloudflare D1 HTTP API, Tailwind CSS, Vitest, React Testing Library.

---

## Product References

- Roadmap scope: `docs/ROADMAP.md#phase-9--records-tab`
- Figma: [Records tab node `56-1299`](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=56-1299&t=Nj8NzKW38WUPfN3F-4)
- Figma: [Records tab detail node `56-1399`](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=56-1399&t=Nj8NzKW38WUPfN3F-4)
- Existing scaffold: `app/(site)/me/records/page.tsx`
- Existing Beta schema: `migrations/0004_beta_instagram.sql`
- Existing auth pattern: `app/(site)/me/page.tsx`

## Scope

In scope:

- Replace `/me/records` scaffold with a protected logged-in page.
- Add a typed records read model from existing Beta data.
- Show summary stats:
  - total approved owned records
  - highest V grade
  - recent record date
  - count of claim candidates
- Show grade distribution for owned approved records.
- Show a recent owned record list with route, grade, crag/sector/boulder context, date, media platform, and media link.
- Show approved unclaimed Instagram records matching the logged-in user's `instagram_id` in a separate "연결 가능한 기록" section.
- Keep claim actions disabled and explanatory because ownership verification and claim mutation are Phase 10+ work.
- Redirect anonymous users to `/login?returnTo=/me/records`.

Out of scope:

- Record creation UI.
- Manual Beta submission from `/me/records`.
- Instagram or YouTube ownership verification.
- Automatic claim or admin claim approval queue.
- Editing/deleting records.
- Detailed analytics beyond lightweight grade distribution and recent records.
- Public profile record sharing.
- Persisted record privacy settings. Keep the `/me` Record privacy row disabled until public profile semantics are specified.

## Assumptions

- "내 기록" means `betas.user_id = currentUser.id`, `status = 'approved'`, and `deleted_at IS NULL`.
- "연결 가능한 기록" means `betas.user_id IS NULL`, `claim_status = 'unclaimed'`, `status = 'approved'`, `deleted_at IS NULL`, and normalized `betas.instagram_id` equals the current user's normalized `users.instagram_id`.
- Pending records are intentionally not shown in Phase 9 because Phase 10 owns record creation and pending-state user messaging.
- Hidden and removed Betas never appear on the user Records page.
- If the user has no Instagram ID, the claim candidate section renders an empty explanatory state.
- The records page is user-specific and must not use `unstable_cache` public content tags.

## Current Code Map

- `app/(site)/me/records/page.tsx`
  - Current scaffold to replace.
- `app/(site)/me/page.tsx`
  - Protected page pattern using `cookies()`, `USER_SESSION_COOKIE_NAME`, and `verifyUserSessionToken`.
- `lib/db/schema.ts`
  - Existing `Beta`, `Route`, and `User` types. Add records-specific read model types here.
- `lib/db/beta-queries.ts`
  - Existing admin/public Beta query patterns. Keep Phase 9 user records in a new file because records are user-specific.
- `lib/beta/normalize.ts`
  - Existing handle normalization. Use for user Instagram ID matching before query input.
- `components/public/beta-video-grid.tsx`
  - Reference for media thumbnail/link behavior; Records page uses list rows, not the public 3-column grid.
- `app/(site)/me/me-page-model.ts`
  - Records privacy row remains disabled in Phase 9.

## Planned File Changes

- Modify: `lib/db/schema.ts`
  - Add `UserRecordListItem`, `UserRecordClaimCandidate`, `UserRecordGradeBucket`, and `UserRecordsModel` types.
- Create: `lib/db/record-queries.ts`
  - User-specific approved owned record reads, matching claim candidate reads, grade buckets, and model builder.
- Create: `lib/db/record-queries.test.ts`
  - Tests approved-only filters, claim candidate filters, grade aggregation, and empty model handling.
- Create: `components/public/record-summary.tsx`
  - Summary metric row for total, highest grade, latest date, candidate count.
- Create: `components/public/record-summary.test.tsx`
  - Tests metric labels and empty values.
- Create: `components/public/record-grade-distribution.tsx`
  - Compact grade distribution bars.
- Create: `components/public/record-grade-distribution.test.tsx`
  - Tests bucket rendering and empty state.
- Create: `components/public/record-list.tsx`
  - Recent owned record list.
- Create: `components/public/record-list.test.tsx`
  - Tests route context, platform, date, media link, and empty state.
- Create: `components/public/record-claim-candidates.tsx`
  - Read-only claim candidate section with disabled action.
- Create: `components/public/record-claim-candidates.test.tsx`
  - Tests candidate rendering and no-Instagram state.
- Modify: `app/(site)/me/records/page.tsx`
  - Replace scaffold with protected records dashboard.
- Create: `app/(site)/me/records/page.test.ts`
  - Source-level regression for auth redirect, query usage, and dashboard components.
- Modify: `docs/ROADMAP.md`
  - Add Phase 9 plan link.

---

## Task 1: Add Record Read Model Types

**Files:**
- Modify: `lib/db/schema.ts`

- [x] **Step 1: Add record types**

Add these types after the `Beta` type in `lib/db/schema.ts`:

```ts
export type UserRecordListItem = {
  betaId: string;
  routeId: string;
  topoId: string;
  routeName: string;
  routeGrade: string;
  routeGradeNum: number;
  boulderName: string;
  sectorName: string;
  cragName: string;
  platform: BetaPlatform;
  mediaUrl: string;
  thumbnailUrl: string | null;
  sentAt: string;
  displayName: string;
};

export type UserRecordClaimCandidate = UserRecordListItem & {
  instagramId: string;
  claimStatus: BetaClaimStatus;
};

export type UserRecordGradeBucket = {
  grade: string;
  gradeNum: number;
  count: number;
};

export type UserRecordsModel = {
  records: UserRecordListItem[];
  claimCandidates: UserRecordClaimCandidate[];
  gradeBuckets: UserRecordGradeBucket[];
  summary: {
    totalRecords: number;
    highestGrade: string;
    latestSentAt: string | null;
    claimCandidateCount: number;
  };
};
```

- [x] **Step 2: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add lib/db/schema.ts
git commit -m "feat: add user record read model types"
```

## Task 2: Add User Record Queries

**Files:**
- Create: `lib/db/record-queries.ts`
- Create: `lib/db/record-queries.test.ts`

- [x] **Step 1: Write query tests**

Create `lib/db/record-queries.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildUserRecordsModel,
  getApprovedClaimCandidateRecordsByInstagramId,
  getApprovedRecordsByUserId,
  getRecordGradeBuckets
} from "./record-queries";

const queryD1Mock = vi.hoisted(() => vi.fn());

vi.mock("./d1-http", () => ({
  queryD1: queryD1Mock
}));

describe("record queries", () => {
  beforeEach(() => {
    queryD1Mock.mockReset();
  });

  it("loads approved owned records for a user", async () => {
    queryD1Mock.mockResolvedValueOnce([
      {
        betaId: "beta_1",
        routeId: "route_1",
        topoId: "topo_1",
        routeName: "Little Finger",
        routeGrade: "V5",
        routeGradeNum: 5,
        boulderName: "리틀핑거 바위",
        sectorName: "메인 섹터",
        cragName: "현충바위",
        platform: "instagram",
        mediaUrl: "https://www.instagram.com/reel/example/",
        thumbnailUrl: "https://cdn.granite.kr/betas/beta_1/thumb.jpg",
        sentAt: "2026-07-01T00:00:00.000Z",
        displayName: "granite_user"
      }
    ]);

    const records = await getApprovedRecordsByUserId("user_1");

    expect(queryD1Mock).toHaveBeenCalledWith(expect.stringContaining("be.user_id = ?"), ["user_1"]);
    expect(queryD1Mock.mock.calls[0][0]).toContain("be.status = 'approved'");
    expect(queryD1Mock.mock.calls[0][0]).toContain("be.deleted_at IS NULL");
    expect(records).toEqual([
      expect.objectContaining({
        betaId: "beta_1",
        routeName: "Little Finger",
        routeGrade: "V5"
      })
    ]);
  });

  it("loads approved unclaimed Instagram claim candidates", async () => {
    queryD1Mock.mockResolvedValueOnce([
      {
        betaId: "beta_2",
        routeId: "route_2",
        topoId: "topo_2",
        routeName: "Even Flow",
        routeGrade: "V7",
        routeGradeNum: 7,
        boulderName: "이븐플로우 바위",
        sectorName: "메인 섹터",
        cragName: "인수봉",
        platform: "instagram",
        mediaUrl: "https://www.instagram.com/reel/candidate/",
        thumbnailUrl: null,
        sentAt: "2026-07-02T00:00:00.000Z",
        displayName: "granite_user",
        instagramId: "granite_user",
        claimStatus: "unclaimed"
      }
    ]);

    const candidates = await getApprovedClaimCandidateRecordsByInstagramId("granite_user");

    expect(queryD1Mock).toHaveBeenCalledWith(expect.stringContaining("be.user_id IS NULL"), ["granite_user"]);
    expect(queryD1Mock.mock.calls[0][0]).toContain("be.claim_status = 'unclaimed'");
    expect(queryD1Mock.mock.calls[0][0]).toContain("be.platform = 'instagram'");
    expect(candidates[0]).toMatchObject({
      betaId: "beta_2",
      claimStatus: "unclaimed",
      instagramId: "granite_user"
    });
  });

  it("returns no claim candidates when Instagram id is missing", async () => {
    const candidates = await getApprovedClaimCandidateRecordsByInstagramId(null);

    expect(candidates).toEqual([]);
    expect(queryD1Mock).not.toHaveBeenCalled();
  });

  it("builds grade buckets from records", () => {
    const buckets = getRecordGradeBuckets([
      { routeGrade: "V5", routeGradeNum: 5 },
      { routeGrade: "V7", routeGradeNum: 7 },
      { routeGrade: "V5", routeGradeNum: 5 }
    ]);

    expect(buckets).toEqual([
      { grade: "V5", gradeNum: 5, count: 2 },
      { grade: "V7", gradeNum: 7, count: 1 }
    ]);
  });

  it("builds a records model summary", () => {
    const model = buildUserRecordsModel({
      records: [
        {
          betaId: "beta_1",
          routeId: "route_1",
          topoId: "topo_1",
          routeName: "Little Finger",
          routeGrade: "V5",
          routeGradeNum: 5,
          boulderName: "리틀핑거 바위",
          sectorName: "메인 섹터",
          cragName: "현충바위",
          platform: "instagram",
          mediaUrl: "https://www.instagram.com/reel/example/",
          thumbnailUrl: null,
          sentAt: "2026-07-01T00:00:00.000Z",
          displayName: "granite_user"
        }
      ],
      claimCandidates: [
        {
          betaId: "beta_2",
          routeId: "route_2",
          topoId: "topo_2",
          routeName: "Even Flow",
          routeGrade: "V7",
          routeGradeNum: 7,
          boulderName: "이븐플로우 바위",
          sectorName: "메인 섹터",
          cragName: "인수봉",
          platform: "instagram",
          mediaUrl: "https://www.instagram.com/reel/candidate/",
          thumbnailUrl: null,
          sentAt: "2026-07-02T00:00:00.000Z",
          displayName: "granite_user",
          instagramId: "granite_user",
          claimStatus: "unclaimed"
        }
      ]
    });

    expect(model.summary).toEqual({
      totalRecords: 1,
      highestGrade: "V5",
      latestSentAt: "2026-07-01T00:00:00.000Z",
      claimCandidateCount: 1
    });
    expect(model.gradeBuckets).toEqual([{ grade: "V5", gradeNum: 5, count: 1 }]);
  });
});
```

- [x] **Step 2: Run the tests and verify they fail**

Run:

```bash
pnpm test -- lib/db/record-queries.test.ts
```

Expected: FAIL because `lib/db/record-queries.ts` does not exist.

- [x] **Step 3: Implement record queries**

Create `lib/db/record-queries.ts`:

```ts
import { queryD1 } from "./d1-http";
import type { UserRecordClaimCandidate, UserRecordGradeBucket, UserRecordListItem, UserRecordsModel } from "./schema";

type PartialRecordForBucket = Pick<UserRecordListItem, "routeGrade" | "routeGradeNum">;

const APPROVED_RECORD_SELECT = `
  be.id AS betaId,
  r.id AS routeId,
  r.topo_id AS topoId,
  r.name AS routeName,
  r.grade AS routeGrade,
  r.grade_num AS routeGradeNum,
  b.name AS boulderName,
  s.name AS sectorName,
  c.name AS cragName,
  be.platform,
  COALESCE(be.permalink_url, be.media_url) AS mediaUrl,
  be.thumbnail_url AS thumbnailUrl,
  be.sent_at AS sentAt,
  be.display_name AS displayName
`;

const PUBLISHED_ROUTE_JOIN = `
  JOIN routes r ON r.id = be.route_id
  JOIN topos t ON t.id = r.topo_id
  JOIN boulders b ON b.id = t.boulder_id
  JOIN sectors s ON s.id = b.sector_id
  JOIN crags c ON c.id = s.crag_id
  JOIN areas a ON a.id = c.area_id
`;

const PUBLISHED_ROUTE_FILTER = `
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
`;

export async function getApprovedRecordsByUserId(userId: string): Promise<UserRecordListItem[]> {
  return queryD1<UserRecordListItem>(
    `SELECT
       ${APPROVED_RECORD_SELECT}
     FROM betas be
     ${PUBLISHED_ROUTE_JOIN}
     WHERE be.user_id = ?
       AND be.status = 'approved'
       AND be.deleted_at IS NULL
       ${PUBLISHED_ROUTE_FILTER}
     ORDER BY be.sent_at DESC, be.created_at DESC`,
    [userId]
  );
}

export async function getApprovedClaimCandidateRecordsByInstagramId(
  instagramId: string | null
): Promise<UserRecordClaimCandidate[]> {
  if (!instagramId) {
    return [];
  }

  return queryD1<UserRecordClaimCandidate>(
    `SELECT
       ${APPROVED_RECORD_SELECT},
       be.instagram_id AS instagramId,
       be.claim_status AS claimStatus
     FROM betas be
     ${PUBLISHED_ROUTE_JOIN}
     WHERE be.user_id IS NULL
       AND be.instagram_id = ?
       AND be.platform = 'instagram'
       AND be.status = 'approved'
       AND be.claim_status = 'unclaimed'
       AND be.deleted_at IS NULL
       ${PUBLISHED_ROUTE_FILTER}
     ORDER BY be.sent_at DESC, be.created_at DESC`,
    [instagramId]
  );
}

export function getRecordGradeBuckets(records: PartialRecordForBucket[]): UserRecordGradeBucket[] {
  const counts = new Map<number, { grade: string; gradeNum: number; count: number }>();

  for (const record of records) {
    const existing = counts.get(record.routeGradeNum);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(record.routeGradeNum, {
        grade: record.routeGrade,
        gradeNum: record.routeGradeNum,
        count: 1
      });
    }
  }

  return Array.from(counts.values()).sort((a, b) => a.gradeNum - b.gradeNum);
}

export function buildUserRecordsModel(input: {
  records: UserRecordListItem[];
  claimCandidates: UserRecordClaimCandidate[];
}): UserRecordsModel {
  const highest = input.records.reduce<UserRecordListItem | null>((current, record) => {
    if (!current || record.routeGradeNum > current.routeGradeNum) {
      return record;
    }
    return current;
  }, null);
  const latest = input.records[0] ?? null;

  return {
    records: input.records,
    claimCandidates: input.claimCandidates,
    gradeBuckets: getRecordGradeBuckets(input.records),
    summary: {
      totalRecords: input.records.length,
      highestGrade: highest?.routeGrade ?? "-",
      latestSentAt: latest?.sentAt ?? null,
      claimCandidateCount: input.claimCandidates.length
    }
  };
}
```

- [x] **Step 4: Run tests**

Run:

```bash
pnpm test -- lib/db/record-queries.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add lib/db/record-queries.ts lib/db/record-queries.test.ts
git commit -m "feat: add user record queries"
```

## Task 3: Add Records Summary Component

**Files:**
- Create: `components/public/record-summary.tsx`
- Create: `components/public/record-summary.test.tsx`

- [x] **Step 1: Write component tests**

Create `components/public/record-summary.test.tsx`:

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecordSummary } from "./record-summary";
import type { UserRecordsModel } from "@/lib/db/schema";

const summary: UserRecordsModel["summary"] = {
  totalRecords: 7,
  highestGrade: "V8",
  latestSentAt: "2026-07-01T00:00:00.000Z",
  claimCandidateCount: 2
};

describe("RecordSummary", () => {
  it("renders record metrics", () => {
    render(<RecordSummary summary={summary} />);

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("V8")).toBeInTheDocument();
    expect(screen.getByText("2026.07.01")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders empty latest date", () => {
    render(<RecordSummary summary={{ ...summary, latestSentAt: null }} />);

    expect(screen.getByText("-")).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run the tests and verify they fail**

Run:

```bash
pnpm test -- components/public/record-summary.test.tsx
```

Expected: FAIL because `components/public/record-summary.tsx` does not exist.

- [x] **Step 3: Implement component**

Create `components/public/record-summary.tsx`:

```tsx
import type { UserRecordsModel } from "@/lib/db/schema";

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
    .format(new Date(value))
    .replace(/\.\s?/g, ".")
    .replace(/\.$/, "");
}

export function RecordSummary({ summary }: { summary: UserRecordsModel["summary"] }) {
  const metrics = [
    { label: "기록", value: String(summary.totalRecords) },
    { label: "최고", value: summary.highestGrade },
    { label: "최근", value: formatDate(summary.latestSentAt) },
    { label: "연결", value: String(summary.claimCandidateCount) }
  ];

  return (
    <section aria-label="기록 요약" className="grid grid-cols-4 border-y border-[#ECECEC] bg-white">
      {metrics.map((metric) => (
        <div key={metric.label} className="px-2 py-4 text-center">
          <div className="text-[18px] font-black leading-6 text-black">{metric.value}</div>
          <div className="mt-1 text-[11px] font-bold leading-4 text-[#8A8A8A]">{metric.label}</div>
        </div>
      ))}
    </section>
  );
}
```

- [x] **Step 4: Run tests**

Run:

```bash
pnpm test -- components/public/record-summary.test.tsx
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add components/public/record-summary.tsx components/public/record-summary.test.tsx
git commit -m "feat: add record summary"
```

## Task 4: Add Grade Distribution Component

**Files:**
- Create: `components/public/record-grade-distribution.tsx`
- Create: `components/public/record-grade-distribution.test.tsx`

- [x] **Step 1: Write component tests**

Create `components/public/record-grade-distribution.test.tsx`:

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecordGradeDistribution } from "./record-grade-distribution";

describe("RecordGradeDistribution", () => {
  it("renders grade buckets", () => {
    render(
      <RecordGradeDistribution
        buckets={[
          { grade: "V3", gradeNum: 3, count: 1 },
          { grade: "V5", gradeNum: 5, count: 3 }
        ]}
      />
    );

    expect(screen.getByText("V3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("V5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    render(<RecordGradeDistribution buckets={[]} />);

    expect(screen.getByText("아직 분석할 기록이 없습니다.")).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run the tests and verify they fail**

Run:

```bash
pnpm test -- components/public/record-grade-distribution.test.tsx
```

Expected: FAIL because `components/public/record-grade-distribution.tsx` does not exist.

- [x] **Step 3: Implement component**

Create `components/public/record-grade-distribution.tsx`:

```tsx
import type { UserRecordGradeBucket } from "@/lib/db/schema";

export function RecordGradeDistribution({ buckets }: { buckets: UserRecordGradeBucket[] }) {
  const maxCount = Math.max(...buckets.map((bucket) => bucket.count), 0);

  return (
    <section className="bg-white px-5 py-5">
      <h2 className="text-[15px] font-black leading-5 text-black">난이도 분포</h2>
      {buckets.length > 0 ? (
        <div className="mt-4 space-y-3">
          {buckets.map((bucket) => {
            const width = maxCount > 0 ? `${Math.max(18, Math.round((bucket.count / maxCount) * 100))}%` : "18%";
            return (
              <div key={bucket.grade} className="grid grid-cols-[42px_1fr_24px] items-center gap-3">
                <span className="text-[12px] font-black text-black">{bucket.grade}</span>
                <div className="h-2 rounded-full bg-[#ECECEC]">
                  <div className="h-2 rounded-full bg-black" style={{ width }} />
                </div>
                <span className="text-right text-[12px] font-bold text-[#6F7477]">{bucket.count}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-[13px] font-semibold leading-5 text-[#6F7477]">아직 분석할 기록이 없습니다.</p>
      )}
    </section>
  );
}
```

- [x] **Step 4: Run tests**

Run:

```bash
pnpm test -- components/public/record-grade-distribution.test.tsx
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add components/public/record-grade-distribution.tsx components/public/record-grade-distribution.test.tsx
git commit -m "feat: add record grade distribution"
```

## Task 5: Add Record List Component

**Files:**
- Create: `components/public/record-list.tsx`
- Create: `components/public/record-list.test.tsx`

- [x] **Step 1: Write component tests**

Create `components/public/record-list.test.tsx`:

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecordList } from "./record-list";
import type { UserRecordListItem } from "@/lib/db/schema";

const record: UserRecordListItem = {
  betaId: "beta_1",
  routeId: "route_1",
  topoId: "topo_1",
  routeName: "Little Finger",
  routeGrade: "V5",
  routeGradeNum: 5,
  boulderName: "리틀핑거 바위",
  sectorName: "메인 섹터",
  cragName: "현충바위",
  platform: "instagram",
  mediaUrl: "https://www.instagram.com/reel/example/",
  thumbnailUrl: "https://cdn.granite.kr/betas/beta_1/thumb.jpg",
  sentAt: "2026-07-01T00:00:00.000Z",
  displayName: "granite_user"
};

describe("RecordList", () => {
  it("renders record rows", () => {
    render(<RecordList records={[record]} />);

    expect(screen.getByRole("link", { name: "Little Finger V5" })).toHaveAttribute(
      "href",
      "/t/topo_1?route=route_1"
    );
    expect(screen.getByText("현충바위 · 메인 섹터 · 리틀핑거 바위")).toBeInTheDocument();
    expect(screen.getByText("Instagram")).toBeInTheDocument();
    expect(screen.getByText("2026.07.01")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "베타 영상 열기" })).toHaveAttribute("href", record.mediaUrl);
  });

  it("renders empty state", () => {
    render(<RecordList records={[]} />);

    expect(screen.getByText("아직 연결된 기록이 없습니다.")).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run the tests and verify they fail**

Run:

```bash
pnpm test -- components/public/record-list.test.tsx
```

Expected: FAIL because `components/public/record-list.tsx` does not exist.

- [x] **Step 3: Implement component**

Create `components/public/record-list.tsx`:

```tsx
import Link from "next/link";
import type { UserRecordListItem } from "@/lib/db/schema";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
    .format(new Date(value))
    .replace(/\.\s?/g, ".")
    .replace(/\.$/, "");
}

function platformLabel(platform: UserRecordListItem["platform"]): string {
  return platform === "instagram" ? "Instagram" : "YouTube";
}

export function RecordList({ records }: { records: UserRecordListItem[] }) {
  return (
    <section className="bg-white px-5 py-5">
      <h2 className="text-[15px] font-black leading-5 text-black">최근 기록</h2>
      {records.length > 0 ? (
        <div className="mt-3 divide-y divide-[#ECECEC]">
          {records.map((record) => {
            const routeHref = `/t/${record.topoId}?route=${record.routeId}`;
            const context = `${record.cragName} · ${record.sectorName} · ${record.boulderName}`;
            return (
              <article key={record.betaId} className="py-4">
                <div className="flex gap-3">
                  <a
                    href={record.mediaUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="베타 영상 열기"
                    className="grid size-[64px] shrink-0 place-items-center overflow-hidden bg-[#D9D9D9]"
                  >
                    {record.thumbnailUrl ? (
                      <img src={record.thumbnailUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-black text-white">{platformLabel(record.platform)}</span>
                    )}
                  </a>
                  <div className="min-w-0 flex-1">
                    <Link href={routeHref} className="block">
                      <span className="block text-[16px] font-black leading-5 text-black">
                        {record.routeName} <span className="text-[#6F7477]">{record.routeGrade}</span>
                      </span>
                      <span className="mt-1 block text-[12px] font-semibold leading-4 text-[#6F7477]">{context}</span>
                    </Link>
                    <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-[#8A8A8A]">
                      <span>{platformLabel(record.platform)}</span>
                      <span aria-hidden>·</span>
                      <time dateTime={record.sentAt}>{formatDate(record.sentAt)}</time>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-[13px] font-semibold leading-5 text-[#6F7477]">아직 연결된 기록이 없습니다.</p>
      )}
    </section>
  );
}
```

- [x] **Step 4: Run tests**

Run:

```bash
pnpm test -- components/public/record-list.test.tsx
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add components/public/record-list.tsx components/public/record-list.test.tsx
git commit -m "feat: add record list"
```

## Task 6: Add Claim Candidate Component

**Files:**
- Create: `components/public/record-claim-candidates.tsx`
- Create: `components/public/record-claim-candidates.test.tsx`

- [x] **Step 1: Write component tests**

Create `components/public/record-claim-candidates.test.tsx`:

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecordClaimCandidates } from "./record-claim-candidates";
import type { UserRecordClaimCandidate } from "@/lib/db/schema";

const candidate: UserRecordClaimCandidate = {
  betaId: "beta_2",
  routeId: "route_2",
  topoId: "topo_2",
  routeName: "Even Flow",
  routeGrade: "V7",
  routeGradeNum: 7,
  boulderName: "이븐플로우 바위",
  sectorName: "메인 섹터",
  cragName: "인수봉",
  platform: "instagram",
  mediaUrl: "https://www.instagram.com/reel/candidate/",
  thumbnailUrl: null,
  sentAt: "2026-07-02T00:00:00.000Z",
  displayName: "granite_user",
  instagramId: "granite_user",
  claimStatus: "unclaimed"
};

describe("RecordClaimCandidates", () => {
  it("renders matching claim candidates with disabled action", () => {
    render(<RecordClaimCandidates instagramId="granite_user" candidates={[candidate]} />);

    expect(screen.getByText("@granite_user")).toBeInTheDocument();
    expect(screen.getByText("Even Flow")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "연결 준비중" })).toBeDisabled();
  });

  it("renders no Instagram state", () => {
    render(<RecordClaimCandidates instagramId={null} candidates={[]} />);

    expect(screen.getByText("Instagram ID를 등록하면 연결 가능한 기록을 확인할 수 있습니다.")).toBeInTheDocument();
  });

  it("renders empty candidate state", () => {
    render(<RecordClaimCandidates instagramId="granite_user" candidates={[]} />);

    expect(screen.getByText("연결 가능한 기록이 없습니다.")).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run the tests and verify they fail**

Run:

```bash
pnpm test -- components/public/record-claim-candidates.test.tsx
```

Expected: FAIL because `components/public/record-claim-candidates.tsx` does not exist.

- [x] **Step 3: Implement component**

Create `components/public/record-claim-candidates.tsx`:

```tsx
import type { UserRecordClaimCandidate } from "@/lib/db/schema";

export function RecordClaimCandidates({
  instagramId,
  candidates
}: {
  instagramId: string | null;
  candidates: UserRecordClaimCandidate[];
}) {
  return (
    <section className="bg-white px-5 py-5">
      <h2 className="text-[15px] font-black leading-5 text-black">연결 가능한 기록</h2>
      {!instagramId ? (
        <p className="mt-3 text-[13px] font-semibold leading-5 text-[#6F7477]">
          Instagram ID를 등록하면 연결 가능한 기록을 확인할 수 있습니다.
        </p>
      ) : candidates.length > 0 ? (
        <div className="mt-3 divide-y divide-[#ECECEC]">
          {candidates.map((candidate) => (
            <article key={candidate.betaId} className="flex items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold leading-4 text-[#8A8A8A]">@{candidate.instagramId}</p>
                <p className="mt-1 truncate text-[15px] font-black leading-5 text-black">{candidate.routeName}</p>
                <p className="mt-1 text-[12px] font-semibold leading-4 text-[#6F7477]">
                  {candidate.cragName} · {candidate.routeGrade}
                </p>
              </div>
              <button
                type="button"
                disabled
                className="h-8 shrink-0 rounded-full bg-[#ECECEC] px-3 text-[12px] font-bold text-[#8A8A8A]"
              >
                연결 준비중
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[13px] font-semibold leading-5 text-[#6F7477]">연결 가능한 기록이 없습니다.</p>
      )}
    </section>
  );
}
```

- [x] **Step 4: Run tests**

Run:

```bash
pnpm test -- components/public/record-claim-candidates.test.tsx
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add components/public/record-claim-candidates.tsx components/public/record-claim-candidates.test.tsx
git commit -m "feat: add record claim candidates"
```

## Task 7: Replace `/me/records` Scaffold

**Files:**
- Modify: `app/(site)/me/records/page.tsx`
- Create: `app/(site)/me/records/page.test.ts`

- [x] **Step 1: Add source-level page test**

Create `app/(site)/me/records/page.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("app/(site)/me/records/page.tsx", "utf8");

describe("records page source", () => {
  it("uses user session auth and redirects anonymous users", () => {
    expect(source).toContain("USER_SESSION_COOKIE_NAME");
    expect(source).toContain("verifyUserSessionToken");
    expect(source).toContain('redirect("/login?returnTo=/me/records")');
  });

  it("loads the records model and renders dashboard components", () => {
    expect(source).toContain("getApprovedRecordsByUserId");
    expect(source).toContain("getApprovedClaimCandidateRecordsByInstagramId");
    expect(source).toContain("buildUserRecordsModel");
    expect(source).toContain("RecordSummary");
    expect(source).toContain("RecordGradeDistribution");
    expect(source).toContain("RecordList");
    expect(source).toContain("RecordClaimCandidates");
  });
});
```

- [x] **Step 2: Run the test and verify it fails**

Run:

```bash
pnpm test -- app/'(site)'/me/records/page.test.ts
```

Expected: FAIL because the current page is still scaffolded.

- [x] **Step 3: Implement protected records page**

Replace `app/(site)/me/records/page.tsx` with:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { RecordClaimCandidates } from "@/components/public/record-claim-candidates";
import { RecordGradeDistribution } from "@/components/public/record-grade-distribution";
import { RecordList } from "@/components/public/record-list";
import { RecordSummary } from "@/components/public/record-summary";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import { normalizeHandle } from "@/lib/beta/normalize";
import {
  buildUserRecordsModel,
  getApprovedClaimCandidateRecordsByInstagramId,
  getApprovedRecordsByUserId
} from "@/lib/db/record-queries";
import { findActiveUserById } from "@/lib/db/user-auth-queries";

export default async function RecordsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifyUserSessionToken(token) : null;

  if (!session) {
    redirect("/login?returnTo=/me/records");
  }

  const user = await findActiveUserById(session.userId);

  if (!user) {
    redirect("/login?returnTo=/me/records");
  }

  const instagramId = user.instagramId ? normalizeHandle(user.instagramId) : null;
  const [records, claimCandidates] = await Promise.all([
    getApprovedRecordsByUserId(user.id),
    getApprovedClaimCandidateRecordsByInstagramId(instagramId)
  ]);
  const model = buildUserRecordsModel({ records, claimCandidates });

  return (
    <main data-hide-site-footer className="min-h-screen bg-[#F7F7F7] pb-[90px] text-black">
      <AppHeader />
      <section className="bg-white px-5 pb-5 pt-6">
        <h1 className="text-[28px] font-black leading-9 text-black">기록</h1>
        <p className="mt-1 text-[13px] font-semibold leading-5 text-[#6F7477]">
          승인된 완등 기록과 연결 가능한 Instagram 기록을 확인하세요.
        </p>
      </section>
      <RecordSummary summary={model.summary} />
      <div className="mt-2">
        <RecordGradeDistribution buckets={model.gradeBuckets} />
      </div>
      <div className="mt-2">
        <RecordList records={model.records} />
      </div>
      <div className="mt-2">
        <RecordClaimCandidates instagramId={instagramId} candidates={model.claimCandidates} />
      </div>
    </main>
  );
}
```

- [x] **Step 4: Run tests**

Run:

```bash
pnpm test -- app/'(site)'/me/records/page.test.ts components/public/record-summary.test.tsx components/public/record-grade-distribution.test.tsx components/public/record-list.test.tsx components/public/record-claim-candidates.test.tsx
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add app/'(site)'/me/records/page.tsx app/'(site)'/me/records/page.test.ts
git commit -m "feat: implement records page"
```

## Task 8: Document Phase 9 Roadmap Link

**Files:**
- Modify: `docs/ROADMAP.md`

- [x] **Step 1: Add Phase 9 plan link**

In `docs/ROADMAP.md`, under Phase 9 Figma links, add:

```md
### 참고 문서

- [Phase 9 Plan](plans/2026-07-07-granite-phase-9.md)
```

- [x] **Step 2: Commit**

```bash
git add docs/ROADMAP.md docs/plans/2026-07-07-granite-phase-9.md
git commit -m "docs: add phase 9 plan"
```

## Task 9: Final Verification

**Files:**
- All Phase 9 files

- [x] **Step 1: Run targeted tests**

Run:

```bash
pnpm test -- lib/db/record-queries.test.ts components/public/record-summary.test.tsx components/public/record-grade-distribution.test.tsx components/public/record-list.test.tsx components/public/record-claim-candidates.test.tsx app/'(site)'/me/records/page.test.ts
```

Expected: PASS.

- [x] **Step 2: Run full test suite**

Run:

```bash
pnpm test
```

Expected: PASS.

- [x] **Step 3: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [x] **Step 4: Run production build**

Run:

```bash
pnpm build
```

Expected: PASS.

- [x] **Step 5: Manual QA**

Run:

```bash
pnpm dev
```

Expected manual checks:

- Anonymous `/me/records` redirects to `/login?returnTo=/me/records`.
- Logged-in `/me/records` shows zero-state summary and empty sections when the user has no approved owned records.
- Approved `betas.user_id = currentUser.id` records appear in recent records.
- Hidden, removed, pending, deleted, or unpublished ancestor records do not appear.
- Grade distribution counts only owned approved records.
- Highest grade reflects the largest `route.grade_num`.
- Latest date reflects the first record ordered by `sent_at DESC, created_at DESC`.
- Approved unclaimed Instagram Betas matching `users.instagram_id` appear only in "연결 가능한 기록".
- Claim candidate buttons are disabled and do not mutate data.

- [x] **Step 6: Final commit**

```bash
git status --short
git add lib/db/schema.ts lib/db/record-queries.ts lib/db/record-queries.test.ts components/public/record-summary.tsx components/public/record-summary.test.tsx components/public/record-grade-distribution.tsx components/public/record-grade-distribution.test.tsx components/public/record-list.tsx components/public/record-list.test.tsx components/public/record-claim-candidates.tsx components/public/record-claim-candidates.test.tsx app/'(site)'/me/records/page.tsx app/'(site)'/me/records/page.test.ts docs/ROADMAP.md docs/plans/2026-07-07-granite-phase-9.md
git commit -m "feat: implement phase 9 records"
```

---

## Release Gates

- [x] `/me/records` is no longer scaffold text.
- [x] `/me/records` is protected and redirects anonymous users to login.
- [x] User-specific records reads live outside public cached read models.
- [x] Owned records query returns only `user_id = currentUser.id`, `status = 'approved'`, non-deleted Betas on fully published Route ancestry.
- [x] Claim candidate query returns only approved, unclaimed, Instagram Betas matching the normalized logged-in user's Instagram ID.
- [x] No Phase 9 UI performs claim, create, edit, delete, or verification mutation.
- [x] Empty state, populated state, and no-Instagram state are all implemented.
- [x] Grade distribution and summary stats are derived from owned approved records only.
- [x] Hidden, removed, pending, deleted, and unpublished-ancestor Betas are excluded.
- [x] Records privacy toggle remains disabled or clearly non-persistent until public profile policy is defined.
- [x] `pnpm test`, `pnpm typecheck`, and `pnpm build` pass.

## Follow-Up Decisions

- Decide whether Phase 10 should show pending records to the owner after manual creation.
- Decide whether claim flow requires admin approval, Instagram ownership proof, or both.
- Decide whether record privacy should be a per-user preference, per-record preference, or delayed until public profiles.
- Decide whether records need detail pages, filters, yearly grouping, or advanced analytics after the MVP records tab ships.
