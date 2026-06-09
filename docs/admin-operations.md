# Granite Admin Operations

본 문서는 Granite 관리자/운영자를 위한 통합 SOP다. Phase 3에서 도입된 admin 계정·이미지 정책부터 Phase 5의 Beta/Instagram 운영까지 한 곳에서 다룬다.

## 목차

- 관리자 계정 관리
  - [Initial Admin (recommended path)](#initial-admin-recommended-path)
  - [Hash-only fallback](#hash-only-fallback)
  - [Password Rotation](#password-rotation)
- [Image Policy](#image-policy)
- [Seed Strategy](#seed-strategy)
- [Phase 3 Verification Status](#phase-3-verification-status)
- [Known operational caveats (Phase 3.5 follow-up)](#known-operational-caveats-phase-35-follow-up)
- [Phase 5 — Beta / Instagram 운영](#phase-5--beta--instagram-운영)

---

## Initial Admin (recommended path)

Use `scripts/seed-admin.ts`. It pulls D1 env from `.env.local` (or the current shell), prompts for the password with hidden input + confirmation, shows the target D1 database id tail so you can confirm the environment before any write, and either INSERTs a new row or UPDATEs the existing row keyed by email.

```bash
# 1) Pull the target environment's env vars locally (preview or production)
vercel env pull .env.local --environment preview     # or: --environment production

# 2) Run the seeder (email + display name are positional; password is prompted)
pnpm dlx tsx scripts/seed-admin.ts ops@granite.kr "Granite Ops"

#   Optional: pin a stable id for the first admin
pnpm dlx tsx scripts/seed-admin.ts ops@granite.kr "Granite Ops" --id admin_primary
```

The script will:

1. Print the **target D1 database id's last 6 chars** and ask for confirmation. Use this to make sure you're not seeding prod from a preview shell (or vice versa).
2. Prompt for the password (hidden) and a confirmation. Enforces ≥ 6 chars.
3. Look up any existing row with this email. If found, asks to UPDATE password + display name + reactivate. Otherwise INSERTs a new row with `id = admin_<uuid>` (or the `--id` you provided).
4. Hash with bcrypt cost = 12 and write to D1. Never prints the password or hash.

Delete `.env.local` after seeding production:

```bash
rm .env.local
```

## Hash-only fallback

If you can only reach D1 through its web console and need to compose the SQL manually, generate just the hash:

```bash
pnpm dlx tsx scripts/create-admin-hash.ts '<strong-password-12-chars-or-more>'
```

Then run in the D1 console:

```sql
INSERT INTO admins (id, email, password_hash, display_name, is_active)
VALUES ('admin_primary', 'ops@granite.kr', '<bcrypt-hash>', 'Granite Ops', 1);
```

Do not commit production password hashes to git. Prefer the seeder or a one-time D1 console insert.

## Password Rotation

Use the same seeder — it detects the existing email and updates the password:

```bash
vercel env pull .env.local --environment production
pnpm dlx tsx scripts/seed-admin.ts ops@granite.kr "Granite Ops"
# Answers "yes" to "Update password + display_name + reactivate?"
```

Or, if rotating from the D1 console with the hash-only fallback:

```sql
UPDATE admins
SET password_hash = '<new-hash>', updated_at = datetime('now')
WHERE id = '<admin-id>';
```

If you suspect session compromise, also rotate `ADMIN_JWT_SECRET` in Vercel; this immediately invalidates every existing admin session.

Confirm old sessions no longer access `/admin/content` after either change.

## Image Policy

Public image serving is already configured through R2/CDN. Admin forms must store only URLs on the configured `CDN_BASE_URL` host (currently `https://cdn.granite.kr/...`) or approved relative CDN paths. Do not store private R2 URLs, signed URLs, or raw S3 endpoint URLs.

## Seed Strategy

For production environments, create the initial admin user through a **one-time D1 console insert**. Do NOT create a seed migration file with a committed password hash, as this poses an operational security risk in a shared repository.

For local development and testing, you may optionally create a local-only seed file (e.g., `migrations/0004_seed_initial_admin.sql` in `.gitignore`) if needed, but it should never be committed to version control.

### Process

1. Deploy migrations (including `0003_admin_operations.sql` with the admin table schema).
2. In the D1 console or command-line tool, run the INSERT statement above with a strong, randomly generated password hash.
3. Securely distribute the password to the initial admin via a separate channel (not email, git, or chat).
4. Delete any temporary seed files or notes containing the hash.

### Credentials Management

- Passwords must be at least 6 characters long (enforced by `seed-admin.ts`, `create-admin-hash.ts`, and the login Zod schema). Consider raising this if your operational policy allows.
- Store rotated hashes only in D1; never log plaintext passwords.
- Use a password manager or secure credential store for operational secrets.

## Phase 3 Verification Status

_Last updated: 2026-05-30 on branch `phase3-implement`._

### Automated checks — PASSED

| Command | Result |
|---------|--------|
| `pnpm test` | 13 test files, 227 tests — all passed |
| `pnpm typecheck` | 0 errors |
| `pnpm build` | 23 routes compiled successfully |

The `stderr` lines visible during `pnpm test` (`[audit] Failed to write audit log`) are intentional: those tests explicitly verify that audit failures are non-fatal and do not roll back the content mutation.

### Still requires human verification (out of scope for automated checks)

The following steps must be completed by a human operator before the admin system is production-ready:

1. **Apply migration to D1** — run `pnpm wrangler d1 migrations apply granite --local` for local, and the equivalent command without `--local` for preview/prod environments. Migration file: `migrations/0003_admin_operations.sql`.

2. **Insert first admin row** — after migration is applied, run a one-time D1 console INSERT using the hash generated by `scripts/create-admin-hash.ts` (see "Initial Admin" section above).

3. **Browser smoke tests** — verify the following routes in a running dev or preview environment:
   - `/admin/login` — login with email+password, confirm `granite_admin` cookie is set as HttpOnly
   - `/admin/login` (logged out) — confirm unauthenticated redirect from any `/admin/*` route
   - `/admin/content` — confirm overview page loads with entity counts
   - `/admin/content/areas`, `/admin/content/crags`, `/admin/content/sectors`, `/admin/content/boulders`, `/admin/content/topos`, `/admin/content/routes` — CRUD round-trip (create, edit, save), publish toggle, soft-delete (confirm `DELETE` prompt), restore
   - `/admin/announcements` — announcement create, edit, soft-delete, restore
   - `/admin/audit` — confirm audit log rows appear after mutations above

4. **Image upload verification** — on any content form that supports image upload, upload a file and confirm:
   - The stored URL begins with `https://cdn.granite.kr/`
   - No private R2 or signed URLs are persisted
   - Audit log records the upload action

5. **Public cache isolation** — confirm that soft-deleted content does not appear on public-facing pages (`/`, `/c/[cragSlug]`, etc.) after revalidation.

6. **Session expiry** — confirm that an expired or tampered `granite_admin` JWT cookie results in redirect to `/admin/login` rather than an error page.

## Known operational caveats (Phase 3.5 follow-up)

The Phase 3 cache-invalidation logic explicitly handles parent moves: `saveSector`/`Boulder`/`TopoAction` flushes both OLD and NEW ancestry surfaces and enumerates immediate descendants. However the following two cases were intentionally deferred to a Phase 3.5 follow-up patch and are tracked here as a known caveat:

- **Unpublishing a crag/sector/boulder/topo** via `togglePublishAction` invalidates the toggled entity's own surface but does NOT enumerate descendant detail caches (`boulder:<id>`, `route:<id>`, `/t/<id>`, `/r/<id>`). A boulder/topo/route detail page cached just before an ancestor was unpublished can continue serving until its `unstable_cache` TTL or until another mutation invalidates it.
- **Soft-deleting or restoring** a crag/sector/boulder/topo has the same descendant-cache gap.

**Public exposure bound:** all public detail pages are `force-dynamic`, so only `unstable_cache`-wrapped data fetchers are affected — the actual page render runs every request and the underlying SQL still enforces ancestor `is_published`/`deleted_at` filters. The user-visible stale window is therefore bounded by the cache TTL of `findBoulderById`/`findRouteById`/etc., not unbounded.

**Operational workaround until the patch lands:** after unpublishing or soft-deleting any non-leaf content, an admin can either (a) wait out the cache TTL, or (b) trigger any small change on a descendant (e.g. toggle then re-toggle its own publish state) to force its cache to flush.

**Planned follow-up:** consolidate descendant invalidation into a shared `invalidateEntityAndDescendants` helper called from save / soft-delete / restore / publish-toggle paths uniformly. Tracked as a Phase 3.5 GitHub Issue (see plan: "Phase 3.5 — Deferred follow-ups").

---

## Phase 5 — Beta / Instagram 운영

본 섹션은 Phase 5 Beta 수집 및 모더레이션을 담당하는 운영자를 위한 업무 절차서다. Instagram 웹훅을 통한 자동 매칭과 수동 검토, 웹훅 수신 실패 처리, 베타 상태 관리 및 운영 모니터링에 대한 모든 SOP를 기술한다.

연관 문서:
- [Phase 5 Plan](plans/2026-06-02-granite-phase-5.md) — 코드 구현 단위
- [Phase 5 Launch Checklist](phase5-launch-checklist.md) — 출시 직전 작업
- [Deployment](deployment.md) — 배포 명령

### `/admin/webhooks` 검토 절차

#### 기본 필터 상태

`/admin/webhooks` 페이지에 진입하면 기본적으로 `status=unmatched` 필터가 적용된다. 이는 웹훅 수신 후 Route 매칭에 성공했으나 아직 운영자 검토를 기다리는 행들을 우선적으로 표시한다.

#### 자동 매칭 규칙

웹훅이 수신되면 캡션에서 해시태그를 추출한 후 Route 후보를 검색한다:

- **정확히 1개 후보 일치**: 자동으로 매칭하여 `webhook_inbox.status='matched'`로 설정 후 새 Beta 레코드를 생성한다.
- **0개 일치**: 캡션이 어느 Route와도 매칭되지 않으므로 `webhook_inbox.status='unmatched'`로 남는다.
- **2개 이상 일치**: 동명 Boulder 또는 Route가 존재하여 결정을 내릴 수 없으므로 `webhook_inbox.status='unmatched'`로 떨어진다.

운영자는 `unmatched` 행을 수동 검토하여 올바른 Route를 선택하거나 거절할 책임이 있다.

#### Unmatched 행 검토 프로세스

1. 목록에서 `status='unmatched'` 행을 찾는다.
2. 행을 클릭하여 상세 패널을 연다. 다음을 확인한다:
   - 수신된 `caption` 텍스트와 추출된 `hashtag` 값
   - `external_media_id` (Instagram의 미디어 고유 ID)
   - `external_user_handle` (사진/영상 게시자 Instagram 핸들)
3. 캡션을 분석하여 올바른 Route를 특정한다.
4. "수동 매칭" 버튼 또는 드롭다운에서 대상 Route를 선택한다.
   - 성공: `webhook_inbox.status='manually_matched'`로 업데이트 후 Beta를 신규 생성 또는 기존 Beta 업데이트.
5. Route를 특정할 수 없으면 "거절" 버튼으로 `webhook_inbox.status='rejected'`로 표시한다.

#### Failed 행 처리

웹훅 수신 후 처리 중 오류가 발생하면 `webhook_inbox.status='failed'`가 된다. Phase 5에는 자동 재처리 기능이 없으므로 운영자는 다음 중 하나를 선택한다:

1. **Meta App Dashboard에서 재전송**: Meta Webhooks 설정에서 실패한 이벤트를 수동 재전송.
2. **수동 거절**: 더 이상 처리할 가치가 없으면 거절 처리.
3. **수동 등록 폼 사용**: `/admin/betas` 페이지의 "수동 등록" 폼에서 Instagram/YouTube URL과 메타데이터를 직접 입력하여 Beta를 등록.

#### 운영 이벤트 패널

`/admin/webhooks` 우측 패널에는 최근 `webhook_operational_events` 50건이 시간순 역정렬로 표시된다. 각 이벤트는 다음 정보를 포함한다:

- `external_media_id`: 촉발 미디어
- `event_type`: 웹훅 수신, 매칭 시도, 베타 생성 등
- `status_code`: 성공(`200`), 클라이언트 오류(`4xx`), 서버 오류(`5xx`)
- `error_code`: 발생 오류의 종류 (아래 ["운영 이벤트 오류 코드 가이드"](#운영-이벤트-오류-코드-가이드) 참고)
- `error_message`: 상세 오류 메시지
- `created_at`: 이벤트 기록 시각

이 패널을 통해 비정상 트래픽, 반복되는 오류, 혹은 특정 사용자의 패턴을 빠르게 감지할 수 있다.

### `/admin/betas` 검토 절차

#### 베타 상태 정의

Beta는 다음 네 가지 상태 중 하나를 가진다:

| 상태 | 의미 | 공개 노출 |
|------|------|----------|
| `pending` | 운영자 검토 대기 중 | 아니오 |
| `approved` | 공개 승인됨 | **예** |
| `hidden` | 임시 비공개 | 아니오 |
| `removed` | 삭제 처리됨 | 아니오 |

**공개 노출 규칙**: 공개 라우트의 Beta 그리드(`/r/<route-id>#betas`)에는 `approved` 상태인 Beta만 노출된다. `pending`, `hidden`, `removed`는 비공개이므로 일반 사용자가 볼 수 없다.

#### 베타 검토 및 모더레이션

1. `/admin/betas` 페이지에서 기본 필터는 `status=pending`이다.
2. 각 행은 다음을 표시한다:
   - 미디어 썸네일
   - Route 이름 및 경로 (Area → Crag → Route)
   - `external_user_handle` (제보자 Instagram/YouTube 핸들)
   - `external_media_id` (원본 미디어 ID)
   - 현재 상태 (pending / approved / hidden / removed)
3. 행을 클릭하여 상세 패널을 열고 다음 액션 중 하나를 수행한다:
   - **Approve**: `status='approved'`로 변경 → 공개 Beta 그리드에 즉시 노출.
   - **Hide**: `status='hidden'`으로 변경 → 임시 비공개 (나중에 복구 가능).
   - **Remove**: `status='removed'`로 변경 → 완전 삭제 (복구 불가).
   - **Revert to Pending**: `status='pending'`으로 되돌리기 → 재검토 대기.

각 액션은 `admin_audit_logs`에 기록된다.

### 중복 처리 SOP

#### 웹훅 재전송으로 인한 중복

Instagram Meta에서 웹훅을 재전송하거나 사용자가 같은 영상을 다시 mention할 경우, 같은 `external_media_id`가 다시 도착할 수 있다:

1. 같은 `external_media_id`가 기존 `webhook_inbox`에 존재하면 **새 행이 생성되지 않고** 기존 행의 `status='duplicate'`로 표시된다.
2. 새 Beta는 생성되지 않는다. 기존 Beta가 이미 생성된 경우 유지된다.
3. 운영자는 중복 행을 안전하게 무시할 수 있다.

#### 수동 등록에서의 중복 감지

비로그인 사용자가 `/r/<route-id>#register-beta` 수동 등록 폼을 통해 같은 `permalink_url` (Instagram/YouTube 고정 링크)을 제출하면:

1. 이미 등록된 URL이라면 서버는 "이미 등록된 영상입니다." 메시지를 반환한다.
2. 새 Beta는 생성되지 않는다.

#### 수동 매칭 시 UNIQUE 제약 충돌

운영자가 웹훅 인박스의 같은 `external_media_id`를 여러 Route에 수동 매칭하려고 하면:

1. `(route_id, external_media_id)` UNIQUE 인덱스로 인해 두 번째 INSERT가 실패할 수 있다.
2. 이 경우 **기존 Beta를 거절 처리한 후** 새로운 Route로 수동 재등록해야 한다.
3. 패턴이 빈번하면 사용자 안내 메시지를 개선하거나 일괄 처리 도구 추가를 검토한다.

### 운영 이벤트 오류 코드 가이드

웹훅 처리 중 발생한 오류는 `webhook_operational_events.error_code`로 기록된다. 각 오류 코드의 의미와 운영자 대응 방법:

- **`invalid_signature`** — Meta HMAC 서명 검증 실패. 잠재적 공격이거나 `META_APP_SECRET` 회전 이후 미반영. 단일 발생은 무시. 반복 발생 시 Worker secret `META_APP_SECRET` 확인.

- **`graph_api_failure`** — Meta Graph API 호출 실패(타임아웃, 권한 오류, rate limit 등). `INSTAGRAM_GRAPH_ACCESS_TOKEN` 만료 의심. 아래 ["Graph API 토큰 라이프사이클"](#graph-api-토큰-라이프사이클) 섹션 참고.

- **`caption_parse_failed`** — 캡션에서 해시태그를 추출할 수 없음. 사용자의 캡션 양식이 문제이거나 파서 로직 버그. 단발성이면 사용자에게 올바른 캡션 양식을 안내. 반복 발생 시 파서 로직 검토.

- **`route_match_ambiguous`** — 캡션이 2개 이상의 Route와 매칭됨 (동명 Boulder/Route 충돌). 정상. 운영자가 웹훅 인박스에서 후보 중 정답을 선택하여 수동 매칭.

- **`duplicate_beta`** — 같은 `external_media_id`가 이미 `betas`에 등록됨. 웹훅 재전송 또는 사용자 중복 mention으로 유발. 통상 무해. 패턴이 잦으면 사용자 안내 메시지 개선.

- **`thumbnail_lookup_failed`** — oEmbed 또는 HTML 폴백 모두 실패하여 썸네일을 수집할 수 없음. Beta는 정상 등록되나 썸네일만 누락. 운영자 조치 불필요. 향후 사용자에게 수동 썸네일 업로드 기능 제공 검토.

- **`thumbnail_copy_failed`** — R2에 썸네일 업로드 중 실패. 인프라 문제(R2 S3 자격증명 만료, 네트워크 단절, 용량 부족). Beta는 생성되나 `thumbnail_url=NULL`. R2 권한, 네트워크, 버킷 설정 확인.

- **`needs_rehydration`** — 수동 매칭 대상 행에 `external_media_id`가 비어 있고 `raw_payload`에서 `media_id`를 추출할 수 없는 경우. 마이그레이션 `0005` 이전에 들어온 댓글 멘션 행에서 발생 가능. 운영자 대응: (a) Meta App Dashboard에서 동일 이벤트를 재배달하여 hydration 경로를 재실행하거나 (b) 거절 후 사용자에게 수동 등록 폼 안내.

### Graph API 토큰 라이프사이클

#### 토큰 수명

`INSTAGRAM_GRAPH_ACCESS_TOKEN`은 Meta에서 발급한 **Long-lived token** (60일 유효) 또는 **System User token** (무기한)이다. 출시 권장은 System User token — 갱신 SOP가 불필요.

#### 만료 추적 (Long-lived token 사용 시)

1. 발급 일자와 만료 예정일을 운영 문서 또는 비밀번호 매니저(1Password, Bitwarden 등)에 메모한다.
2. 만료 2주 전부터 갱신 준비를 시작한다.

#### 갱신 책임자

현재 **미정**이다. Phase 5 출시 전에 담당자를 지정하고 운영 절차를 확정한다.

#### 갱신 후 검증

토큰을 갱신한 후 다음을 확인한다:

1. `/admin/webhooks` 운영 이벤트 패널에서 `error_code='graph_api_failure'`가 즉시 사라지는지 확인.
2. 테스트 Instagram 계정에서 Route를 mention하는 새 영상 1건을 게시.
3. 웹훅이 정상적으로 수신되고 매칭이 완료되는지 확인.

#### 향후 자동화 (Phase 6+)

Phase 6의 OAuth 인프라(Kakao/Naver/Google/Apple) 위에 Facebook Login을 추가하여 admin 페이지에서 직접 토큰을 재발급하는 UI 도입 예정. 그 시점에 본 섹션을 갱신한다.

### 개인정보·저장 정책

#### Webhook Raw Payload 보관

`webhook_inbox.raw_payload`는 디버깅 및 매칭 진단 목적으로 원본 Meta 페이로드를 JSON 형태로 보관한다.

- **보관 기간**: 운영 정책에 따른다 (출시 전 확정 필요). 예: 90일, 6개월, 무제한 등.
- **접근 제한**: 운영자만 `/admin/webhooks` 상세 패널에서 확인 가능.

#### Unclaimed Beta의 User 소유권

Phase 5에서 생성되는 Beta는 `user_id = NULL`로 저장된다. 즉, **무주 상태**다.

- 소유권 귀속(클레임)은 Phase 6 사용자 로그인 흐름에서 처리된다.
- Phase 5 운영자 모더레이션은 `status` 관리에만 집중한다.

### Phase 5 Retry 정책

**자동 재시도 없음.** Phase 5에는 웹훅 처리 실패에 대한 자동 재처리 메커니즘이 없다.

운영자는 실패한 웹훅에 대해 다음 중 하나를 선택한다:

1. **Meta App Dashboard 재전송**: Webhooks 설정에서 failed 이벤트 목록을 확인하고 수동 재전송.
2. **수동 거절**: 더 이상 처리할 가치가 없으면 거절.
3. **수동 등록**: `/admin/betas` "수동 등록" 폼에서 정보를 다시 입력하여 등록.

**향후 검토**: Phase 6 이후 자동 재시도, 배치 처리, 또는 고급 모니터링 도구 추가를 검토한다.
