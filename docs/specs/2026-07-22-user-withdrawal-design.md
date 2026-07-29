# 회원 탈퇴 및 복구 설계

- 작성일: 2026-07-22
- 상태: 승인됨

## 목표

마이페이지에서 회원 탈퇴를 신청할 수 있게 한다. 탈퇴한 계정은 6개월간 보관하며,
그 사이 다시 로그인하면 복구 여부를 물어본다. 6개월이 지나면 재로그인 시 새 계정으로
가입하게 한다.

## 비목표

- 6개월 경과 계정을 일괄 삭제하는 purge 배치 (별도 작업)
- 탈퇴한 사용자가 남긴 기록·프로젝트·베타의 공개 노출 정책 변경
- 탈퇴 사유 수집, 탈퇴 알림 메일

## 상태 모델

`users` 테이블에 `withdraw_at`(탈퇴 신청 시각)을 추가하고, 기존 `deleted_at`(실제 삭제
시각)과 조합해 세 가지 상태를 표현한다.

| withdraw_at | deleted_at | 상태 | 로그인 결과 |
|---|---|---|---|
| NULL | NULL | 정상 | 세션 발급 |
| 값 있음 | NULL | 탈퇴 유예 | 6개월 이내면 복구 안내, 넘었으면 lazy purge 후 신규 가입 |
| — | 값 있음 | 삭제 완료 | 신규 가입 |

두 번째 행의 두 결과는 DB 상태가 같고 `withdraw_at`과 현재 시각의 차이로만 갈린다.
판정 로직은 아래 "만료 판정"에 있다.

`deleted_at`은 이미 스키마에 있으나 사용자 행에는 한 번도 기록된 적이 없다. 이번 작업에서
lazy purge 경로가 처음으로 이 값을 채운다.

## 마이그레이션

`migrations/0016_user_withdrawal.sql`:

```sql
ALTER TABLE users ADD COLUMN withdraw_at TEXT;

CREATE INDEX IF NOT EXISTS idx_users_withdraw_at
  ON users (withdraw_at) WHERE withdraw_at IS NOT NULL;
```

`idx_users_instagram_id`는 0013에서 UNIQUE 제약이 제거되어 조회용 인덱스로만 남아 있다.
탈퇴 사용자의 인스타그램 ID가 재사용을 막지 않으므로 수정하지 않는다.

## 쿼리 계층 (`lib/db/user-auth-queries.ts`)

기존 함수 변경:

- `findActiveUserById`: `WHERE id = ? AND deleted_at IS NULL AND withdraw_at IS NULL`.
  탈퇴 유예 중인 사용자는 마이페이지·기록·프로젝트 등 로그인 전용 화면에 접근할 수 없다.
- `findUserByOAuthIdentity`: `findLoginCandidateByOAuthIdentity`로 대체한다.
  `deleted_at IS NULL`만 필터하고 `withdraw_at`은 보지 않으므로 탈퇴한 계정도 찾아낸다.
- `ensureUserForOAuthProfile`, `createUserForCompletedSignup`의 내부 중복 확인도 candidate
  기준으로 바꾼다. 활성 사용자만 조회하면 탈퇴 계정의 identity 행을 못 보고 INSERT를 시도해
  `UNIQUE (provider, provider_uid)` 위반이 발생한다.

신규 조회 함수:

- `findLoginCandidateByOAuthIdentity(provider, providerUid)` — 위 참조
- `findWithdrawnUserById(userId)` —
  `WHERE id = ? AND deleted_at IS NULL AND withdraw_at IS NOT NULL`.
  복구 화면과 복구 액션이 세션 없이 사용자를 확인할 때 쓴다.

신규 변경 함수 (모두 조건부 UPDATE로 멱등하게 작성하고 영향받은 행 수를 반환):

- `markUserWithdrawn(userId, now)` —
  `UPDATE users SET withdraw_at = ?, updated_at = ? WHERE id = ? AND withdraw_at IS NULL AND deleted_at IS NULL`
- `restoreWithdrawnUser(userId, now)` —
  `UPDATE users SET withdraw_at = NULL, updated_at = ? WHERE id = ? AND withdraw_at IS NOT NULL AND deleted_at IS NULL`
- `purgeExpiredWithdrawnUser(userId, now)` —
  `UPDATE users SET deleted_at = ?, updated_at = ? WHERE id = ?` 실행 후
  `DELETE FROM user_oauth_identities WHERE user_id = ?`.
  개인정보 익명화는 하지 않는다. identity 행을 끊어 같은 소셜 계정으로 새로 가입할 수 있게
  하는 것이 목적이다.

## 만료 판정 (`lib/auth/withdrawal.ts`, 신규)

DB에 접근하지 않는 순수 모듈로 둔다.

```ts
export const WITHDRAWAL_RETENTION_MONTHS = 6;

export type WithdrawalStatus = "active" | "recoverable" | "expired";

export function getWithdrawalStatus(withdrawAt: string | null, now: Date): WithdrawalStatus;
export function getScheduledDeletionAt(withdrawAt: string, ...): Date;
```

경과 판정은 캘린더 기준이다. `withdraw_at`에 6개월을 더한 시각(`setMonth(+6)`)이 `now`보다
크면 `recoverable`, 같거나 작으면 `expired`. 월말 보정은 JS `Date`의 기본 동작(8월 31일
+6개월 → 3월 3일)을 그대로 따르며 별도 처리하지 않는다.

`getScheduledDeletionAt`은 복구 안내 화면에 "언제 삭제되는지" 표시할 때 쓴다.

## 로그인 분기 통합 (`lib/auth/login-resolution.ts`, 신규)

웹 OAuth 콜백(`app/api/auth/callback/[provider]/route.ts`)과 네이티브 세션 라우트
(`app/api/auth/native/session/route.ts`)가 동일한 "사용자 조회 → 없으면 가입, 있으면 세션"
로직을 각각 갖고 있다. 탈퇴 분기가 추가되면 세 갈래가 되므로 공통 함수로 뽑는다.

```ts
export type OAuthLoginResolution =
  | { kind: "session"; user: User }
  | { kind: "recover"; user: User }
  | { kind: "signup" };

export async function resolveOAuthLogin(
  profile: OAuthProfile,
  now: Date
): Promise<OAuthLoginResolution>;
```

동작:

1. `findLoginCandidateByOAuthIdentity(profile.provider, profile.providerUserId)` 조회
2. 없으면 `{ kind: "signup" }`
3. `getWithdrawalStatus`가 `active`면 `{ kind: "session", user }`
4. `recoverable`이면 `{ kind: "recover", user }`
5. `expired`면 `purgeExpiredWithdrawnUser` 실행 후 `{ kind: "signup" }`

두 라우트는 이 결과를 받아 쿠키 설정과 이동 경로만 결정한다.

- `session` → 세션 쿠키 발급, `returnTo`로 이동 (현행과 동일)
- `signup` → pending signup 쿠키 발급, `/signup`으로 이동 (현행과 동일)
- `recover` → pending recovery 쿠키 발급, `/recover`로 이동 (신규)

네이티브 라우트는 리다이렉트 대신 `createNativeSessionNavigationResponse(path)`를 쓰므로
그 헬퍼에 `/recover`를 넘긴다.

## 복구 토큰 (`lib/auth/recovery.ts`, 신규)

`lib/auth/signup.ts`의 pending signup 토큰 구조를 그대로 따른다. 복구 확인 화면 시점에는
아직 세션이 없으므로 신원을 단기 쿠키로 옮긴다.

- 쿠키명: `granite_pending_recovery`
- JWT payload: `user_id`, `return_to`. 서명 키는 `getUserSessionSecret()` 공유
- 만료: 15분 (JWT `exp`와 쿠키 `maxAge` 둘 다)
- 쿠키 옵션: `httpOnly`, `sameSite: "lax"`, `path: "/"`, 프로덕션에서 `secure`
- API: `createPendingRecoveryToken`, `verifyPendingRecoveryToken`,
  `getPendingRecoveryCookieOptions`, `PENDING_RECOVERY_COOKIE_NAME`
- `return_to`는 `signup.ts`와 같은 방식으로 검증한다 (`/`로 시작하고 `//`로 시작하지 않을 것,
  아니면 `/me`)

## 탈퇴 화면

`app/(site)/me/me-page-content.tsx`의 "계정" 섹션에 회색 텍스트로 놓여 있는
`<p>회원탈퇴</p>`를 `withdrawSlot` prop으로 교체한다. `logoutSlot`과 같은 패턴이다.

`app/(site)/me/withdraw-button.tsx` (`"use client"`):

- 기본 상태는 로그아웃 버튼과 같은 텍스트 버튼
- 클릭하면 확인 모달을 연다. 문구:
  - 제목: `정말로 탈퇴하시겠습니까?`
  - 본문: `탈퇴 후 6개월간 데이터가 보관되며, 6개월 뒤 데이터는 일괄로 삭제됩니다.`
  - 버튼: `취소` / `확인`
- 모달 마크업과 접근성 처리는 `components/public/add-record-dialog.tsx` 패턴을 따른다
  (배경 오버레이, ESC 닫기, 열릴 때 버튼에 포커스)
- `확인`은 `withdrawAccountAction`을 호출하는 `<form action={...}>`의 submit 버튼

`lib/actions/withdraw.ts` — `withdrawAccountAction`:

1. 세션 쿠키 검증. 없으면 `/login`으로 리다이렉트
2. `findActiveUserById`로 활성 사용자 확인. 없으면 세션 쿠키 삭제 후 `/login`
3. `markUserWithdrawn(user.id, now)`
4. 세션 쿠키 삭제 (`logoutAction`과 동일한 방식)
5. `redirect("/login?withdrawn=1")`

`/login`은 `withdrawn=1`일 때 "탈퇴가 완료되었습니다" 안내를 보여준다. 기존 `error`
쿼리 처리부와 같은 위치에 추가한다.

## 복구 화면

`app/(site)/recover/page.tsx` (서버 컴포넌트):

1. `granite_pending_recovery` 쿠키를 읽어 검증. 실패하면 `redirect("/login")`
2. 토큰의 `user_id`로 `findWithdrawnUserById` 조회
3. 사용자가 없거나 상태가 `recoverable`이 아니면 `redirect("/login?error=recovery_unavailable")`
4. 표시명, 탈퇴 신청일, `getScheduledDeletionAt` 기준 삭제 예정일을 보여준다
5. 문구: `탈퇴 신청된 계정입니다. 복구하시겠습니까?`
6. 버튼 두 개를 각각 별도 form으로 둔다: `복구하기` → `restoreAccountAction`,
   `아니요` → `cancelRecoveryAction`

`lib/actions/recover.ts`:

- `restoreAccountAction`
  1. 복구 쿠키 검증. 실패 시 `/login`
  2. `findWithdrawnUserById` + `getWithdrawalStatus` 재확인
  3. `restoreWithdrawnUser` 실행. 영향받은 행이 0이면 (경합·만료)
     복구 쿠키 삭제 후 `/login?error=recovery_expired`
  4. 복구 쿠키 삭제, 세션 쿠키 발급
  5. `redirect(returnTo)`
- `cancelRecoveryAction` — 복구 쿠키만 삭제하고 `/login`으로 이동

## 경계 및 오류 처리

- 세션 쿠키는 유효한데 그 사이 탈퇴한 사용자: `findActiveUserById`가 `withdraw_at IS NULL`을
  요구하므로 null이 되고, 각 페이지의 기존 `redirect("/login?returnTo=...")` 로직이 그대로
  처리한다. 추가 작업이 없다.
- 이미 탈퇴한 사용자가 탈퇴 액션을 다시 호출: `markUserWithdrawn`의 WHERE 조건에 걸려
  0 rows. 오류 없이 로그아웃 처리만 하고 끝낸다.
- 복구 쿠키를 들고 있는데 그 사이 만료: 3~4단계에서 걸러 `recovery_expired`로 안내한다.
- lazy purge 도중 실패: `resolveOAuthLogin`에서 예외가 나면 라우트의 기존 catch가
  `callback_failed` / `native_session_failed`로 로그인 페이지에 돌려보낸다.
- `record.ts` 등 `findActiveUserById`를 쓰는 Server Action은 자동으로 탈퇴 사용자를 거부한다.

## 테스트

- `lib/auth/withdrawal.test.ts` — 경계값: 5개월 29일, 정확히 6개월, 6개월 + 1일,
  `withdraw_at`이 null인 경우
- `lib/auth/recovery.test.ts` — 토큰 왕복, 만료, 변조, `return_to` 검증
- `lib/auth/login-resolution.test.ts` — 세 갈래 분기와 만료 시 purge 호출 여부
- `lib/db/user-auth-queries.test.ts` — 신규 쿼리 5종과 `findActiveUserById` 필터 변경.
  기존 D1 mock 패턴 사용
- `lib/actions/withdraw.test.ts`, `lib/actions/recover.test.ts` — 성공 경로와 각 오류 경로
- `app/api/auth/callback/[provider]/route.test.ts`,
  `app/api/auth/native/session/route.test.ts` — `recover` 결과일 때 세션 쿠키를 발급하지
  않고 복구 쿠키를 심는지
- `app/(site)/me/me-page-content.test.tsx` — `withdrawSlot` 렌더
- `app/(site)/recover/page.test.ts` — 쿠키 없음 / 상태 불일치 리다이렉트

## 변경 파일 요약

신규:

- `migrations/0016_user_withdrawal.sql`
- `lib/auth/withdrawal.ts`
- `lib/auth/recovery.ts`
- `lib/auth/login-resolution.ts`
- `lib/actions/withdraw.ts`
- `lib/actions/recover.ts`
- `app/(site)/me/withdraw-button.tsx`
- `app/(site)/recover/page.tsx`

수정:

- `lib/db/schema.ts` — `User`에 `withdrawAt` 추가
- `lib/db/user-auth-queries.ts`
- `app/api/auth/callback/[provider]/route.ts`
- `app/api/auth/native/session/route.ts`
- `app/(site)/me/me-page-content.tsx`, `app/(site)/me/page.tsx`
- `app/(site)/login/page.tsx` — `withdrawn`, `recovery_expired`, `recovery_unavailable` 안내
- `docs/DATA_MODEL.md` — `withdraw_at` 및 상태 모델 문서화
