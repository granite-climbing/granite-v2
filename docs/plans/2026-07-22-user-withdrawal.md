# 회원 탈퇴 및 복구 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 마이페이지에서 회원 탈퇴를 신청하고, 6개월 이내 재로그인 시 계정을 복구할 수 있게 한다.

**Architecture:** `users.withdraw_at`에 탈퇴 신청 시각을 기록한다. 로그인 조회는 탈퇴 계정도 찾아내되 세션을 발급하지 않고, 6개월 이내면 `/recover`로 보내 복구 여부를 묻고, 6개월이 지났으면 그 자리에서 OAuth identity를 끊어(lazy purge) 신규 가입으로 흘려보낸다. 웹 OAuth 콜백과 네이티브 세션 라우트가 같은 분기를 쓰도록 `resolveOAuthLogin` 하나로 모은다.

**Tech Stack:** Next.js App Router (Server Actions), TypeScript strict, Cloudflare D1 (HTTP API), jose (JWT), vitest

**설계 문서:** [docs/specs/2026-07-22-user-withdrawal-design.md](../specs/2026-07-22-user-withdrawal-design.md)

---

## 설계 문서와 달라진 점

구현 중 확정한 두 가지. 설계 문서의 의도는 그대로다.

1. **`markUserWithdrawn` / `restoreWithdrawnUser` / `purgeExpiredWithdrawnUser`는 `now` 인자를 받지 않는다.** 기존 `updateUserPrivacyVisibility`와 동일하게 SQL의 `CURRENT_TIMESTAMP`를 쓴다. 앱 서버와 DB 사이 시계 차이가 끼어들 여지가 없고 기존 코드와 일관된다.
2. **복구 토큰에 `typ: "recovery"` 클레임을 넣고, 양쪽에서 검증한다.** 세션 토큰과 복구 토큰이 같은 시크릿·같은 `user_id` 클레임을 쓰기 때문에, 구분자가 없으면 복구 토큰을 세션 쿠키 자리에 넣어 복구 확인을 건너뛰고 탈퇴 상태 그대로 앱을 쓸 수 있다. `verifyPendingRecoveryToken`은 `typ === "recovery"`를 요구하고, `verifyUserSessionToken`은 `typ`가 붙은 토큰을 거부한다. 기존 세션 토큰에는 `typ`가 없으므로 후자는 하위 호환된다.

   초안에서는 recovery 쪽 검사만으로 양방향이 막힌다고 적었는데 사실이 아니었다. `verifyUserSessionToken`은 `user_id`가 문자열인지만 보므로 복구 토큰을 그대로 세션으로 인정했다. Task 3에서 session 쪽 검사를 추가해 닫았다.

---

## File Structure

**생성:**

| 파일 | 책임 |
|---|---|
| `migrations/0016_user_withdrawal.sql` | `withdraw_at` 컬럼 + 부분 인덱스 |
| `lib/auth/withdrawal.ts` | 탈퇴 상태 판정. DB·프레임워크 의존성 없는 순수 모듈 |
| `lib/auth/recovery.ts` | 복구 확인용 단기 쿠키 토큰 발급·검증 |
| `lib/auth/login-resolution.ts` | OAuth 프로필 → `session` / `recover` / `signup` 분기 |
| `lib/actions/withdraw.ts` | 탈퇴 Server Action |
| `lib/actions/recover.ts` | 복구·복구취소 Server Action |
| `app/(site)/me/withdraw-button.tsx` | 탈퇴 버튼 + 확인 모달 (클라이언트) |
| `app/(site)/recover/page.tsx` | 복구 확인 화면 (서버 컴포넌트) |

**수정:**

| 파일 | 변경 |
|---|---|
| `lib/db/schema.ts` | `User`에 `withdrawAt` |
| `lib/db/user-auth-queries.ts` | 컬럼 목록 DRY화, 조회 함수 2개 추가, 변경 함수 3개 추가, `findActiveUserById` 필터 |
| `app/api/auth/callback/[provider]/route.ts` | `resolveOAuthLogin` 사용 |
| `app/api/auth/native/session/route.ts` | `resolveOAuthLogin` 사용 |
| `app/(site)/me/me-page-content.tsx` | `withdrawSlot` prop |
| `app/(site)/me/page.tsx` | `WithdrawButton` 주입 |
| `app/(site)/login/page.tsx` | `withdrawn` / `recovery_*` 안내 문구 |
| `docs/DATA_MODEL.md` | 상태 모델 문서화 |

의존 방향은 `lib/auth/withdrawal.ts`(순수) ← `lib/auth/login-resolution.ts` ← 라우트 순이다. `withdrawal.ts`는 어떤 것도 import하지 않으므로 단독으로 테스트된다.

---

### Task 1: 마이그레이션과 타입

**Files:**
- Create: `migrations/0016_user_withdrawal.sql`
- Modify: `lib/db/schema.ts` (`User` 타입)

이 태스크는 동작을 바꾸지 않는다. 컬럼과 타입만 추가한다.

- [ ] **Step 1: 마이그레이션 파일 작성**

`migrations/0016_user_withdrawal.sql`:

```sql
-- 회원 탈퇴 신청 시각. NULL 이면 정상 계정.
-- 값이 있으면 탈퇴 유예 상태이며, 6개월이 지나면 만료로 판정한다
-- (lib/auth/withdrawal.ts). 실제 삭제 시각은 기존 deleted_at 에 기록한다.
ALTER TABLE users ADD COLUMN withdraw_at TEXT;

CREATE INDEX IF NOT EXISTS idx_users_withdraw_at
  ON users (withdraw_at) WHERE withdraw_at IS NOT NULL;
```

- [ ] **Step 2: 로컬 D1에 적용해서 SQL이 유효한지 확인**

Run: `pnpm wrangler d1 migrations apply granite --local`
Expected: `0016_user_withdrawal.sql` 가 적용 목록에 뜨고 오류 없이 끝난다.

- [ ] **Step 3: `User` 타입에 `withdrawAt` 추가**

`lib/db/schema.ts`의 `User` 타입에서 `onboardingCompletedAt` 다음 줄에 추가한다:

```ts
  onboardingCompletedAt: string | null;
  withdrawAt: string | null;
  deletedAt: string | null;
```

- [ ] **Step 4: 타입 체크**

Run: `pnpm typecheck`
Expected: `lib/db/user-auth-queries.ts`에서 `User` 객체 리터럴에 `withdrawAt`이 없다는 오류가 뜬다. 다음 스텝에서 고친다.

- [ ] **Step 5: `user-auth-queries.ts`의 객체 리터럴 보정**

`ensureUserForOAuthProfile`과 `createUserForCompletedSignup` 안의 `const user: User = { ... }` 두 곳에서 `onboardingCompletedAt` 다음 줄에 추가한다:

```ts
    withdrawAt: null,
```

`UserSqlRow` 타입에도 같은 위치에 추가한다:

```ts
  onboardingCompletedAt: string | null;
  withdrawAt: string | null;
  deletedAt: string | null;
```

- [ ] **Step 6: 타입 체크와 테스트**

Run: `pnpm typecheck && pnpm test`
Expected: 둘 다 통과. (SELECT 목록에 `withdraw_at`을 아직 안 넣었으므로 런타임에는 `undefined`가 들어오지만 Task 4에서 채운다. 기존 테스트는 영향받지 않는다.)

- [ ] **Step 7: 커밋**

```bash
git add migrations/0016_user_withdrawal.sql lib/db/schema.ts lib/db/user-auth-queries.ts
git commit -m "feat(auth): add users.withdraw_at column and type"
```

---

### Task 2: 탈퇴 상태 판정 모듈

**Files:**
- Create: `lib/auth/withdrawal.ts`
- Test: `lib/auth/withdrawal.test.ts`

D1은 타임스탬프를 두 형식으로 저장한다. `datetime('now')` 기본값은 `"2026-07-22 03:04:05"` (UTC, 존 표시 없음), 애플리케이션 INSERT는 `toISOString()`이라 `"2026-07-22T03:04:05.000Z"`다. 존 표시가 없는 문자열을 `new Date()`에 그대로 넣으면 **로컬 시간**으로 해석되어 KST 환경에서 9시간이 어긋난다. 그래서 파싱을 직접 한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/auth/withdrawal.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  getScheduledDeletionAt,
  getWithdrawalStatus,
  WITHDRAWAL_RETENTION_MONTHS
} from "./withdrawal";

// 탈퇴 신청: 2026-01-22T00:00:00Z → 삭제 예정: 2026-07-22T00:00:00Z
const WITHDRAW_AT_ISO = "2026-01-22T00:00:00.000Z";

describe("getWithdrawalStatus", () => {
  it("보관 기간은 6개월이다", () => {
    expect(WITHDRAWAL_RETENTION_MONTHS).toBe(6);
  });

  it("withdraw_at 이 null 이면 active", () => {
    expect(getWithdrawalStatus(null, new Date("2026-07-22T00:00:00.000Z"))).toBe("active");
  });

  it("6개월 되기 1초 전이면 recoverable", () => {
    expect(getWithdrawalStatus(WITHDRAW_AT_ISO, new Date("2026-07-21T23:59:59.000Z"))).toBe(
      "recoverable"
    );
  });

  it("정확히 6개월이 되는 순간 expired", () => {
    expect(getWithdrawalStatus(WITHDRAW_AT_ISO, new Date("2026-07-22T00:00:00.000Z"))).toBe(
      "expired"
    );
  });

  it("6개월 하루 뒤면 expired", () => {
    expect(getWithdrawalStatus(WITHDRAW_AT_ISO, new Date("2026-07-23T00:00:00.000Z"))).toBe(
      "expired"
    );
  });

  it("SQLite datetime('now') 형식을 UTC 로 해석한다", () => {
    // 존 표시가 없다고 로컬 시간으로 읽으면 KST 환경에서 9시간 어긋난다.
    expect(getWithdrawalStatus("2026-01-22 00:00:00", new Date("2026-07-21T23:59:59.000Z"))).toBe(
      "recoverable"
    );
    expect(getWithdrawalStatus("2026-01-22 00:00:00", new Date("2026-07-22T00:00:01.000Z"))).toBe(
      "expired"
    );
  });

  it("파싱할 수 없는 값이면 던진다", () => {
    expect(() => getWithdrawalStatus("not-a-date", new Date("2026-07-22T00:00:00.000Z"))).toThrow(
      /Unparseable withdraw_at/
    );
  });
});

describe("getScheduledDeletionAt", () => {
  it("탈퇴 신청일에 6개월을 더한다", () => {
    expect(getScheduledDeletionAt(WITHDRAW_AT_ISO).toISOString()).toBe("2026-07-22T00:00:00.000Z");
  });

  it("SQLite 형식도 같은 결과를 낸다", () => {
    expect(getScheduledDeletionAt("2026-01-22 00:00:00").toISOString()).toBe(
      "2026-07-22T00:00:00.000Z"
    );
  });

  it("월말 오버플로는 뒤로 밀린다 (8/31 + 6개월 → 3/3)", () => {
    // 항상 늦어지는 방향이라 데이터가 예정보다 일찍 삭제되지는 않는다.
    expect(getScheduledDeletionAt("2026-08-31T00:00:00.000Z").toISOString()).toBe(
      "2027-03-03T00:00:00.000Z"
    );
  });

  it("파싱할 수 없는 값이면 던진다", () => {
    expect(() => getScheduledDeletionAt("not-a-date")).toThrow(/Unparseable withdraw_at/);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test lib/auth/withdrawal.test.ts`
Expected: FAIL — `Failed to resolve import "./withdrawal"`

- [ ] **Step 3: 구현**

`lib/auth/withdrawal.ts`:

```ts
export const WITHDRAWAL_RETENTION_MONTHS = 6;

export type WithdrawalStatus = "active" | "recoverable" | "expired";

const HAS_TIMEZONE = /([zZ]|[+-]\d{2}:?\d{2})$/;

/**
 * D1 은 타임스탬프를 두 형식으로 저장한다.
 *   - `datetime('now')` 기본값: "2026-07-22 03:04:05" (UTC, 존 표시 없음)
 *   - 애플리케이션 INSERT: "2026-07-22T03:04:05.000Z"
 * 존 표시가 없는 쪽을 그대로 `new Date()` 에 넘기면 로컬 시간으로 해석되므로
 * UTC 임을 명시해서 파싱한다.
 *
 * 파싱에 실패하면 던진다. "expired" 로 떨어뜨리면 읽지도 못한 값 때문에
 * lazy purge 가 OAuth identity 를 지운다.
 */
function parseTimestamp(value: string): Date {
  const isoish = value.replace(" ", "T");
  const parsed = new Date(HAS_TIMEZONE.test(isoish) ? isoish : `${isoish}Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Unparseable withdraw_at timestamp: ${value}`);
  }

  return parsed;
}

/**
 * 탈퇴 신청 시각으로부터 데이터가 삭제될 시각.
 * 월말 보정은 JS Date 의 기본 동작을 따른다 (8/31 + 6개월 → 3/3).
 * 항상 늦어지는 방향이라 예정보다 일찍 삭제되지 않으므로 별도 처리하지 않는다.
 * `withdrawAt` 을 파싱할 수 없으면 던진다.
 */
export function getScheduledDeletionAt(withdrawAt: string): Date {
  const deletionAt = parseTimestamp(withdrawAt);
  deletionAt.setUTCMonth(deletionAt.getUTCMonth() + WITHDRAWAL_RETENTION_MONTHS);
  return deletionAt;
}

export function getWithdrawalStatus(withdrawAt: string | null, now: Date): WithdrawalStatus {
  if (!withdrawAt) {
    return "active";
  }

  const deletionAt = getScheduledDeletionAt(withdrawAt);
  return now.getTime() < deletionAt.getTime() ? "recoverable" : "expired";
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test lib/auth/withdrawal.test.ts`
Expected: PASS — 11 passed

- [ ] **Step 5: 커밋**

```bash
git add lib/auth/withdrawal.ts lib/auth/withdrawal.test.ts
git commit -m "feat(auth): add withdrawal retention status helper"
```

---

### Task 3: 복구 토큰

**Files:**
- Create: `lib/auth/recovery.ts`
- Test: `lib/auth/recovery.test.ts`

`lib/auth/signup.ts`의 pending signup 토큰을 그대로 따르되, 세션 토큰과 구분되도록 `typ` 클레임을 넣는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/auth/recovery.test.ts`:

```ts
import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { createUserSessionToken, getUserSessionSecret } from "./session";
import {
  createPendingRecoveryToken,
  getPendingRecoveryCookieOptions,
  PENDING_RECOVERY_COOKIE_NAME,
  verifyPendingRecoveryToken
} from "./recovery";

describe("pending recovery token", () => {
  it("발급한 토큰을 되읽는다", async () => {
    const token = await createPendingRecoveryToken({ userId: "user_1", returnTo: "/me/records" });

    expect(await verifyPendingRecoveryToken(token)).toEqual({
      userId: "user_1",
      returnTo: "/me/records"
    });
  });

  it("외부 절대 URL 인 returnTo 는 /me 로 떨어뜨린다", async () => {
    const token = await createPendingRecoveryToken({
      userId: "user_1",
      returnTo: "//evil.example.com"
    });

    expect(await verifyPendingRecoveryToken(token)).toEqual({ userId: "user_1", returnTo: "/me" });
  });

  it("변조된 토큰은 null", async () => {
    const token = await createPendingRecoveryToken({ userId: "user_1", returnTo: "/me" });

    expect(await verifyPendingRecoveryToken(`${token}x`)).toBeNull();
  });

  it("만료된 토큰은 null", async () => {
    const expired = await new SignJWT({ typ: "recovery", user_id: "user_1", return_to: "/me" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(0)
      .setExpirationTime(1)
      .sign(getUserSessionSecret());

    expect(await verifyPendingRecoveryToken(expired)).toBeNull();
  });

  it("세션 토큰을 복구 토큰으로 재사용할 수 없다", async () => {
    // 두 토큰은 같은 시크릿과 같은 user_id 클레임을 쓴다. typ 검사가 없으면
    // 서로 바꿔치기할 수 있어서 복구 확인 화면을 건너뛰게 된다.
    const sessionToken = await createUserSessionToken({ userId: "user_1" });

    expect(await verifyPendingRecoveryToken(sessionToken)).toBeNull();
  });

  it("쿠키 설정은 15분 HttpOnly lax", () => {
    expect(PENDING_RECOVERY_COOKIE_NAME).toBe("granite_pending_recovery");
    expect(getPendingRecoveryCookieOptions()).toEqual({
      httpOnly: true,
      maxAge: 60 * 15,
      path: "/",
      sameSite: "lax",
      secure: false
    });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test lib/auth/recovery.test.ts`
Expected: FAIL — `Failed to resolve import "./recovery"`

- [ ] **Step 3: 구현**

`lib/auth/recovery.ts`:

```ts
import { SignJWT, jwtVerify } from "jose";
import { getUserSessionSecret } from "./session";

export const PENDING_RECOVERY_COOKIE_NAME = "granite_pending_recovery";

/**
 * 세션 토큰과 같은 시크릿·같은 user_id 클레임을 쓰기 때문에, 이 값으로 토큰
 * 종류를 구분하지 않으면 두 토큰을 서로 바꿔치기할 수 있다. 반대 방향은
 * `verifyUserSessionToken` 이 typ 가 붙은 토큰을 거부해서 막는다.
 */
const RECOVERY_TOKEN_TYPE = "recovery";

export type PendingRecovery = {
  userId: string;
  returnTo: string;
};

export async function createPendingRecoveryToken(recovery: PendingRecovery): Promise<string> {
  return new SignJWT({
    typ: RECOVERY_TOKEN_TYPE,
    user_id: recovery.userId,
    return_to: sanitizeReturnTo(recovery.returnTo)
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getUserSessionSecret());
}

export async function verifyPendingRecoveryToken(token: string): Promise<PendingRecovery | null> {
  try {
    const verified = await jwtVerify(token, getUserSessionSecret());
    const userId = verified.payload.user_id;
    const returnTo = verified.payload.return_to;

    if (verified.payload.typ !== RECOVERY_TOKEN_TYPE || typeof userId !== "string") {
      return null;
    }

    return {
      userId,
      returnTo: typeof returnTo === "string" ? sanitizeReturnTo(returnTo) : "/me"
    };
  } catch {
    return null;
  }
}

export function getPendingRecoveryCookieOptions() {
  return {
    httpOnly: true,
    maxAge: 60 * 15,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };
}

function sanitizeReturnTo(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/me";
  }

  return value;
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test lib/auth/recovery.test.ts`
Expected: PASS — 6 passed

- [ ] **Step 5: 커밋**

```bash
git add lib/auth/recovery.ts lib/auth/recovery.test.ts
git commit -m "feat(auth): add pending recovery token"
```

---

### Task 4: 쿼리 계층

**Files:**
- Modify: `lib/db/user-auth-queries.ts`
- Test: `lib/db/user-auth-queries.test.ts`

컬럼 목록이 이미 세 곳에 복사돼 있고, 그중 `findUserByOAuthIdentity`만 `privacy_visibility`가 빠져 있다. 컬럼이 하나 더 늘어나기 전에 헬퍼로 모은다.

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/db/user-auth-queries.test.ts` 상단 import를 아래로 교체한다:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureUserForOAuthProfile,
  findActiveUserById,
  findLoginCandidateByOAuthIdentity,
  findOAuthIdentitiesByUserId,
  findWithdrawnUserById,
  markUserWithdrawn,
  purgeExpiredWithdrawnUser,
  restoreWithdrawnUser
} from "./user-auth-queries";
```

`vi.mock("./d1-http", ...)` 블록에 `executeD1Meta`를 추가한다:

```ts
const queryD1Mock = vi.hoisted(() => vi.fn());
const queryD1FirstMock = vi.hoisted(() => vi.fn());
const executeD1Mock = vi.hoisted(() => vi.fn());
const executeD1MetaMock = vi.hoisted(() => vi.fn());
const randomUUIDMock = vi.hoisted(() => vi.fn());

vi.mock("./d1-http", () => ({
  queryD1: queryD1Mock,
  queryD1First: queryD1FirstMock,
  executeD1: executeD1Mock,
  executeD1Meta: executeD1MetaMock
}));
```

`beforeEach` 안에 리셋을 추가한다:

```ts
    executeD1MetaMock.mockReset();
```

파일 안에서 `findUserByOAuthIdentity(` 를 호출하는 기존 테스트(74행 부근)를 `findLoginCandidateByOAuthIdentity(` 로 바꾼다.

파일 맨 아래 `describe` 블록 안에 아래 테스트를 추가한다:

```ts
  it("활성 사용자 조회는 탈퇴 유예 계정을 제외한다", async () => {
    queryD1FirstMock.mockResolvedValueOnce(null);

    await findActiveUserById("user_1");

    expect(queryD1FirstMock).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = ? AND deleted_at IS NULL AND withdraw_at IS NULL"),
      ["user_1"]
    );
  });

  it("로그인 후보 조회는 탈퇴 계정도 찾아낸다", async () => {
    queryD1FirstMock.mockResolvedValueOnce({
      id: "user_1",
      displayName: "granite",
      withdrawAt: "2026-07-01 00:00:00",
      deletedAt: null
    });

    const user = await findLoginCandidateByOAuthIdentity("google", "google-user");

    const [sql] = queryD1FirstMock.mock.calls[0];
    expect(sql).toContain("u.deleted_at IS NULL");
    expect(sql).not.toContain("withdraw_at IS NULL");
    expect(sql).toContain("u.withdraw_at AS withdrawAt");
    expect(user?.withdrawAt).toBe("2026-07-01 00:00:00");
  });

  it("복구 대상 조회는 탈퇴 신청된 계정만 찾는다", async () => {
    queryD1FirstMock.mockResolvedValueOnce(null);

    await findWithdrawnUserById("user_1");

    expect(queryD1FirstMock).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = ? AND deleted_at IS NULL AND withdraw_at IS NOT NULL"),
      ["user_1"]
    );
  });

  it("탈퇴 처리는 정상 계정만 대상으로 하고 변경 여부를 돌려준다", async () => {
    executeD1MetaMock.mockResolvedValueOnce({ changes: 1 });

    await expect(markUserWithdrawn("user_1")).resolves.toBe(true);

    const [sql, params] = executeD1MetaMock.mock.calls[0];
    expect(sql).toContain("SET withdraw_at = CURRENT_TIMESTAMP");
    expect(sql).toContain("WHERE id = ? AND withdraw_at IS NULL AND deleted_at IS NULL");
    expect(params).toEqual(["user_1"]);
  });

  it("이미 탈퇴한 계정을 다시 탈퇴 처리하면 false", async () => {
    executeD1MetaMock.mockResolvedValueOnce({ changes: 0 });

    await expect(markUserWithdrawn("user_1")).resolves.toBe(false);
  });

  it("복구는 탈퇴 유예 계정만 대상으로 한다", async () => {
    executeD1MetaMock.mockResolvedValueOnce({ changes: 1 });

    await expect(restoreWithdrawnUser("user_1")).resolves.toBe(true);

    const [sql, params] = executeD1MetaMock.mock.calls[0];
    expect(sql).toContain("SET withdraw_at = NULL");
    expect(sql).toContain("WHERE id = ? AND withdraw_at IS NOT NULL AND deleted_at IS NULL");
    expect(params).toEqual(["user_1"]);
  });

  it("경합으로 복구 대상이 사라지면 false", async () => {
    executeD1MetaMock.mockResolvedValueOnce({ changes: 0 });

    await expect(restoreWithdrawnUser("user_1")).resolves.toBe(false);
  });

  it("만료 계정은 deleted_at 을 찍고 OAuth identity 를 끊는다", async () => {
    executeD1MetaMock.mockResolvedValueOnce({ changes: 1 });

    await purgeExpiredWithdrawnUser("user_1");

    const [updateSql, updateParams] = executeD1MetaMock.mock.calls[0];
    expect(updateSql).toContain("SET deleted_at = CURRENT_TIMESTAMP");
    expect(updateParams).toEqual(["user_1"]);
    expect(executeD1Mock).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM user_oauth_identities WHERE user_id = ?"),
      ["user_1"]
    );
  });

  it("이미 삭제된 계정이면 identity 삭제를 건너뛴다", async () => {
    executeD1MetaMock.mockResolvedValueOnce({ changes: 0 });

    await purgeExpiredWithdrawnUser("user_1");

    expect(executeD1Mock).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test lib/db/user-auth-queries.test.ts`
Expected: FAIL — `findLoginCandidateByOAuthIdentity is not a function` 등

- [ ] **Step 3: 컬럼 헬퍼 도입**

`lib/db/user-auth-queries.ts`의 import에 `executeD1Meta`를 추가한다:

```ts
import { executeD1, executeD1Meta, queryD1, queryD1First } from "./d1-http";
```

`mapUser` 함수 바로 위에 헬퍼를 추가한다:

```ts
/**
 * users 조회 컬럼 목록. 세 군데에서 쓰던 것을 모았다.
 * alias 가 있으면 JOIN 쿼리용으로 접두사를 붙인다.
 */
function userColumns(alias?: string): string {
  const p = alias ? `${alias}.` : "";
  return `${p}id,
       ${p}display_name AS displayName,
       ${p}email,
       ${p}avatar_url AS avatarUrl,
       ${p}instagram_id AS instagramId,
       ${p}youtube_id AS youtubeId,
       ${p}gender,
       ${p}height_cm AS heightCm,
       ${p}ape_index_cm AS apeIndexCm,
       ${p}weight_kg AS weightKg,
       ${p}top_bouldering_grade AS topBoulderingGrade,
       ${p}top_sport_grade AS topSportGrade,
       ${p}privacy_visibility AS privacyVisibility,
       ${p}onboarding_completed_at AS onboardingCompletedAt,
       ${p}withdraw_at AS withdrawAt,
       ${p}deleted_at AS deletedAt,
       ${p}created_at AS createdAt,
       ${p}updated_at AS updatedAt`;
}
```

- [ ] **Step 4: 조회 함수 교체**

`findActiveUserById` 전체를 아래로 교체한다:

```ts
export async function findActiveUserById(id: string): Promise<User | null> {
  const row = await queryD1First<UserSqlRow>(
    `SELECT
       ${userColumns()}
     FROM users
     WHERE id = ? AND deleted_at IS NULL AND withdraw_at IS NULL
     LIMIT 1`,
    [id]
  );

  return mapUser(row);
}

/**
 * 탈퇴 유예 중인 계정만 찾는다. 복구 확인 화면과 복구 액션이
 * 세션 없이 사용자를 확인할 때 쓴다.
 */
export async function findWithdrawnUserById(id: string): Promise<User | null> {
  const row = await queryD1First<UserSqlRow>(
    `SELECT
       ${userColumns()}
     FROM users
     WHERE id = ? AND deleted_at IS NULL AND withdraw_at IS NOT NULL
     LIMIT 1`,
    [id]
  );

  return mapUser(row);
}
```

`findUserByOAuthIdentity` 전체를 아래로 교체한다 (이름이 바뀐다):

```ts
/**
 * 로그인 시도에 쓰는 조회. 탈퇴 유예 중인 계정도 돌려준다.
 * 세션을 줄지 복구를 제안할지는 lib/auth/login-resolution.ts 가 판단한다.
 */
export async function findLoginCandidateByOAuthIdentity(
  provider: OAuthProviderId,
  providerUid: string
): Promise<User | null> {
  const row = await queryD1First<UserSqlRow>(
    `SELECT
       ${userColumns("u")}
     FROM users u
     JOIN user_oauth_identities i ON i.user_id = u.id
     WHERE i.provider = ?
       AND i.provider_uid = ?
       AND u.deleted_at IS NULL
     LIMIT 1`,
    [provider, providerUid]
  );

  return mapUser(row);
}
```

`ensureUserForOAuthProfile`과 `createUserForCompletedSignup` 안의 `findUserByOAuthIdentity(` 호출 4곳을 모두 `findLoginCandidateByOAuthIdentity(` 로 바꾼다. (각 함수의 앞부분 중복 확인 1곳 + `catch` 안의 race 확인 1곳, 총 4곳.) 활성 계정만 조회하면 탈퇴 계정의 identity 행을 못 보고 INSERT 해서 `UNIQUE (provider, provider_uid)` 위반이 난다.

- [ ] **Step 5: 변경 함수 추가**

파일 맨 아래에 추가한다:

```ts
/**
 * 탈퇴 신청. 이미 탈퇴했거나 삭제된 계정이면 아무것도 바꾸지 않고 false.
 */
export async function markUserWithdrawn(userId: string): Promise<boolean> {
  const { changes } = await executeD1Meta(
    `UPDATE users
        SET withdraw_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND withdraw_at IS NULL AND deleted_at IS NULL`,
    [userId]
  );

  return changes > 0;
}

/**
 * 탈퇴 취소. 유예 중이 아닌 계정이면 false.
 * 6개월 경과 여부는 호출 측에서 판단한다 (lib/auth/withdrawal.ts).
 */
export async function restoreWithdrawnUser(userId: string): Promise<boolean> {
  const { changes } = await executeD1Meta(
    `UPDATE users
        SET withdraw_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND withdraw_at IS NOT NULL AND deleted_at IS NULL`,
    [userId]
  );

  return changes > 0;
}

/**
 * 보관 기간이 지난 계정을 로그인 시점에 정리한다.
 * 개인정보 익명화는 하지 않는다. OAuth identity 를 끊어서 같은 소셜 계정으로
 * 새로 가입할 수 있게 하는 것이 목적이다.
 */
export async function purgeExpiredWithdrawnUser(userId: string): Promise<void> {
  const { changes } = await executeD1Meta(
    `UPDATE users
        SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL`,
    [userId]
  );

  if (changes === 0) {
    // 다른 요청이 먼저 정리했다. identity 도 이미 지워졌다.
    return;
  }

  await executeD1(`DELETE FROM user_oauth_identities WHERE user_id = ?`, [userId]);
}
```

- [ ] **Step 6: 통과 확인**

Run: `pnpm test lib/db/user-auth-queries.test.ts`
Expected: PASS

- [ ] **Step 7: 타입 체크로 나머지 호출부 확인**

Run: `pnpm typecheck`
Expected: FAIL — `app/api/auth/callback/[provider]/route.ts`와 `app/api/auth/native/session/route.ts`에서 `findUserByOAuthIdentity` 를 찾을 수 없다는 오류. Task 6·7에서 고친다. 여기서는 오류 위치가 그 두 파일뿐인지만 확인한다.

- [ ] **Step 8: 커밋**

```bash
git add lib/db/user-auth-queries.ts lib/db/user-auth-queries.test.ts
git commit -m "feat(auth): add withdrawal queries and dedupe user column list"
```

---

### Task 5: 로그인 분기 통합

**Files:**
- Create: `lib/auth/login-resolution.ts`
- Test: `lib/auth/login-resolution.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/auth/login-resolution.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/lib/db/schema";
import type { OAuthProfile } from "./oauth/types";
import { resolveOAuthLogin } from "./login-resolution";

const findLoginCandidateMock = vi.hoisted(() => vi.fn());
const purgeExpiredMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/user-auth-queries", () => ({
  findLoginCandidateByOAuthIdentity: findLoginCandidateMock,
  purgeExpiredWithdrawnUser: purgeExpiredMock
}));

const profile: OAuthProfile = {
  provider: "google",
  providerUserId: "google-user",
  email: "climber@example.com",
  displayName: "granite",
  avatarUrl: null
};

function makeUser(withdrawAt: string | null): User {
  return {
    id: "user_1",
    displayName: "granite",
    email: "climber@example.com",
    avatarUrl: null,
    instagramId: null,
    youtubeId: null,
    gender: null,
    heightCm: null,
    apeIndexCm: null,
    weightKg: null,
    topBoulderingGrade: null,
    topSportGrade: null,
    privacyVisibility: null,
    onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
    withdrawAt,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

const NOW = new Date("2026-07-22T00:00:00.000Z");

describe("resolveOAuthLogin", () => {
  beforeEach(() => {
    findLoginCandidateMock.mockReset();
    purgeExpiredMock.mockReset();
  });

  it("계정이 없으면 signup", async () => {
    findLoginCandidateMock.mockResolvedValueOnce(null);

    await expect(resolveOAuthLogin(profile, NOW)).resolves.toEqual({ kind: "signup" });
    expect(findLoginCandidateMock).toHaveBeenCalledWith("google", "google-user");
    expect(purgeExpiredMock).not.toHaveBeenCalled();
  });

  it("정상 계정이면 session", async () => {
    const user = makeUser(null);
    findLoginCandidateMock.mockResolvedValueOnce(user);

    await expect(resolveOAuthLogin(profile, NOW)).resolves.toEqual({ kind: "session", user });
    expect(purgeExpiredMock).not.toHaveBeenCalled();
  });

  it("6개월 이내 탈퇴 계정이면 recover", async () => {
    const user = makeUser("2026-07-01T00:00:00.000Z");
    findLoginCandidateMock.mockResolvedValueOnce(user);

    await expect(resolveOAuthLogin(profile, NOW)).resolves.toEqual({ kind: "recover", user });
    expect(purgeExpiredMock).not.toHaveBeenCalled();
  });

  it("6개월이 지난 탈퇴 계정은 정리하고 signup 으로 보낸다", async () => {
    findLoginCandidateMock.mockResolvedValueOnce(makeUser("2026-01-01T00:00:00.000Z"));

    await expect(resolveOAuthLogin(profile, NOW)).resolves.toEqual({ kind: "signup" });
    expect(purgeExpiredMock).toHaveBeenCalledWith("user_1");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test lib/auth/login-resolution.test.ts`
Expected: FAIL — `Failed to resolve import "./login-resolution"`

- [ ] **Step 3: 구현**

`lib/auth/login-resolution.ts`:

```ts
import {
  findLoginCandidateByOAuthIdentity,
  purgeExpiredWithdrawnUser
} from "@/lib/db/user-auth-queries";
import type { User } from "@/lib/db/schema";
import type { OAuthProfile } from "./oauth/types";
import { getWithdrawalStatus } from "./withdrawal";

export type OAuthLoginResolution =
  | { kind: "session"; user: User }
  | { kind: "recover"; user: User }
  | { kind: "signup" };

/**
 * OAuth 프로필 하나로 로그인 결과를 결정한다.
 * 웹 콜백과 네이티브 세션 라우트가 같은 규칙을 쓰도록 여기 모았다.
 * 쿠키 설정과 이동 경로는 각 라우트가 처리한다.
 */
export async function resolveOAuthLogin(
  profile: OAuthProfile,
  now: Date
): Promise<OAuthLoginResolution> {
  const user = await findLoginCandidateByOAuthIdentity(profile.provider, profile.providerUserId);
  if (!user) {
    return { kind: "signup" };
  }

  const status = getWithdrawalStatus(user.withdrawAt, now);
  if (status === "active") {
    return { kind: "session", user };
  }

  if (status === "recoverable") {
    return { kind: "recover", user };
  }

  // 보관 기간이 끝났다. identity 를 끊어 같은 소셜 계정으로 새로 가입하게 한다.
  await purgeExpiredWithdrawnUser(user.id);
  return { kind: "signup" };
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test lib/auth/login-resolution.test.ts`
Expected: PASS — 4 passed

- [ ] **Step 5: 커밋**

```bash
git add lib/auth/login-resolution.ts lib/auth/login-resolution.test.ts
git commit -m "feat(auth): add shared oauth login resolution"
```

---

### Task 6: 웹 OAuth 콜백 연결

**Files:**
- Modify: `app/api/auth/callback/[provider]/route.ts`
- Test: `app/api/auth/callback/[provider]/route.test.ts`

- [ ] **Step 1: 테스트를 새 의존성에 맞춰 고치고 복구 케이스 추가**

`app/api/auth/callback/[provider]/route.test.ts` 상단에서 이 두 줄을

```ts
const findUserByOAuthIdentityMock = vi.hoisted(() => vi.fn());
```

```ts
  findUserByOAuthIdentity: findUserByOAuthIdentityMock
```

아래로 바꾼다. `vi.mock("@/lib/db/user-auth-queries", ...)` 블록 전체를 `@/lib/auth/login-resolution` 목으로 교체하는 것이다:

```ts
const resolveOAuthLoginMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/login-resolution", () => ({
  resolveOAuthLogin: resolveOAuthLoginMock
}));
```

`beforeEach`의 `findUserByOAuthIdentityMock.mockReset();` 를 `resolveOAuthLoginMock.mockReset();` 로 바꾼다.

기존 호출을 아래 규칙으로 치환한다:

- `findUserByOAuthIdentityMock.mockResolvedValueOnce({ id: "user_1", ... })`
  → `resolveOAuthLoginMock.mockResolvedValueOnce({ kind: "session", user: { id: "user_1" } })`
- `findUserByOAuthIdentityMock.mockResolvedValueOnce(null)`
  → `resolveOAuthLoginMock.mockResolvedValueOnce({ kind: "signup" })`
- `expect(findUserByOAuthIdentityMock).toHaveBeenCalledWith("google", "google-user")`
  → `expect(resolveOAuthLoginMock).toHaveBeenCalledWith(expect.objectContaining({ provider: "google", providerUserId: "google-user" }), expect.any(Date))`
- `expect(findUserByOAuthIdentityMock).not.toHaveBeenCalled()`
  → `expect(resolveOAuthLoginMock).not.toHaveBeenCalled()`

import에 복구 모듈을 추가한다 (`@/lib/auth/recovery`는 목으로 대체하지 않고 실제 구현을 쓴다):

```ts
import { PENDING_RECOVERY_COOKIE_NAME, verifyPendingRecoveryToken } from "@/lib/auth/recovery";
```

그리고 새 테스트를 파일 맨 아래 `describe` 안에 추가한다. 이 파일에 이미 있는 `readCookieValue` 헬퍼를 쓴다:

```ts
  it("탈퇴 유예 계정은 세션 대신 복구 쿠키를 심고 /recover 로 보낸다", async () => {
    process.env.JWT_SECRET = "callback-test-secret";
    process.env.APP_BASE_URL = "https://granite.kr";
    const state = createOAuthState({ provider: "google", returnTo: "/me" });
    exchangeOAuthCodeMock.mockResolvedValueOnce({
      accessToken: "access-token",
      tokenType: "Bearer",
      expiresIn: 3600,
      refreshToken: null,
      idToken: "id-token",
      scope: "openid email profile"
    });
    fetchOAuthProfileMock.mockResolvedValueOnce({
      provider: "google",
      providerUserId: "google-user",
      email: "google@example.com",
      displayName: "Google Climber",
      avatarUrl: null
    });
    resolveOAuthLoginMock.mockResolvedValueOnce({
      kind: "recover",
      user: { id: "user_google" }
    });

    const request = new NextRequest(
      `https://granite.kr/api/auth/callback/google?code=abc&state=${state.state}`,
      {
        headers: {
          cookie: `${OAUTH_STATE_COOKIE_NAME}=${encodeURIComponent(state.cookieValue)}`
        }
      }
    );
    const response = await GET(request, { params: Promise.resolve({ provider: "google" }) });
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://granite.kr/recover");
    expect(readCookieValue(setCookie, USER_SESSION_COOKIE_NAME)).toBeNull();

    const recoveryToken = readCookieValue(setCookie, PENDING_RECOVERY_COOKIE_NAME);
    await expect(verifyPendingRecoveryToken(recoveryToken ?? "")).resolves.toEqual({
      userId: "user_google",
      returnTo: "/me"
    });
  });
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test "app/api/auth/callback/[provider]/route.test.ts"`
Expected: FAIL — 라우트가 아직 `resolveOAuthLogin`을 쓰지 않아 목이 호출되지 않는다.

- [ ] **Step 3: 라우트 수정**

import에서 `findUserByOAuthIdentity` 줄을 지우고 아래 두 줄을 넣는다:

```ts
import { resolveOAuthLogin } from "@/lib/auth/login-resolution";
import {
  createPendingRecoveryToken,
  getPendingRecoveryCookieOptions,
  PENDING_RECOVERY_COOKIE_NAME
} from "@/lib/auth/recovery";
```

`handleOAuthCallback` 마지막 `try` 블록 전체를 아래로 교체한다:

```ts
  try {
    const resolution = await resolveOAuthLogin(profile, new Date());

    if (resolution.kind === "signup") {
      const pendingSignupToken = await createPendingSignupToken({
        provider: profile.provider,
        providerUserId: profile.providerUserId,
        email: profile.email,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        returnTo: state.returnTo
      });
      const response = NextResponse.redirect(new URL("/signup", request.url));
      response.cookies.set(PENDING_SIGNUP_COOKIE_NAME, pendingSignupToken, getPendingSignupCookieOptions());
      response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
      return response;
    }

    if (resolution.kind === "recover") {
      const pendingRecoveryToken = await createPendingRecoveryToken({
        userId: resolution.user.id,
        returnTo: state.returnTo
      });
      const response = NextResponse.redirect(new URL("/recover", request.url));
      response.cookies.set(
        PENDING_RECOVERY_COOKIE_NAME,
        pendingRecoveryToken,
        getPendingRecoveryCookieOptions()
      );
      response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
      return response;
    }

    const sessionToken = await createUserSessionToken({
      userId: resolution.user.id
    });
    const response = NextResponse.redirect(new URL(state.returnTo, request.url));
    setSessionCookies(response, sessionToken);
    return response;
  } catch (error) {
    logOAuthCallbackError(providerValue, "callback_failed", error);
    return redirectToLogin(request, "callback_failed");
  }
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test "app/api/auth/callback/[provider]/route.test.ts"`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add "app/api/auth/callback/[provider]/route.ts" "app/api/auth/callback/[provider]/route.test.ts"
git commit -m "feat(auth): route withdrawn accounts to recovery on web callback"
```

---

### Task 7: 네이티브 세션 라우트 연결

**Files:**
- Modify: `app/api/auth/native/session/route.ts`
- Test: `app/api/auth/native/session/route.test.ts`

- [ ] **Step 1: 테스트를 새 의존성에 맞춰 고치고 복구 케이스 추가**

`app/api/auth/native/session/route.test.ts`에서 Task 6 Step 1과 동일한 치환을 한다 (`findUserByOAuthIdentityMock` → `resolveOAuthLoginMock`, `@/lib/db/user-auth-queries` 목 → `@/lib/auth/login-resolution` 목). 이 파일의 기존 단정은 `expect(findUserByOAuthIdentityMock).toHaveBeenCalledWith("apple", "apple-user")` 하나이므로 아래로 바꾼다:

```ts
    expect(resolveOAuthLoginMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "apple", providerUserId: "apple-user" }),
      expect.any(Date)
    );
```

import에 복구 모듈을 추가한다:

```ts
import { PENDING_RECOVERY_COOKIE_NAME, verifyPendingRecoveryToken } from "@/lib/auth/recovery";
```

새 테스트를 추가한다. 이 파일에 이미 있는 `formRequest` / `readCookieValue` 헬퍼를 쓴다:

```ts
  it("탈퇴 유예 계정은 복구 쿠키를 심고 /recover 로 이동시킨다", async () => {
    process.env.JWT_SECRET = "native-session-test-secret";
    fetchOAuthProfileMock.mockResolvedValueOnce({
      provider: "apple",
      providerUserId: "apple-user",
      email: null,
      displayName: "Apple Climber",
      avatarUrl: null
    });
    resolveOAuthLoginMock.mockResolvedValueOnce({
      kind: "recover",
      user: { id: "user_apple" }
    });

    const response = await POST(
      formRequest({ provider: "apple", idToken: "apple-id-token", returnTo: "/me" })
    );
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("location.replace(\"/recover\")");
    expect(readCookieValue(setCookie, USER_SESSION_COOKIE_NAME)).toBeNull();

    const recoveryToken = readCookieValue(setCookie, PENDING_RECOVERY_COOKIE_NAME);
    await expect(verifyPendingRecoveryToken(recoveryToken ?? "")).resolves.toEqual({
      userId: "user_apple",
      returnTo: "/me"
    });
  });
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test app/api/auth/native/session/route.test.ts`
Expected: FAIL

- [ ] **Step 3: 라우트 수정**

import에서 `findUserByOAuthIdentity` 줄을 지우고 추가한다:

```ts
import { resolveOAuthLogin } from "@/lib/auth/login-resolution";
import {
  createPendingRecoveryToken,
  getPendingRecoveryCookieOptions,
  PENDING_RECOVERY_COOKIE_NAME
} from "@/lib/auth/recovery";
```

`POST` 안의 마지막 `try` 블록 전체를 아래로 교체한다:

```ts
  try {
    const resolution = await resolveOAuthLogin(profile, new Date());

    if (resolution.kind === "signup") {
      const pendingSignupToken = await createPendingSignupToken({
        provider: profile.provider,
        providerUserId: profile.providerUserId,
        email: profile.email,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        returnTo
      });
      const response = createNativeSessionNavigationResponse("/signup");
      response.cookies.set(PENDING_SIGNUP_COOKIE_NAME, pendingSignupToken, getPendingSignupCookieOptions());
      return response;
    }

    if (resolution.kind === "recover") {
      const pendingRecoveryToken = await createPendingRecoveryToken({
        userId: resolution.user.id,
        returnTo
      });
      const response = createNativeSessionNavigationResponse("/recover");
      response.cookies.set(
        PENDING_RECOVERY_COOKIE_NAME,
        pendingRecoveryToken,
        getPendingRecoveryCookieOptions()
      );
      return response;
    }

    const sessionToken = await createUserSessionToken({
      userId: resolution.user.id
    });
    const response = createNativeSessionNavigationResponse(returnTo);
    response.cookies.set(USER_SESSION_COOKIE_NAME, sessionToken, getUserSessionCookieOptions());
    return response;
  } catch (error) {
    logNativeSessionError(provider, "session_create_failed", error);
    return redirectToLogin(request, "native_session_failed");
  }
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test app/api/auth/native/session/route.test.ts && pnpm typecheck`
Expected: 테스트 PASS, 타입 체크 통과 (Task 4에서 남겨둔 오류가 여기서 해소된다)

- [ ] **Step 5: 커밋**

```bash
git add app/api/auth/native/session/route.ts app/api/auth/native/session/route.test.ts
git commit -m "feat(auth): route withdrawn accounts to recovery on native login"
```

---

### Task 8: 탈퇴 Server Action

**Files:**
- Create: `lib/actions/withdraw.ts`
- Test: `lib/actions/withdraw.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/actions/withdraw.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { USER_SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { withdrawAccountAction } from "./withdraw";

const cookiesMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  })
);
const verifyUserSessionTokenMock = vi.hoisted(() => vi.fn());
const findActiveUserByIdMock = vi.hoisted(() => vi.fn());
const markUserWithdrawnMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/session")>("@/lib/auth/session");
  return { ...actual, verifyUserSessionToken: verifyUserSessionTokenMock };
});
vi.mock("@/lib/db/user-auth-queries", () => ({
  findActiveUserById: findActiveUserByIdMock,
  markUserWithdrawn: markUserWithdrawnMock
}));

function mockCookieStore(token: string | undefined) {
  const set = vi.fn();
  cookiesMock.mockResolvedValue({
    get: vi.fn(() => (token === undefined ? undefined : { value: token })),
    set
  });
  return set;
}

describe("withdrawAccountAction", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    redirectMock.mockClear();
    verifyUserSessionTokenMock.mockReset();
    findActiveUserByIdMock.mockReset();
    markUserWithdrawnMock.mockReset();
  });

  it("탈퇴를 기록하고 세션을 지운 뒤 안내와 함께 로그인으로 보낸다", async () => {
    const set = mockCookieStore("session-token");
    verifyUserSessionTokenMock.mockResolvedValue({ userId: "user_1" });
    findActiveUserByIdMock.mockResolvedValue({ id: "user_1" });
    markUserWithdrawnMock.mockResolvedValue(true);

    await expect(withdrawAccountAction()).rejects.toThrow("NEXT_REDIRECT:/login?withdrawn=1");

    expect(markUserWithdrawnMock).toHaveBeenCalledWith("user_1");
    expect(set).toHaveBeenCalledWith(
      USER_SESSION_COOKIE_NAME,
      "",
      expect.objectContaining({ maxAge: 0, path: "/" })
    );
  });

  it("세션이 없으면 아무것도 바꾸지 않고 로그인으로 보낸다", async () => {
    mockCookieStore(undefined);

    await expect(withdrawAccountAction()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(markUserWithdrawnMock).not.toHaveBeenCalled();
  });

  it("이미 탈퇴한 계정이면 조용히 로그아웃만 한다", async () => {
    const set = mockCookieStore("session-token");
    verifyUserSessionTokenMock.mockResolvedValue({ userId: "user_1" });
    findActiveUserByIdMock.mockResolvedValue(null);

    await expect(withdrawAccountAction()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(markUserWithdrawnMock).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(USER_SESSION_COOKIE_NAME, "", expect.objectContaining({ maxAge: 0 }));
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test lib/actions/withdraw.test.ts`
Expected: FAIL — `Failed to resolve import "./withdraw"`

- [ ] **Step 3: 구현**

`lib/actions/withdraw.ts`:

```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getUserSessionCookieOptions,
  USER_SESSION_COOKIE_NAME,
  verifyUserSessionToken
} from "@/lib/auth/session";
import { findActiveUserById, markUserWithdrawn } from "@/lib/db/user-auth-queries";

export async function withdrawAccountAction(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifyUserSessionToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  const user = await findActiveUserById(session.userId);
  if (!user) {
    // 이미 탈퇴했거나 사라진 계정. 세션만 정리한다.
    clearSessionCookie(cookieStore);
    redirect("/login");
  }

  await markUserWithdrawn(user.id);
  clearSessionCookie(cookieStore);
  redirect("/login?withdrawn=1");
}

function clearSessionCookie(cookieStore: Awaited<ReturnType<typeof cookies>>): void {
  cookieStore.set(USER_SESSION_COOKIE_NAME, "", {
    ...getUserSessionCookieOptions(),
    maxAge: 0
  });
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test lib/actions/withdraw.test.ts`
Expected: PASS — 3 passed

- [ ] **Step 5: 커밋**

```bash
git add lib/actions/withdraw.ts lib/actions/withdraw.test.ts
git commit -m "feat(me): add account withdrawal server action"
```

---

### Task 9: 탈퇴 버튼과 확인 모달

**Files:**
- Create: `app/(site)/me/withdraw-button.tsx`
- Modify: `app/(site)/me/me-page-content.tsx`, `app/(site)/me/page.tsx`
- Test: `app/(site)/me/me-page-content.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`app/(site)/me/me-page-content.test.tsx`의 `describe` 블록 안에 추가한다:

```ts
  it("계정 섹션에 탈퇴 슬롯을 렌더한다", () => {
    const html = renderToStaticMarkup(
      <MyPageContent
        model={model}
        logoutSlot={<button type="button">로그아웃</button>}
        withdrawSlot={<button type="button">회원탈퇴</button>}
      />
    );

    expect(html).toContain("로그아웃");
    expect(html).toContain("회원탈퇴");
  });
```

기존 테스트의 `<MyPageContent model={model} logoutSlot={...} />` 호출에도 `withdrawSlot={<button type="button">회원탈퇴</button>}` 를 추가한다 (필수 prop이므로 없으면 타입 오류).

- [ ] **Step 2: 실패 확인**

Run: `pnpm test "app/(site)/me/me-page-content.test.tsx"`
Expected: FAIL — `withdrawSlot` prop이 없어 타입/렌더 오류

- [ ] **Step 3: `me-page-content.tsx` 수정**

`MyPageContentProps` 타입에 추가한다:

```ts
type MyPageContentProps = {
  model: MePageModel;
  logoutSlot: React.ReactNode;
  withdrawSlot: React.ReactNode;
};
```

함수 시그니처를 바꾼다:

```tsx
export function MyPageContent({ model, logoutSlot, withdrawSlot }: MyPageContentProps) {
```

"계정" 섹션의 회색 `<p>` 를 슬롯으로 교체한다:

```tsx
      <Section title="계정">
        <div className="space-y-[18px]">
          {logoutSlot}
          {withdrawSlot}
        </div>
      </Section>
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test "app/(site)/me/me-page-content.test.tsx"`
Expected: PASS

- [ ] **Step 5: 탈퇴 버튼 컴포넌트 작성**

`app/(site)/me/withdraw-button.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { withdrawAccountAction } from "@/lib/actions/withdraw";

export function WithdrawButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[14px] font-medium text-[#C8C8C8]"
      >
        회원탈퇴
      </button>
      {open ? <WithdrawConfirmDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function WithdrawConfirmDialog({ onClose }: { onClose: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="withdraw-dialog-title"
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-6"
    >
      <div className="w-full max-w-[320px] rounded-[14px] bg-white p-5 text-center">
        <h2 id="withdraw-dialog-title" className="text-[16px] font-semibold text-[#050505]">
          정말로 탈퇴하시겠습니까?
        </h2>
        <p className="mt-2 text-[13px] font-medium leading-[18px] text-[#767676]">
          탈퇴 후 6개월간 데이터가 보관되며, 6개월 뒤 데이터는 일괄로 삭제됩니다.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-[8px] bg-[#F1F1F1] text-[14px] font-semibold text-[#050505]"
          >
            취소
          </button>
          <form action={withdrawAccountAction} className="flex-1">
            <button
              type="submit"
              className="h-11 w-full rounded-[8px] bg-[#FF1F1F] text-[14px] font-semibold text-white"
            >
              확인
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: 마이페이지에 주입**

`app/(site)/me/page.tsx`의 import에 추가한다:

```ts
import { WithdrawButton } from "./withdraw-button";
```

반환문을 바꾼다:

```tsx
  return <MyPageContent model={model} logoutSlot={<LogoutButton />} withdrawSlot={<WithdrawButton />} />;
```

- [ ] **Step 7: 타입 체크와 전체 테스트**

Run: `pnpm typecheck && pnpm test`
Expected: 둘 다 통과

- [ ] **Step 8: 커밋**

```bash
git add "app/(site)/me/withdraw-button.tsx" "app/(site)/me/me-page-content.tsx" "app/(site)/me/me-page-content.test.tsx" "app/(site)/me/page.tsx"
git commit -m "feat(me): add withdrawal button with confirmation dialog"
```

---

### Task 10: 복구 Server Action

**Files:**
- Create: `lib/actions/recover.ts`
- Test: `lib/actions/recover.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/actions/recover.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PENDING_RECOVERY_COOKIE_NAME } from "@/lib/auth/recovery";
import { USER_SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { cancelRecoveryAction, restoreAccountAction } from "./recover";

const cookiesMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  })
);
const verifyPendingRecoveryTokenMock = vi.hoisted(() => vi.fn());
const findWithdrawnUserByIdMock = vi.hoisted(() => vi.fn());
const restoreWithdrawnUserMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/auth/recovery", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/recovery")>("@/lib/auth/recovery");
  return { ...actual, verifyPendingRecoveryToken: verifyPendingRecoveryTokenMock };
});
vi.mock("@/lib/db/user-auth-queries", () => ({
  findWithdrawnUserById: findWithdrawnUserByIdMock,
  restoreWithdrawnUser: restoreWithdrawnUserMock
}));

function mockCookieStore(token: string | undefined) {
  const set = vi.fn();
  cookiesMock.mockResolvedValue({
    get: vi.fn(() => (token === undefined ? undefined : { value: token })),
    set
  });
  return set;
}

describe("restoreAccountAction", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    redirectMock.mockClear();
    verifyPendingRecoveryTokenMock.mockReset();
    findWithdrawnUserByIdMock.mockReset();
    restoreWithdrawnUserMock.mockReset();
    vi.useRealTimers();
  });

  it("복구 후 세션을 발급하고 returnTo 로 보낸다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T00:00:00.000Z"));
    const set = mockCookieStore("recovery-token");
    verifyPendingRecoveryTokenMock.mockResolvedValue({ userId: "user_1", returnTo: "/me/records" });
    findWithdrawnUserByIdMock.mockResolvedValue({
      id: "user_1",
      withdrawAt: "2026-07-01T00:00:00.000Z"
    });
    restoreWithdrawnUserMock.mockResolvedValue(true);

    await expect(restoreAccountAction()).rejects.toThrow("NEXT_REDIRECT:/me/records");

    expect(restoreWithdrawnUserMock).toHaveBeenCalledWith("user_1");
    expect(set).toHaveBeenCalledWith(
      USER_SESSION_COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({ httpOnly: true })
    );
    expect(set).toHaveBeenCalledWith(
      PENDING_RECOVERY_COOKIE_NAME,
      "",
      expect.objectContaining({ maxAge: 0 })
    );
  });

  it("쿠키가 없으면 로그인으로 보낸다", async () => {
    mockCookieStore(undefined);

    await expect(restoreAccountAction()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(restoreWithdrawnUserMock).not.toHaveBeenCalled();
  });

  it("보관 기간이 지났으면 recovery_expired 로 안내한다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T00:00:00.000Z"));
    mockCookieStore("recovery-token");
    verifyPendingRecoveryTokenMock.mockResolvedValue({ userId: "user_1", returnTo: "/me" });
    findWithdrawnUserByIdMock.mockResolvedValue({
      id: "user_1",
      withdrawAt: "2026-01-01T00:00:00.000Z"
    });

    await expect(restoreAccountAction()).rejects.toThrow(
      "NEXT_REDIRECT:/login?error=recovery_expired"
    );

    expect(restoreWithdrawnUserMock).not.toHaveBeenCalled();
  });

  it("경합으로 UPDATE 가 0건이면 recovery_expired 로 안내한다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T00:00:00.000Z"));
    mockCookieStore("recovery-token");
    verifyPendingRecoveryTokenMock.mockResolvedValue({ userId: "user_1", returnTo: "/me" });
    findWithdrawnUserByIdMock.mockResolvedValue({
      id: "user_1",
      withdrawAt: "2026-07-01T00:00:00.000Z"
    });
    restoreWithdrawnUserMock.mockResolvedValue(false);

    await expect(restoreAccountAction()).rejects.toThrow(
      "NEXT_REDIRECT:/login?error=recovery_expired"
    );
  });

  it("복구 대상이 없으면 recovery_unavailable 로 안내한다", async () => {
    mockCookieStore("recovery-token");
    verifyPendingRecoveryTokenMock.mockResolvedValue({ userId: "user_1", returnTo: "/me" });
    findWithdrawnUserByIdMock.mockResolvedValue(null);

    await expect(restoreAccountAction()).rejects.toThrow(
      "NEXT_REDIRECT:/login?error=recovery_unavailable"
    );
  });
});

describe("cancelRecoveryAction", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    redirectMock.mockClear();
  });

  it("복구 쿠키만 지우고 로그인으로 보낸다", async () => {
    const set = mockCookieStore("recovery-token");

    await expect(cancelRecoveryAction()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(set).toHaveBeenCalledWith(
      PENDING_RECOVERY_COOKIE_NAME,
      "",
      expect.objectContaining({ maxAge: 0 })
    );
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test lib/actions/recover.test.ts`
Expected: FAIL — `Failed to resolve import "./recover"`

- [ ] **Step 3: 구현**

`lib/actions/recover.ts`:

```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getPendingRecoveryCookieOptions,
  PENDING_RECOVERY_COOKIE_NAME,
  verifyPendingRecoveryToken
} from "@/lib/auth/recovery";
import {
  createUserSessionToken,
  getUserSessionCookieOptions,
  USER_SESSION_COOKIE_NAME
} from "@/lib/auth/session";
import { getWithdrawalStatus } from "@/lib/auth/withdrawal";
import { findWithdrawnUserById, restoreWithdrawnUser } from "@/lib/db/user-auth-queries";

export async function restoreAccountAction(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_RECOVERY_COOKIE_NAME)?.value;
  const pending = token ? await verifyPendingRecoveryToken(token) : null;

  if (!pending) {
    redirect("/login");
  }

  const user = await findWithdrawnUserById(pending.userId);
  if (!user || !user.withdrawAt) {
    clearRecoveryCookie(cookieStore);
    redirect("/login?error=recovery_unavailable");
  }

  if (getWithdrawalStatus(user.withdrawAt, new Date()) !== "recoverable") {
    clearRecoveryCookie(cookieStore);
    redirect("/login?error=recovery_expired");
  }

  const restored = await restoreWithdrawnUser(user.id);
  if (!restored) {
    // 그 사이 다른 요청이 계정을 정리했다.
    clearRecoveryCookie(cookieStore);
    redirect("/login?error=recovery_expired");
  }

  const sessionToken = await createUserSessionToken({ userId: user.id });
  cookieStore.set(USER_SESSION_COOKIE_NAME, sessionToken, getUserSessionCookieOptions());
  clearRecoveryCookie(cookieStore);
  redirect(pending.returnTo);
}

export async function cancelRecoveryAction(): Promise<void> {
  const cookieStore = await cookies();
  clearRecoveryCookie(cookieStore);
  redirect("/login");
}

function clearRecoveryCookie(cookieStore: Awaited<ReturnType<typeof cookies>>): void {
  cookieStore.set(PENDING_RECOVERY_COOKIE_NAME, "", {
    ...getPendingRecoveryCookieOptions(),
    maxAge: 0
  });
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test lib/actions/recover.test.ts`
Expected: PASS — 6 passed

- [ ] **Step 5: 커밋**

```bash
git add lib/actions/recover.ts lib/actions/recover.test.ts
git commit -m "feat(auth): add account recovery server actions"
```

---

### Task 11: 복구 확인 화면

**Files:**
- Create: `app/(site)/recover/page.tsx`
- Test: `app/(site)/recover/page.test.ts`

로그인 직후 흐름이라 로그인 페이지와 같은 어두운 배경·`max-w-[390px]` 레이아웃을 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`app/(site)/recover/page.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RecoverPage from "./page";

const cookiesMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  })
);
const verifyPendingRecoveryTokenMock = vi.hoisted(() => vi.fn());
const findWithdrawnUserByIdMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/auth/recovery", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/recovery")>("@/lib/auth/recovery");
  return { ...actual, verifyPendingRecoveryToken: verifyPendingRecoveryTokenMock };
});
vi.mock("@/lib/db/user-auth-queries", () => ({
  findWithdrawnUserById: findWithdrawnUserByIdMock
}));
vi.mock("@/lib/actions/recover", () => ({
  restoreAccountAction: vi.fn(),
  cancelRecoveryAction: vi.fn()
}));

function mockCookieStore(token: string | undefined) {
  cookiesMock.mockResolvedValue({
    get: vi.fn(() => (token === undefined ? undefined : { value: token }))
  });
}

describe("RecoverPage", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    redirectMock.mockClear();
    verifyPendingRecoveryTokenMock.mockReset();
    findWithdrawnUserByIdMock.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T00:00:00.000Z"));
  });

  it("복구 쿠키가 없으면 로그인으로 보낸다", async () => {
    mockCookieStore(undefined);

    await expect(RecoverPage()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("복구 대상이 없으면 recovery_unavailable 로 보낸다", async () => {
    mockCookieStore("recovery-token");
    verifyPendingRecoveryTokenMock.mockResolvedValue({ userId: "user_1", returnTo: "/me" });
    findWithdrawnUserByIdMock.mockResolvedValue(null);

    await expect(RecoverPage()).rejects.toThrow("NEXT_REDIRECT:/login?error=recovery_unavailable");
  });

  it("보관 기간이 지났으면 recovery_expired 로 보낸다", async () => {
    mockCookieStore("recovery-token");
    verifyPendingRecoveryTokenMock.mockResolvedValue({ userId: "user_1", returnTo: "/me" });
    findWithdrawnUserByIdMock.mockResolvedValue({
      id: "user_1",
      displayName: "granite",
      withdrawAt: "2026-01-01T00:00:00.000Z"
    });

    await expect(RecoverPage()).rejects.toThrow("NEXT_REDIRECT:/login?error=recovery_expired");
  });

  it("복구 가능하면 안내와 삭제 예정일을 보여준다", async () => {
    mockCookieStore("recovery-token");
    verifyPendingRecoveryTokenMock.mockResolvedValue({ userId: "user_1", returnTo: "/me" });
    findWithdrawnUserByIdMock.mockResolvedValue({
      id: "user_1",
      displayName: "granite",
      withdrawAt: "2026-07-01T00:00:00.000Z"
    });

    const html = renderToStaticMarkup(await RecoverPage());

    expect(html).toContain("탈퇴 신청된 계정입니다");
    expect(html).toContain("granite");
    expect(html).toContain("복구하기");
    expect(html).toContain("2027");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test "app/(site)/recover/page.test.ts"`
Expected: FAIL — `Failed to resolve import "./page"`

- [ ] **Step 3: 구현**

`app/(site)/recover/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cancelRecoveryAction, restoreAccountAction } from "@/lib/actions/recover";
import { PENDING_RECOVERY_COOKIE_NAME, verifyPendingRecoveryToken } from "@/lib/auth/recovery";
import { getScheduledDeletionAt, getWithdrawalStatus } from "@/lib/auth/withdrawal";
import { findWithdrawnUserById } from "@/lib/db/user-auth-queries";
import { formatDateDots } from "@/lib/format/date";

export default async function RecoverPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_RECOVERY_COOKIE_NAME)?.value;
  const pending = token ? await verifyPendingRecoveryToken(token) : null;

  if (!pending) {
    redirect("/login");
  }

  const user = await findWithdrawnUserById(pending.userId);
  if (!user || !user.withdrawAt) {
    redirect("/login?error=recovery_unavailable");
  }

  if (getWithdrawalStatus(user.withdrawAt, new Date()) !== "recoverable") {
    redirect("/login?error=recovery_expired");
  }

  const withdrawnOn = formatDateDots(user.withdrawAt);
  const deletionOn = formatDateDots(getScheduledDeletionAt(user.withdrawAt).toISOString());

  return (
    <main data-hide-site-footer className="min-h-screen bg-black px-5 text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col justify-center pb-11">
        <h1 className="text-[20px] font-semibold leading-[28px]">탈퇴 신청된 계정입니다.</h1>
        <p className="mt-3 text-[15px] font-medium leading-[22px] text-[#B9B9B9]">
          복구하시겠습니까?
        </p>

        <dl className="mt-7 space-y-2 rounded-[10px] bg-white/5 p-4 text-[13px] font-medium">
          <div className="flex justify-between">
            <dt className="text-[#B9B9B9]">계정</dt>
            <dd>{user.displayName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#B9B9B9]">탈퇴 신청일</dt>
            <dd>{withdrawnOn}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#B9B9B9]">삭제 예정일</dt>
            <dd>{deletionOn}</dd>
          </div>
        </dl>

        <p className="mt-4 text-[12px] font-medium leading-[18px] text-[#8A8A8A]">
          삭제 예정일이 지나면 데이터가 일괄 삭제되어 복구할 수 없습니다.
        </p>

        <div className="mt-8 space-y-3">
          <form action={restoreAccountAction}>
            <button
              type="submit"
              className="h-[52px] w-full rounded-[8px] bg-white text-[15px] font-semibold text-black"
            >
              복구하기
            </button>
          </form>
          <form action={cancelRecoveryAction}>
            <button
              type="submit"
              className="h-[52px] w-full rounded-[8px] border border-white/20 text-[15px] font-semibold text-white"
            >
              아니요
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test "app/(site)/recover/page.test.ts"`
Expected: PASS — 4 passed

- [ ] **Step 5: 커밋**

```bash
git add "app/(site)/recover/page.tsx" "app/(site)/recover/page.test.ts"
git commit -m "feat(auth): add account recovery confirmation page"
```

---

### Task 12: 로그인 페이지 안내 문구

**Files:**
- Modify: `app/(site)/login/page.tsx`

지금은 어떤 `error` 값이든 "로그인에 실패했습니다: {error}" 로 나온다. 복구 관련 값은 실패가 아니므로 문구를 나눈다.

- [ ] **Step 1: 안내 문구 로직 추가**

`app/(site)/login/page.tsx`의 `const error = getParam(params.error);` 아래에 추가한다:

```ts
  const withdrawn = getParam(params.withdrawn) === "1";
```

파일 하단의 `getParam` 함수 위에 추가한다:

```tsx
function getErrorMessage(error: string): string {
  if (error === "recovery_expired") {
    return "복구 가능 기간이 지났습니다. 새로 가입해 주세요.";
  }

  if (error === "recovery_unavailable") {
    return "복구할 수 있는 계정을 찾지 못했습니다.";
  }

  return `로그인에 실패했습니다: ${error}`;
}
```

- [ ] **Step 2: 렌더 부분 교체**

`{error ? (...) : null}` 블록을 아래로 교체한다:

```tsx
        {withdrawn ? (
          <p className="mt-4 text-center text-[12px] font-semibold text-[#B9B9B9]">
            탈퇴가 완료되었습니다. 6개월 안에 다시 로그인하면 계정을 복구할 수 있습니다.
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 text-center text-[12px] font-semibold text-[#FF6868]">
            {getErrorMessage(error)}
          </p>
        ) : null}
```

- [ ] **Step 3: 타입 체크와 전체 테스트**

Run: `pnpm typecheck && pnpm test`
Expected: 둘 다 통과

- [ ] **Step 4: 커밋**

```bash
git add "app/(site)/login/page.tsx"
git commit -m "feat(auth): show withdrawal and recovery notices on login page"
```

---

### Task 13: 문서화와 최종 검증

**Files:**
- Modify: `docs/DATA_MODEL.md`

- [ ] **Step 1: `users` 컬럼 표 갱신**

`docs/DATA_MODEL.md`의 `#### users` 표(204행 부근)에서 `onboarding_completed_at` 행과 `deleted_at` 행 사이에 두 행을 넣고, `deleted_at` 설명을 고친다. 표에 `privacy_visibility`(0015에서 추가됨)도 빠져 있으므로 같이 채운다:

```markdown
| `onboarding_completed_at` | `TEXT` | no | Timestamp set after first-time OAuth signup profile completion |
| `privacy_visibility` | `TEXT` | no | JSON string of per-field visibility toggles (`migrations/0015_user_privacy_visibility.sql`) |
| `withdraw_at` | `TEXT` | no | Account withdrawal request time; NULL means the account is active (`migrations/0016_user_withdrawal.sql`) |
| `deleted_at` | `TEXT` | no | Hard-expiry marker written once the retention window has passed |
```

`Indexes:` 목록도 고친다. 셋째 줄은 0013에서 UNIQUE 제약이 제거된 뒤로 사실과 다르다:

```markdown
- `idx_users_email` for future same-email merge discovery.
- `idx_users_deleted_at` for filtering active/deleted accounts.
- `idx_users_instagram_id` covers non-null Instagram handles on active rows. Not unique —
  the UNIQUE constraint was dropped in `migrations/0013_users_instagram_id_allow_duplicates.sql`.
- `idx_users_withdraw_at` for finding accounts pending deletion.
```

- [ ] **Step 2: 상태 모델 설명 추가**

같은 `#### users` 절의 `Indexes:` 목록 바로 다음, `#### user_oauth_identities` 앞에 추가한다:

```markdown
#### 탈퇴 상태

`users.withdraw_at`(탈퇴 신청)과 `users.deleted_at`(실제 삭제)의 조합으로 표현한다.

| withdraw_at | deleted_at | 상태 | 로그인 |
|---|---|---|---|
| NULL | NULL | 정상 | 세션 발급 |
| 값 있음 | NULL | 탈퇴 유예 | 6개월 이내면 `/recover`, 지났으면 lazy purge 후 신규 가입 |
| — | 값 있음 | 삭제 완료 | 신규 가입 |

- 보관 기간 판정은 `lib/auth/withdrawal.ts`, 로그인 분기는 `lib/auth/login-resolution.ts`.
- 보관 기간이 지난 계정은 재로그인 시점에 정리한다(lazy purge). `deleted_at`을 찍고
  `user_oauth_identities` 행을 지워 같은 소셜 계정으로 새로 가입할 수 있게 한다.
  개인정보 익명화를 포함한 일괄 purge 배치는 아직 없다.
- `findActiveUserById`는 `withdraw_at IS NULL`을 요구하므로, 탈퇴 유예 중인 사용자는
  세션 쿠키가 남아 있어도 로그인 전용 화면에 접근하지 못한다.
```

- [ ] **Step 3: 전체 검증**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: 셋 다 통과

- [ ] **Step 4: 마이그레이션 재적용 확인**

Run: `pnpm wrangler d1 migrations apply granite --local`
Expected: `No migrations to apply!` (Task 1에서 이미 적용됨)

- [ ] **Step 5: 커밋**

```bash
git add docs/DATA_MODEL.md
git commit -m "docs: document user withdrawal state model"
```

---

## 수동 확인 체크리스트

`pnpm dev` 로 띄운 뒤 확인한다. D1 로컬 데이터로 진행한다.

- [ ] 로그인 후 `/me` → "회원탈퇴" 클릭 → 모달에 6개월 보관 문구가 뜬다
- [ ] 모달에서 ESC 와 "취소" 둘 다 닫힌다
- [ ] "확인" → `/login?withdrawn=1` 로 이동하고 탈퇴 완료 안내가 뜬다
- [ ] 같은 소셜 계정으로 다시 로그인 → `/recover` 로 이동, 표시명·탈퇴 신청일·삭제 예정일이 보인다
- [ ] "아니요" → `/login` 으로 돌아가고 계정은 여전히 탈퇴 상태다
- [ ] 다시 로그인 → `/recover` → "복구하기" → `/me` 진입, 프로필이 그대로다
- [ ] DB에서 `withdraw_at`을 7개월 전으로 바꾼 뒤 로그인 → `/signup` 으로 가고,
      가입을 마치면 `UNIQUE (provider, provider_uid)` 오류 없이 새 계정이 만들어진다

```sql
-- 만료 시나리오 준비
UPDATE users SET withdraw_at = datetime('now', '-7 months') WHERE id = 'user_...';
```

---

## Self-Review 결과

**스펙 커버리지** — 설계 문서의 모든 절이 태스크에 대응한다.

| 스펙 절 | 태스크 |
|---|---|
| 상태 모델 / 마이그레이션 | 1 |
| 만료 판정 | 2 |
| 복구 토큰 | 3 |
| 쿼리 계층 | 4 |
| 로그인 분기 통합 | 5, 6, 7 |
| 탈퇴 화면 | 8, 9 |
| 복구 화면 | 10, 11 |
| 경계 및 오류 처리 | 4(조건부 UPDATE), 8(재진입), 10(경합·만료), 12(안내 문구) |
| 테스트 | 각 태스크에 포함 |
| 문서화 | 13 |

**이름 일관성** — 태스크 간 시그니처를 맞춰 두었다.

- `getWithdrawalStatus(withdrawAt, now)` — Task 2 정의, Task 5·10·11 사용
- `getScheduledDeletionAt(withdrawAt)` — Task 2 정의, Task 11 사용
- `markUserWithdrawn(userId) → boolean` — Task 4 정의, Task 8 사용
- `restoreWithdrawnUser(userId) → boolean` — Task 4 정의, Task 10 사용
- `findWithdrawnUserById(userId)` — Task 4 정의, Task 10·11 사용
- `findLoginCandidateByOAuthIdentity` / `purgeExpiredWithdrawnUser` — Task 4 정의, Task 5 사용
- `resolveOAuthLogin(profile, now)` — Task 5 정의, Task 6·7 사용
- `PENDING_RECOVERY_COOKIE_NAME` 외 recovery API — Task 3 정의, Task 6·7·10·11 사용
- `withdrawSlot` — Task 9에서 타입과 사용처를 함께 변경

**태스크 순서** — Task 4가 라우트를 깨뜨린 채 끝나고 Task 7에서 복구된다. 이는 의도적이다. 함수 이름 변경과 호출부 교체를 한 커밋에 몰면 리뷰 단위가 지나치게 커진다. Task 4 Step 7에서 오류 범위를 그 두 파일로 한정해 확인하고 넘어간다.
