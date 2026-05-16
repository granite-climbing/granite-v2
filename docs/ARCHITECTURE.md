# Granite v2 — Architecture

> 작성일: 2026-05-13  
> 상태: Draft  
> 기준 설계: `docs/superpowers/specs/2026-05-13-granite-design.md`

본 문서는 `docs/PRD.md`의 요구사항과 `docs/decisions/`의 의사결정을 만족하는 Granite v2의 구체 설계다.

## 1. 시스템 개요

```
[Mobile Browser]
  ├─ Next.js RSC/Client Components
  ├─ Kakao Map JavaScript SDK
  └─ next/image custom loader
       │
       ▼
[Vercel Functions: Node runtime, icn1]
  ├─ RSC 렌더링
  ├─ Server Actions: 사용자/관리자 mutation
  ├─ Route Handlers: OAuth callback, healthz
  └─ unstable_cache + tag invalidation
       │
       ├── Cloudflare D1 HTTP API
       ├── Cloudflare R2 S3 API
       └── Cloudflare CDN + Image Resizing

[Meta Webhook]
  └── Cloudflare Worker /webhooks/instagram
        └─ HMAC 검증 → WebhookInbox 저장 → Route 매칭 → Beta 생성
```

CRUD API를 줄이는 것이 목표이므로 관리자/사용자 mutation은 Server Actions가 담당한다. Cloudflare Worker는 Instagram 웹훅, 썸네일 재시도, scheduled job, R2/CDN 보조 엔드포인트처럼 외부 콜백·비동기·Cloudflare 인접성이 명확한 작업에만 사용한다.

## 2. 단계별 아키텍처

### Phase 1 — 탐색/관리자 CRUD

- 공개 탐색 화면, Crag 상세(Info/Sector/Boulder/Route/Map/Travel), Sector/Route 상세, Crag/Sector Map 탭을 구현한다.
- 관리자 인증, 콘텐츠 CRUD, 이미지 업로드, 공지 관리를 구현한다.
- 일반 사용자 계정과 개인화 데이터는 만들지 않는다.

### Phase 2 — 베타/Instagram 웹훅

- Instagram 멘션 웹훅을 수신하고 raw payload를 `webhook_inbox`에 저장한다.
- 캡션 매칭 키로 Route를 찾고 `user_id = NULL`인 unclaimed Beta를 생성한다.
- 로그인 없이 Instagram/YouTube 링크와 표시명/Instagram 핸들로 수동 Beta를 등록한다.
- 관리자 웹훅 인박스와 베타 모더레이션을 제공한다.
- 수동 Beta도 unclaimed 상태로 저장하고 Phase 3 클레임 대상이 된다.

### Phase 3 — 로그인/즐겨찾기/클레임

- Kakao/Naver/Google/Apple OAuth, 사용자 세션, 마이페이지를 추가한다.
- Route 즐겨찾기 기반 프로젝트 탭과 본인 Beta 관리 UI를 추가한다.
- Instagram 핸들 기준 unclaimed Beta 클레임을 추가하되 사칭 리스크를 고려해 관리자 검토 또는 소유 증명 확장이 가능하게 둔다.
- 관리자 영역에 다음을 추가한다.
  - 회원 목록/검색 (`/admin/users`)
  - Region/Area 시드 관리 GUI
  - 통계 대시보드 (Crag/Sector/Boulder/Route 카운트, Beta 수집·매칭률, 사용자 가입 추이)
  - 공지/배너 관리 확장 (기간 노출, 우선순위)
  - 캡션 템플릿 GUI ([§8.2](#82-매칭) 캡션 포맷을 운영자가 직접 편집)

## 3. 런타임 & 배포

- **Framework**: Next.js App Router
- **Web App Runtime/Deploy**: Vercel Functions Node runtime, `icn1`
- **Worker Runtime/Deploy**: Cloudflare Workers production/preview
- **Database**: Cloudflare D1 via HTTP API
- **Object Storage**: Cloudflare R2 via S3 compatible SDK
- **Image Delivery**: Cloudflare CDN + Image Resizing
- **Worker**: Instagram webhook, thumbnail retry, scheduled jobs
- **Domain**: `granite.kr`, `cdn.granite.kr`

### 환경

| 환경 | 구성 |
|------|------|
| local | `pnpm dev`, Worker dev(wrangler), D1 local/preview, R2 mock/preview |
| preview | Vercel Preview, Cloudflare Worker preview, D1 preview DB, R2 preview bucket |
| production | Vercel Production, Cloudflare Worker production, D1 prod DB, R2 prod bucket |

### 주요 명령

```bash
pnpm install
pnpm dev
pnpm wrangler d1 migrations apply granite --local
pnpm vercel deploy
pnpm vercel deploy --prod
pnpm wrangler deploy
```

## 4. URL 라우팅 & 디렉터리 구조

### 4.1 라우트 표

| 경로 | 종류 | 설명 | Phase |
|------|------|------|:-----:|
| `/` | Public | 홈 (탐색 메인, 지도 아님) | 1 |
| `/c/<crag-slug>` | Public | Crag 상세 (탭: Info/Sector/Boulder/Route/Map/Travel) | 1 |
| `/c/<crag-slug>/s/<sector-slug>` | Public | Sector 상세 (탭: Info/Boulder/Route/Map/Travel, 해당 Sector 범위) | 1 |
| `/c/<crag-slug>/b/<boulder-id>` | Public | Boulder 바텀시트 딥링크 | 1 |
| `/r/<route-id>` | Public | Route 상세 (공유 링크용) | 1 |
| `/login` | Public | 로그인 (provider 선택) | 3 |
| `/me` | Auth | 마이페이지 | 3 |
| `/me/records` | Auth | 내 기록 탭 | 3 |
| `/me/projects` | Auth | 프로젝트(저장한 Route) 탭 | 3 |
| `/u/<user-id>` | Public | 타 사용자 공개 프로필 | 3 |
| `/admin/login` | Public | 관리자 로그인 | 1 |
| `/admin/content/...` | Admin | Area/Crag/Sector/Boulder/Topo/Route CRUD | 1 |
| `/admin/announcements` | Admin | 공지 CRUD | 1 |
| `/admin/webhooks` | Admin | 웹훅 인박스 (unmatched/manual_matched/rejected) | 2 |
| `/admin/betas` | Admin | 베타 모더레이션 | 2 |
| `/admin/users` | Admin | 회원 목록/검색 | 3 |
| `/admin/stats` | Admin | 통계 대시보드 | 3 |
| `/api/auth/callback/[provider]` | Route Handler | OAuth 콜백 (kakao/naver/google/apple) | 3 |
| `/healthz` | Route Handler | 헬스체크 (DB 핑 포함) | 1 |
| `/webhooks/instagram` (Worker) | Cloudflare Worker | Meta 웹훅 GET 검증 + POST 수신 | 2 |
| `/jobs/thumbnails/retry` (Worker) | Cloudflare Worker | 썸네일 재시도 작업 | 2 |

### 4.2 슬러그 정책

- Area/Crag/Sector는 **슬러그** 기반(`/c/<crag-slug>/s/<sector-slug>`).
- Boulder/Route는 **ID** 기반. 이름 변경 시 링크 안정성 확보.
- 관리자 영역(`/admin/*`)은 슬러그/ID 혼용 가능 (운영 편의 우선).

### 4.3 디렉터리 구조

```
app/
├── (public)/
│   └── page.tsx
├── c/[cragSlug]/
│   ├── page.tsx
│   ├── s/[sectorSlug]/page.tsx
│   └── b/[boulderId]/page.tsx
├── r/[routeId]/page.tsx
├── me/
│   ├── page.tsx
│   ├── records/page.tsx
│   └── projects/page.tsx
├── admin/
│   ├── login/page.tsx
│   ├── layout.tsx
│   ├── content/...
│   ├── webhooks/page.tsx
│   └── betas/page.tsx
├── api/
│   └── auth/callback/[provider]/route.ts
├── healthz/route.ts
└── layout.tsx

components/
├── admin/
├── auth/
├── beta/
├── content/
├── layout/
├── map/
└── ui/

lib/
├── actions/
├── auth/
├── db/
├── instagram/
├── kakao/
├── r2/
├── session/
└── validation/

workers/
└── instagram-webhook/
    └── src/index.ts

migrations/
public/
docs/
```

## 5. 데이터 모델

### 5.1 ERD

```
areas ──< crags ──< sectors ──< boulders ──< topos ──< routes
                                                          │
users ──< betas >─────────────────────────────────────────┘
  │
  ├──< user_oauth_identities
  └──< favorites

webhook_inbox
announcements
admins
admin_audit_logs
```

### 5.2 핵심 테이블

#### 콘텐츠

- `areas`: `id`, `name`, `slug`, `sort_order`
- `crags`: `id`, `area_id`, `name`, `slug`, `lat`, `lng`, `summary`, `access_desc`, `parking_desc`, `season`, `cover_image_url`, `is_published`
- `sectors`: `id`, `crag_id`, `name`, `slug`, `lat`, `lng`, `summary`, `access_desc`, `parking_desc`, `season`, `cover_image_url`, `is_published`
- `boulders`: `id`, `sector_id`, `name`, `slug`, `lat`, `lng`, `coord_precision`, `rock_type`, `hashtags`, `cover_image_url`, `is_published`
- `topos`: `id`, `boulder_id`, `name`, `base_image_url`, `sort_order`
- `routes`: `id`, `topo_id`, `boulder_id`, `name`, `slug`, `grade`, `grade_num`, `fa`, `description`, `line_image_url`, `is_published`

이미지는 전용 polymorphic 테이블로 관리하지 않는다. R2/CDN 업로드 결과 URL을 각 엔티티의 `*_image_url` `TEXT` 컬럼에 저장한다. `boulders.hashtags`는 JSON 문자열 배열로 저장하고, 캡션 생성/매칭에는 정규화된 hashtag token을 사용한다.

#### 사용자/인증

- `users`: `id`, `display_name`, `email`, `instagram_id`, `height_cm`, `arm_span_cm`, `weight_kg`, `youtube_id`, `avatar_url`, 공개 범위 플래그, `deleted_at`
- `user_oauth_identities`: `id`, `user_id`, `provider`, `provider_uid`, `email_at_link`
- `admins`: `id`, `email`, `password_hash`, `display_name`, `is_active`

#### 활동/운영

- `betas`: `id`, `route_id`, `user_id`, `instagram_id`, `source`, `platform`, `media_url`, `thumbnail_url`, `sent_at`, `status`, `claim_status`
- `favorites`: `id`, `user_id`, `target_type`, `target_id`, `created_at`
- `webhook_inbox`: `id`, `provider`, `external_id`, `ig_user_id`, `ig_username`, `caption`, `media_url`, `thumbnail_url`, `matched_beta_id`, `status`, `raw_payload`, `received_at`
- `announcements`: `id`, `title`, `body`, `cover_image_url`, `crag_id`, `link_url`, `is_published`, `published_at`, `sort_order`
- `admin_audit_logs`: `id`, `admin_id`, `action`, `target_type`, `target_id`, `metadata`, `created_at`

#### Enum 값

| 컬럼 | 값 | 의미 |
|------|-----|------|
| `betas.source` | `manual` | 사용자 또는 관리자가 URL 입력으로 등록 |
| | `instagram_webhook` | Meta 웹훅 수신으로 자동 등록 |
| `betas.platform` | `instagram` | Instagram 게시물 |
| | `youtube` | YouTube 영상 |
| `betas.status` | `pending` | 등록 직후, 관리자 검수 전 |
| | `approved` | 공개 노출 가능 |
| | `hidden` | 관리자 숨김 (통계 제외, UI 비노출) |
| | `removed` | 관리자 삭제 (논리 삭제, audit 유지) |
| `betas.claim_status` | `unclaimed` | `user_id IS NULL` |
| | `claimed` | 사용자 IG 핸들로 자동 귀속됨 (MVP 기본) |
| | `verified` | 향후 IG OAuth 등 소유 증명 완료 |
| | `revoked` | 관리자가 잘못된 귀속을 무효화 |
| `webhook_inbox.status` | `received` | 수신 직후 |
| | `matched` | Route 자동 매칭 성공 → Beta 생성 |
| | `unmatched` | 후보 0개 또는 2개 이상 → 관리자 인박스 노출 |
| | `manual_matched` | 관리자가 수동으로 Route 연결 |
| | `rejected` | 관리자 거절 (스팸/부적합) |
| `favorites.target_type` | `crag`, `sector`, `boulder`, `route` | 즐겨찾기 대상 종류 (Topo 제외) |

`betas.status='approved'`만 공개 화면에 노출한다. `pending`은 관리자 미리보기에서만 보이고, `hidden`/`removed`는 통계와 UI에서 제외된다.

### 5.3 인덱스 원칙

- `areas.slug`, `crags.slug`, `(sectors.crag_id, sectors.slug)`는 unique다.
- `boulders(lat, lng)`는 Map 탭 marker 조회용 복합 인덱스를 둔다.
- `boulders.hashtags`는 JSON 문자열 배열로 저장하고, 필요 시 운영 검색용 보조 인덱스/FTS는 후속 단계에서 추가한다.
- `webhook_inbox.external_id`는 unique로 멱등 처리한다.
- `betas(route_id, status)`, `betas(instagram_id, user_id)`, `betas(platform, source)` 인덱스를 둔다.
- `favorites(user_id, target_type, target_id)`는 unique로 중복 저장을 막는다.

## 6. 데이터 액세스

### 6.1 D1 클라이언트

`lib/db/client.ts`는 D1 HTTP API 호출을 캡슐화한다.

```ts
export type D1QueryParams = readonly (string | number | boolean | null)[];

export async function queryD1<T>(
  sql: string,
  params: D1QueryParams = [],
): Promise<T[]> {
  // D1 HTTP API 호출, 에러 매핑, slow query logging
}
```

컴포넌트와 Server Actions는 SQL을 직접 작성하지 않고 `lib/db/queries/*` 또는 `lib/db/mutations/*`만 호출한다.

### 6.2 캐싱

| 자원 | 캐시 전략 |
|------|----------|
| 홈 데이터 | `unstable_cache`, tag `home`, `areas:list` |
| Crag 상세 | tag `crag:<id>` |
| Sector 상세 | tag `sector:<id>` |
| Boulder/Route | tag `boulder:<id>`, `route:<id>` |
| 관리자 데이터 | 캐시하지 않음 |
| 개인화 데이터 | 캐시하지 않음 |

Mutation 후 관련 tag를 무효화한다.

## 7. Server Actions, Route Handlers & Workers

### 7.1 Server Actions

- 관리자 콘텐츠 CRUD
- 이미지 업로드/삭제/정렬
- 공지 CRUD
- Phase 2 비로그인 수동 Beta 등록
- Phase 3 사용자 프로필 수정
- Phase 3 favorite toggle
- Phase 3 본인 Beta 관리/삭제

모든 Server Action은 Zod 검증과 권한 검사를 먼저 수행한다.

### 7.2 Route Handlers

| 경로 | 목적 |
|------|------|
| `GET /healthz` | DB 핑 포함 헬스체크 |
| `GET /api/auth/callback/[provider]` | OAuth callback |

### 7.3 Cloudflare Worker endpoints

| 경로 | 목적 |
|------|------|
| `GET /webhooks/instagram` | Meta `hub.challenge` 검증 |
| `POST /webhooks/instagram` | Instagram 멘션 수신 |
| `POST /jobs/thumbnails/retry` | 썸네일 재시도 작업 |

## 8. Beta & Instagram

### 8.1 수신

1. GET 검증 요청은 `META_WEBHOOK_VERIFY_TOKEN`으로 검증하고 challenge를 반환한다.
2. POST 요청은 `X-Hub-Signature-256` HMAC을 `META_APP_SECRET`으로 검증한다.
3. `external_id`로 중복을 확인하고 `webhook_inbox`에 원본 payload를 저장한다.
4. 저장 후 빠르게 200을 반환한다.
5. 가능한 경우 같은 요청 내에서 Route 매칭과 Beta 생성을 시도한다.

### 8.2 매칭

- 캡션 생성기는 `@granite.kr #<boulder_name> #<route_name> #<boulder_hashtag_1> #<boulder_hashtag_2>` 형식을 사용한다.

**캡션 본문 예시** (Route 상세 "인스타그램으로 공유"에서 생성):

```
방금 보냈어요! 🧗
[모락산] 계원예대 / 큰바위 / Sky Hook (V5)

@granite.kr #큰바위 #SkyHook #모락산 #슬랩
```

구성 요소:
- 1줄: 고정 인사 문구 (운영자가 캡션 템플릿에서 편집 가능, Phase 3)
- 2줄: `[<Crag>] <Sector> / <Boulder> / <Route> (<Grade>)`
- 4줄: `@granite.kr` 멘션 + `#<boulder_name>` + `#<route_name>` + `boulders.hashtags` 운영 해시태그

사용자는 캡션을 복사한 뒤 Instagram deep link로 이동해 그대로 게시한다.

- 매칭은 정규화된 hashtag token을 사용한다. 공백, 대소문자, 일부 특수문자를 제거하고 한글/영문/숫자 token만 비교한다.
- 1차 매칭은 `#<boulder_name>` + `#<route_name>` 조합으로 같은 Boulder의 Route를 찾는다.
- Boulder 운영 해시태그는 1차 후보 검증과 동명이인 disambiguation에 사용한다.
- 후보가 0개이거나 2개 이상이면 자동 생성하지 않고 `webhook_inbox.status = 'unmatched'`로 관리자 검토에 보낸다.

### 8.3 썸네일

- Beta 생성과 썸네일 수집은 분리 가능하게 설계한다.
- Phase 2에서는 동기 수집을 시도하고 실패 시 `thumbnail_url = NULL`로 둔다.
- 재시도는 Cloudflare Worker scheduled job 또는 queue를 우선 검토한다.

### 8.4 비로그인 수동 Beta

- Route 화면의 “베타 영상 올리기”에서 Instagram/YouTube URL, 표시명, Instagram 핸들, 완등 날짜를 입력한다.
- Server Action은 URL과 입력값을 검증하고 `user_id = NULL`, `source = 'manual'`, `platform = 'instagram' | 'youtube'`, `status = 'pending'` Beta를 생성한다.
- 관리자 승인 전에는 공개 노출하지 않거나 제한 노출한다.
- Phase 3 로그인 후 동일 Instagram 핸들의 unclaimed Beta를 클레임할 수 있다.

## 9. 인증

### 9.1 관리자

- `/admin/login`은 이메일+비밀번호를 검증한다. 비밀번호는 bcrypt 또는 Argon2 해시로 저장한다.
- 성공 시 `granite_admin` HttpOnly + Secure + SameSite=Lax cookie를 발급한다.
- JWT payload: `{ admin_id, exp }`. 서명 키는 `ADMIN_JWT_SECRET` (사용자 `JWT_SECRET`과 **별도 키**).
- 유효기간 14일 sliding. 매 요청 시 만료 임박이면 갱신.
- `/admin/*` layout/middleware가 1차 방어, Server Action 진입점의 `requireAdmin()`이 2차 방어한다.
- 관리자 계정 생성은 마이그레이션 또는 별도 CLI로만 수행하고, 셀프 회원가입은 없다.

### 9.2 사용자

Phase 3에서 Kakao/Naver/Google/Apple OAuth를 도입한다.

- OAuth callback은 `state` 파라미터를 검증해 CSRF를 방지한다.
- provider uid는 `user_oauth_identities(provider, provider_uid)`에 저장한다.
- 동일 이메일 계정은 머지 안내를 표시한다 (Apple Private Relay `privaterelay.appleid.com`은 자동 머지를 시도하지 않고 별도 계정 생성).
- 사용자 세션 쿠키: `granite_session`, HttpOnly + Secure + SameSite=Lax.
- JWT payload: `{ user_id, exp }`. 서명 키는 `JWT_SECRET`.
- 유효기간 30일 sliding. 로그아웃 = 쿠키 삭제.

### 9.3 인증 키 분리 원칙

| 항목 | 시크릿 | 쿠키 |
|------|--------|------|
| 사용자 세션 | `JWT_SECRET` | `granite_session` |
| 관리자 세션 | `ADMIN_JWT_SECRET` | `granite_admin` |

두 키는 절대 교환하지 않는다. 한쪽 시크릿 유출 시 폭발 범위가 다른 쪽으로 번지지 않게 한다.

## 10. 이미지 파이프라인

### 10.1 업로드

```
관리자/사용자 폼
  → Server Action
  → 파일 타입/크기 검증
  → EXIF 위치정보 제거
  → R2 PUT: {entityType}/{entityId}/{purpose}-{uuid}.{ext}
  → 엔티티의 `*_image_url` 컬럼 UPDATE
  → revalidateTag
```

### 10.2 서빙

클라이언트에는 `CDN_BASE_URL` 기반 URL만 전달한다.

```
https://cdn.granite.kr/cdn-cgi/image/width=800,format=auto,quality=80/<r2-key>
```

이미지 메타데이터 테이블은 두지 않는다. 원본 R2 URL과 credential은 노출하지 않는다.

## 11. 지도

- Kakao Map SDK는 client component leaf에서만 로드한다.
- Crag/Sector Map 탭은 해당 범위의 Boulder marker를 표시한다.
- marker가 많아지면 `MarkerClusterer`를 사용한다.
- marker 탭은 Boulder 바텀시트를 연다.
- 민감 스팟은 공개 정밀도 정책을 적용한 좌표만 클라이언트로 내려보낸다.

## 12. 개인정보/정책

서비스 UI는 다음 공개 URL의 원문을 파싱/이관해 내부 정적 페이지로 제공한다.

- 이용약관: `https://granite.kr/terms/`
- 개인정보처리방침: `https://granite.kr/privacy/`
- 데이터 삭제 안내: `https://granite.kr/data-deletion/`

Phase별 개인정보 처리:

- Phase 1: 일반 사용자 정보 없음. 관리자 계정 정보만 저장.
- Phase 2: Instagram 웹훅 payload, username/id, 수동 등록자의 표시명/핸들, Instagram/YouTube URL을 운영 목적 최소 범위로 저장.
- Phase 3: OAuth identity, 이메일, 표시 이름, Instagram 핸들, 선택 신체정보 저장.

삭제 원칙:

- 회원탈퇴 시 식별정보와 OAuth identity를 삭제한다.
- 사용자 생성 Beta는 정책에 따라 삭제 또는 익명화한다.
- 웹훅 raw payload는 보관 기간 정책을 정한 뒤 만료 삭제한다.

## 13. 관측성

- Vercel Analytics와 Vercel Logs를 기본으로 사용한다.
- D1 wrapper는 200ms 초과 쿼리를 로그한다.
- `webhook_inbox`는 웹훅 audit log로 사용한다.
- 관리자 주요 작업은 `admin_audit_logs`에 기록한다.
- Sentry/UptimeRobot은 Phase 2 이후 검토한다.

## 14. 마이그레이션

- 롤포워드 only.
- 컬럼 삭제/이름 변경은 `추가 → 코드 전환 → 삭제` 3단계로 진행한다.
- 관리자 계정 1개는 초기 migration 또는 별도 CLI로 생성한다.
- seed 데이터는 Area 5개부터 시작한다.

## 15. 비용/운영 가정

- Vercel Hobby/Pro 선택은 트래픽과 상업 사용 조건에 맞춰 확정한다.
- D1/R2는 초기 무료 또는 저비용 구간을 가정한다.
- Cloudflare Image Resizing 비용은 사용량/플랜 기준으로 배포 전 재검증한다.
- Kakao Map은 무료 쿼터 모니터링을 전제로 한다.

## 16. 환경 변수 / 시크릿

웹앱 시크릿은 Vercel Environment Variables에, Worker 시크릿과 Cloudflare 리소스 설정은 `wrangler.toml` 또는 `wrangler secret`에 저장한다. 도메인 제한이 의미 있는 키(카카오맵 등)는 콘솔에서 도메인 화이트리스트를 추가한다.

### 16.1 Vercel (웹앱)

| 키 | 용도 | Phase |
|----|------|:-----:|
| `D1_HTTP_URL` | D1 HTTP API 엔드포인트 | 1 |
| `D1_API_TOKEN` | D1 HTTP API 토큰 | 1 |
| `D1_DATABASE_ID` | D1 데이터베이스 ID | 1 |
| `R2_ACCESS_KEY_ID` | R2 S3 자격증명 | 1 |
| `R2_SECRET_ACCESS_KEY` | R2 S3 자격증명 | 1 |
| `R2_BUCKET` | R2 버킷명 | 1 |
| `R2_ENDPOINT` | R2 S3 엔드포인트 URL | 1 |
| `CDN_BASE_URL` | `https://cdn.granite.kr` | 1 |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 카카오맵 JS 키 (도메인 제한) | 1 |
| `ADMIN_JWT_SECRET` | 관리자 세션 서명 | 1 |
| `JWT_SECRET` | 사용자 세션 서명 | 3 |
| `KAKAO_OAUTH_CLIENT_ID` / `_SECRET` | 카카오 로그인 | 3 |
| `NAVER_OAUTH_CLIENT_ID` / `_SECRET` | 네이버 로그인 | 3 |
| `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` | 구글 로그인 | 3 |
| `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` / `APPLE_CLIENT_ID` | 애플 로그인 | 3 |

### 16.2 Cloudflare Worker

| 키 | 용도 | Phase |
|----|------|:-----:|
| `META_APP_ID` | Meta 앱 ID | 2 |
| `META_APP_SECRET` | `X-Hub-Signature-256` HMAC 검증 | 2 |
| `META_WEBHOOK_VERIFY_TOKEN` | `GET /webhooks/instagram` 검증 토큰 | 2 |
| D1 binding | Worker→D1 (`wrangler.toml`의 `[[d1_databases]]`) | 2 |
| R2 binding | Worker→R2 (`wrangler.toml`의 `[[r2_buckets]]`) | 2 |

### 16.3 비밀 회전 정책

- `ADMIN_JWT_SECRET`, `JWT_SECRET`은 정기 회전 대상. 회전 시 기존 세션 무효화 허용 가능 (재로그인 유도).
- OAuth client secret과 `META_APP_SECRET`은 provider 콘솔에서 회전하고 즉시 ENV에 반영.
- R2 자격증명은 read/write 분리 가능 시 분리한다 (Phase 2 이후 검토).

## 17. 미결 사항

- 캡션 해시태그 정규화 규칙과 동명 Boulder/Route 처리 정책
- 민감 스팟 좌표 정밀도 운영 기준
- unclaimed Beta 클레임 시 관리자 승인 필요 여부
- 웹훅 raw payload 보관 기간
- 실제 광고 연동 시점과 공급자
