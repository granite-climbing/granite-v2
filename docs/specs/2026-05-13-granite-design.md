# Granite v2 — Design Spec

> 작성일: 2026-05-13
> 상태: Draft (브레인스토밍 산출)
> 도메인: `granite.kr`
> 본 문서는 구현 계획(plan)으로 가기 전 합의된 설계의 단일 소스다. 후속 plan/PR은 본 문서를 참조한다.

---

## 1. 개요

**Granite v2**는 국내 자연 볼더링 스팟을 모바일 웹앱으로 탐색·기록할 수 있는 서비스. V1의 운영 경험을 바탕으로 콘텐츠 계층, 인스타그램 연동 베타(완등) 시스템, 4-Provider 소셜 로그인을 갖춘 재설계.

### 1.1 핵심 제품 결정

| 항목 | 결정 |
|------|------|
| 도메인 | `granite.kr` |
| 타겟 | 모바일 전용 (데스크톱은 max-width 480 컨테이너로 렌더) |
| 콘텐츠 입력 | 관리자 큐레이션만 (사용자 기여 X) |
| Phase 1 | 탐색/관리자 CRUD |
| Phase 2 | 베타/Instagram 웹훅 + 비로그인 수동 베타 + 관리자 검수 |
| Phase 3 | 로그인/즐겨찾기/내 기록/클레임 |
| 사용자 가치 | Phase 1 탐색, Phase 2 베타 데이터 수집, Phase 3 개인화 |
| 베타 수집 | Phase 2 자동(Instagram 웹훅) + 비로그인 수동(Instagram/YouTube URL), Phase 3 로그인 기반 관리 |
| 워딩 | 완등 = "베타" (Beta) |
| 통계 | Phase 2까지는 데이터 수집만, 분석 화면은 후속 후보 |
| 사용자 인증 | Phase 3에서 Kakao / Naver / Google / Apple OAuth |
| 관리자 인증 | 이메일+비밀번호 → ADMIN JWT (별도 키) |

### 1.2 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js (App Router, Server Actions 우선) |
| 웹앱 런타임/배포 | Vercel Functions (Node runtime, `icn1` 서울 리전) |
| 보조 런타임/배포 | Cloudflare Workers (Instagram 웹훅, 썸네일 재시도, scheduled job, R2/CDN 보조 엔드포인트) |
| 데이터베이스 | Cloudflare D1 (HTTP API 경로) |
| 오브젝트 스토리지 | Cloudflare R2 (S3 호환 SDK) |
| CDN/이미지 변환 | Cloudflare CDN + Image Resizing |
| 지도 | Kakao Map JavaScript SDK |
| 스타일 | Tailwind CSS |
| 언어 | TypeScript (strict) |

---

### 1.3 출시 단계

| 단계 | 범위 | 제외 |
|------|------|------|
| Phase 1 — 탐색/관리자 CRUD | 홈, Crag/Sector/Route 상세, Map 탭, 콘텐츠 CRUD, 이미지, 공지 | 일반 사용자 계정, 즐겨찾기, 베타 자동 수집 |
| Phase 2 — 베타/Instagram 웹훅 | 캡션 생성, IG 웹훅, 비로그인 수동 베타, WebhookInbox, unclaimed Beta, 관리자 매칭/모더레이션 | OAuth, 내 기록/프로젝트 |
| Phase 3 — 로그인/즐겨찾기/클레임 | OAuth, 세션, 마이페이지, 즐겨찾기, 내 기록, unclaimed Beta 클레임 | 커뮤니티/제보/결제 |

핵심 이유: 베타 수집은 `instagram_id`와 외부 영상 URL 기반 unclaimed 데이터로 먼저 운영할 수 있지만, 내 기록·프로젝트·클레임은 로그인/세션에 의존한다. 따라서 Phase 2는 수집/검수 파이프라인으로 제한하고, 사용자 개인화는 Phase 3에서 붙인다.

## 2. 콘텐츠 계층

```
Area ──< Crag ──< Sector ──< Boulder ──< Topo ──< Route
```

- **Area** (예: 수도권, 강원, 충청, 전라, 경상)
  - 시드 5개로 시작, 추가 가능. Enum 아닌 테이블 관리.
- **Crag** (예: 안양, 모락산)
  - Area에 1:N. 선택적 좌표(중심점).
- **Sector** (예: 감자, 조각, 계원예대, 볼더타운)
  - Crag에 1:N. 주차/접근/시즌 정보. 선택적 좌표(주차장 핀).
  - Sector는 운영상 주차·진입로가 같은 단위.
- **Boulder** (한 바위)
  - Sector에 1:N. **필수 좌표** — 지도의 주 마커.
- **Topo** (바위의 한 면)
  - Boulder에 1:N. 베이스 면 사진 1장.
- **Route** (라인)
  - Topo에 1:N. **라인이 베이크된 단일 이미지**, 이름, V등급. 베타가 붙는 단위.
  - 모든 UI 표기와 카운트 모두 "Route"로 통일 (예: "N routes · VX-VY").

### 2.1 URL 구조

```
/                                      홈 (탐색 메인 — 지도 아님)
/c/<crag-slug>                         Crag 상세 (탭: info|sector|boulder|route|map|travel)
/c/<crag-slug>/s/<sector-slug>         Sector 상세 (Crag_Boulder와 동일 레이아웃)
/c/<crag-slug>/b/<boulder-id>          Boulder 바텀시트 딥링크
/r/<route-id>                          Route 상세 (공유 링크용)
/me                                    마이페이지
/me/records                            기록 탭
/me/projects                           프로젝트(저장한 루트) 탭
/u/<user-id>                           타 사용자 프로필 (가입자만)
/login
/admin/...                             관리자 영역
```

- Crag/Sector까지 슬러그, Boulder/Route는 ID 기반(이름 변경 안정성).
- `/areas`, `/areas/<slug>` 제거 (홈의 Area 탭 필터로 대체).

---

## 3. 시스템 개요

```
[Mobile Browser]
   │ 카카오맵 SDK + Next.js 클라이언트
   │
   ▼
Vercel Functions (icn1, Next.js on Node)
   │  ├─ RSC 렌더 + Server Actions (사용자/관리자 mutation)
   │  └─ Route Handlers (OAuth 콜백, healthz 등 Next 세션 경계)
   │
   ├──► Cloudflare D1 (HTTP API + D1_API_TOKEN)
   ├──► Cloudflare R2 (S3 SDK + 자체 자격증명)
   └──► Cloudflare CDN + Image Resizing
              ▲
              │ (R2 origin)
              │
[Meta Webhook] ───► Cloudflare Worker /webhooks/instagram (HMAC 검증, 200 즉시 응답)
                              │
                              ▼
                  WebhookInbox 적재 → 캡션 파싱 → Beta 동기 생성
```

**원칙**
- **Server Actions 우선** — 사용자/관리자 mutation. Zod 검증 + 도메인 검증.
- **Route Handler 예외**: OAuth callback, health check처럼 Next 앱 경계가 필요한 HTTP 계약만.
- **Cloudflare Worker 예외**: Instagram 웹훅, 썸네일 재시도, scheduled job, R2/CDN 보조 엔드포인트. 일반 CRUD API는 만들지 않는다.
- **Edge runtime 불필요** — Vercel Node runtime 기본. (Apple JWT 서명 등 Node API 사용 가능)
- **읽기 최적화**: 90%+ 트래픽 GET → `unstable_cache` + revalidateTag 활용.

---

## 4. 데이터 모델 (ERD)

```
areas ──< crags ──< sectors ──< boulders ──< topos ──< routes
                                                          │
users ──< betas >─────────────────────────────────────────┘
  │
  ├──< user_oauth_identities (kakao|naver|google|apple)
  └──< favorites >── (crag | sector | boulder | route)

webhook_inbox (IG 멘션 원본 + 매칭 상태)
announcements (홈 New Updates 섹션 콘텐츠)
admins        (운영진 계정)
```

### 4.1 엔티티 요약

**콘텐츠 계층**

| 엔티티 | 핵심 속성 | 비고 |
|--------|----------|------|
| Area | name, slug, sort_order | 시드 5개, 추가 가능 |
| Crag | area, name, slug, lat?, lng?, summary, cover_image_url, is_published | 좌표 선택 |
| Sector | crag, name, slug, lat?, lng?, access/parking/season, cover_image_url, is_published | 좌표 선택 (주차 핀) |
| Boulder | sector, name, slug, **lat, lng**, rock_type, hashtags, cover_image_url, is_published | 지도 마커 단위. `hashtags`는 JSON 문자열 배열 |
| Topo | boulder, name, base_image_url, sort_order | 보울더의 한 면 |
| Route | topo, boulder(비정규화), name, slug, grade, fa, description, line_image_url, is_published | 베타가 붙는 단위 |

**사용자/인증**

| 엔티티 | 핵심 속성 | 비고 |
|--------|----------|------|
| User | display_name, email?, **instagram_id (unique)**, height_cm?, arm_span_cm?, weight_kg?, youtube_id?, avatar_url | IG 핸들이 클레임 키 |
| UserOAuthIdentity | user, provider, provider_uid, email_at_link | 다수 provider 연결 가능 |
| Admin | email, password_hash, display_name, is_active | JWT 발급 대상 |

**활동/소셜**

| 엔티티 | 핵심 속성 | 비고 |
|--------|----------|------|
| Beta | route, **user?**, **instagram_id**, source(manual\|instagram_webhook), platform(instagram\|youtube), media_url, thumbnail_url, sent_at, status, claim_status? | user nullable = unclaimed |
| Favorite | user, target_type(crag\|sector\|boulder\|route), target_id | Topo는 제외 |

**시스템/운영**

| 엔티티 | 핵심 속성 | 비고 |
|--------|----------|------|
| WebhookInbox | provider, external_id(unique), ig_user_id, ig_username, caption, media/thumbnail, matched_beta?, status, raw_payload, received_at | IG 멱등 + 인박스 |
| Announcement | title, body, cover_image_url?, crag?(FK), link_url?, is_published, published_at, sort_order | 홈 New Updates 카드 |

### 4.2 정책

- **ID**: Area는 정수 PK, 나머지는 ULID(시간 정렬 가능).
- **언클레임 베타**: `Beta.user_id = NULL` + `instagram_id` 보존. 가입/IG 핸들 등록 시 일괄 클레임.
- **Beta source/platform**: `source`는 등록 방식(`manual`, `instagram_webhook`), `platform`은 미디어 플랫폼(`instagram`, `youtube`)을 의미한다.
- **이미지 저장**: 별도 polymorphic 이미지 테이블 없이 각 엔티티에 필요한 이미지 URL만 `TEXT` 컬럼으로 저장. R2 키 컨벤션은 `{entityType}/{entityId}/{purpose}-{uuid}.{ext}`.
- **즐겨찾기 polymorphic**: 컬럼 분리 방식 (`target_type` + `target_id`).
- **웹훅 멱등**: `WebhookInbox.external_id` UNIQUE.

---

## 5. 인증 & 계정

### 5.1 사용자 인증

**Provider**: Kakao, Naver, Google, Apple

**로그인 흐름 (공통)**
1. 로그인 페이지에서 provider 선택 → OAuth 동의 → 콜백
2. `provider_uid`로 `UserOAuthIdentity` 조회
3. 있으면 세션 발급, 없으면 신규 가입 플로우

**신규 가입**
1. 필수 입력: 표시 이름, 인스타그램 핸들
2. 선택 입력: 키(cm), 암스팬(cm), 아바타
3. 동일 이메일 기존 계정 있으면 머지 안내
4. 완료 시 `instagram_id` 일치하는 unclaimed 베타 자동 클레임

**Provider 주의**
- **Apple**: 첫 로그인에만 이메일/이름 전달 — 그 시점에 반드시 저장.
- **Naver**: 비즈니스 서비스 검수 필요. 일정 여유.
- **Kakao**: `account_email`, `profile_nickname`만 요청.
- **Google**: 기본 OpenID 스코프.

### 5.2 계정 머지

- 신규 OAuth 콜백 시점에 동일 이메일 기존 유저 발견 → 머지 안내
- 동의 시 기존 user에 `UserOAuthIdentity` 추가 (계정 1개, 로그인 방법 N개)
- Apple Private Relay (`privaterelay.appleid.com`) → 머지 시도 안 함, 별도 계정 생성
- 마이페이지에서 다른 provider 연동/해제 가능

### 5.3 세션

- HttpOnly + Secure + SameSite=Lax 쿠키
- 서명된 JWT (payload: user_id, exp), `JWT_SECRET` 사용
- 유효기간 30일 sliding
- 로그아웃 = 쿠키 삭제

### 5.4 관리자 인증 (분리)

- `/admin/login`: 이메일+비밀번호 → bcrypt 비교
- 통과 시 별도 JWT 발급 → `granite_admin` 쿠키 (HttpOnly), `ADMIN_JWT_SECRET` 별도 키
- `/admin/*` 미들웨어 검증 + Server Action 진입점에서 `requireAdmin()` 이중 방어
- 관리자 계정 생성은 마이그레이션/CLI로만

### 5.5 인가 매트릭스

| 작업 | 비로그인 | 일반 유저 | 관리자 |
|------|---------|----------|--------|
| 콘텐츠 열람 | ✅ | ✅ | ✅ |
| 즐겨찾기 | ❌ | ✅ | ✅ |
| 수동 베타 등록 | ✅ | ✅ | ✅ |
| 자기 베타 삭제 | — | ✅ | ✅ |
| 캡션 복사 → IG 공유 | ✅ | ✅ | ✅ |
| 콘텐츠 CRUD | ❌ | ❌ | ✅ |
| 베타 모더레이션 | ❌ | ❌ | ✅ |
| 웹훅 인박스 | ❌ | ❌ | ✅ |

---

## 6. 베타(Beta) 시스템

### 6.1 수동 베타 (기록 추가)

> Phase 2 범위. 로그인 없이 Instagram/YouTube 링크 기반 unclaimed Beta를 생성하고, Phase 3에서 로그인 사용자에게 귀속/관리 기능을 제공한다.

- **진입점 A (Phase 2)**: Route 바텀시트 → [beta] 버튼 → "베타 영상 올리기" → 모달
- **진입점 B (Phase 3)**: 기록 탭 → "기록 추가 +" → 모달 (루트명 검색 + 날짜 + 영상 URL)
- Phase 2 입력: Instagram/YouTube URL, 표시명, Instagram 핸들, 완등 날짜
- `Beta(source=manual, platform=instagram|youtube, user_id=NULL, instagram_id=입력 핸들, status='pending')` 생성
- 관리자 승인 전에는 공개 노출하지 않거나 제한 노출한다.

### 6.2 인스타 공유 (캡션 생성기)

Route 상세에 항상 노출. 로그인/비로그인 무관.

흐름:
1. "인스타그램으로 공유" 탭
2. 앱이 캡션 생성 → 예시:
   ```
   방금 보냈어요! 🧗
   [모락산] 계원예대 / 큰바위 / Sky Hook (V5)

   @granite.kr #큰바위 #SkyHook #모락산 #슬랩
   ```
3. 캡션 복사 + 인스타 deep link → 사용자가 IG에 게시
4. Meta가 `granite.kr` 멘션 감지 → 우리 웹훅으로 전송

**매칭 키**: `@granite.kr` 멘션 + `#<boulder_name>` + `#<route_name>` 조합을 기본값으로 한다. Boulder의 운영 해시태그(`boulders.hashtags`)는 후보 검증과 동명이인 disambiguation에 사용한다.

### 6.3 웹훅 수신

**경로**: `POST /webhooks/instagram` (Cloudflare Worker — Server Action 아님)

이유: Server Action은 공개 안정 URL/계약이 없고, Meta는 GET 검증(`hub.challenge`) + POST JSON + HMAC 헤더가 필요하다. 웹훅은 Cloudflare Worker로 분리해 빠른 ACK, HMAC 검증, D1/R2 인접 처리를 담당한다.

**책임**
1. `X-Hub-Signature-256` HMAC 검증 (`META_APP_SECRET`)
2. `external_id`(IG media id) 멱등 체크
3. `WebhookInbox` INSERT (raw payload 보존)
4. 빠르게 200 응답
5. 매칭 동기 처리 (1건 < 50ms 예상)

**매칭 로직**
1. 캡션에서 멘션 `@granite.kr`와 hashtag token 목록 추출
2. token 정규화(공백 제거, 대소문자 통일, 일부 특수문자 제거)
3. `#<boulder_name>` + `#<route_name>` 조합으로 같은 Boulder의 Route 후보 조회
4. Boulder 운영 해시태그가 포함되어 있으면 후보 검증/동명이인 disambiguation에 사용
5. 후보가 정확히 1개면 `Beta` 생성 (user는 `instagram_id`로 lookup, 없으면 NULL)
6. 후보가 0개 또는 2개 이상이면 `WebhookInbox.status = 'unmatched'` (관리자 인박스 노출)

### 6.4 썸네일 파이프라인

외부 URL을 직접 노출하지 않고 R2에 자체 저장:

```
media_url (IG/YouTube)
    ↓ oEmbed 또는 og:image 크롤링
thumbnail src URL
    ↓ fetch
R2 PUT (betas/<betaId>/thumb.<ext>)
    ↓
Beta.thumbnail_url 업데이트
    ↓
CDN URL로 서빙
```

- Phase 2에서는 베타 생성 후 **동기 시도**한다. 실패해도 Beta는 유지한다.
  - 재시도와 보장성이 필요한 작업은 Cloudflare Worker scheduled job/queue + `pending_thumbnails` 컬럼이 더 안전하다.
- 실패해도 베타 자체는 살아남고 `thumbnail_url = NULL` → UI는 기본 이미지.
- Phase 2 후속: Cloudflare Worker scheduled job 또는 Cloudflare Queues.

### 6.5 관리자 웹훅 인박스

- `/admin/webhooks`: `unmatched` 목록
- 행 별 액션: Route Picker로 수동 매칭 (`status='manual_matched'`) / 거절(`rejected`)

### 6.6 클레임

> Phase 3 범위. Phase 2의 unclaimed Beta는 운영 데이터로만 축적한다.

- **자동 시점**: 가입 완료 직후, 마이페이지 `instagram_id` 변경/등록 직후
- 동작: `UPDATE betas SET user_id = ? WHERE instagram_id = ? AND user_id IS NULL`
- IG 핸들 검증: 형식 검증만으로 즉시 귀속하면 사칭 리스크가 있다. Phase 3에서는 관리자 검토 또는 IG OAuth/게시물 소유 증명으로 확장 가능한 상태값(`claim_status`)을 둔다.

### 6.7 베타 모더레이션

- `/admin/betas`: 최근/신고 베타 리스트
- 액션: 숨김(`hidden`, 통계 제외 + UI 숨김) / 삭제(`removed`)
- 일반 사용자는 자기 베타만 삭제 가능

---

## 7. 탐색 UX & 화면 설계

> Figma 기준: Ver.1(node 931:3206) / Ver.2(node 931:3208)
> **현재 채택 방향**: Ver.2를 기반으로 구현. Crag 상세는 Info/Sector/Boulder/Route/Map/Travel 탭 구조로 구현하고, Sector 상세는 Info/Boulder/Route/Map/Travel 범위 탭을 사용한다.

### 7.0 네비게이션 구조

**하단 탭바 (Bottom menubar)** — Ver.2에서 추가된 글로벌 네비게이션:

| 탭 | 경로 | 설명 |
|----|------|------|
| 홈 | `/` | 메인 탐색 화면 |
| 기록 | `/me/records` | 내 완등 기록 |
| 프로젝트 | `/me/projects` | 저장한 루트 |
| 마이 | `/me` | 프로필 설정 |

비로그인 시: 기록/프로젝트/마이 탭 탭 시 로그인 유도.

상단 네비게이션: 로고(좌측) + `icon_menu`(우측 햄버거). 햄버거 메뉴 항목: Home, Crag, Culture (Travel / Rock Trip 서브메뉴).

### 7.1 홈 (`/`)

**Ver.2 디자인 기준:**

```
[헤더: 로고 + 햄버거]
[Hero 배너 200px] — "DREAM to DREAM!" + 통계 (N CRAGS · N BOULDERS · N ROUTES)
[FIND YOUR NEXT DREAM! 타이틀]
[통합 검색바] — "문제, 볼더, 섹터, 암장, 난이도 검색"
[광고 배너 360×56]
[Area 필터 탭] — 수도권 | 충청 | 강원 | 전라 | 경상
[선택 Area 통계 카드] — 지역명 + (N Crags · N Sectors · N Boulders · N Routes) + V등급 분포 막대차트
[Crags 섹션] — 헤더("Crags" + "All →") + 가로 스크롤 카드 (270px, 커버이미지+이름+스탯+V분포 스파크라인)
[페이지 인디케이터 점]
[광고 배너]
[New Updates 섹션] — 가로 스크롤 카드 (커버이미지+제목+변경사항+날짜)
[광고 배너]
[업데이트 뉴스 리스트] — 제목 + arrow_right
[광고 배너]
[푸터]
```

- **지도는 홈이 아님**. 지도는 Crag 상세의 "Map" 탭에서만 노출.
- Area 탭 선택 시 해당 Area의 통계 카드와 Crag 목록 갱신.

### 7.2 Crag 상세 (`/c/<crag-slug>`)

탭 구조:

| 탭 | 내용 |
|----|------|
| **Info** | Crag 설명 + boulder/route 카운트 요약 카드 + 미니맵 + 주소/접근법 + 교통/주차 버튼 |
| **Sector** | Crag 내 Sector 리스트 (커버이미지 + 이름 + 접근/주차 요약 + "N boulders · N routes") |
| **Boulder** | Crag 내 Boulder 리스트 (커버이미지 216px + 이름 + "N routes · VX-VY") |
| **Route** | Crag 내 전체 Route 리스트 (검색바 + Route/Grade/Boulder 컬럼 테이블) |
| **Map** | 카카오맵 전체 영역 (Boulder 마커 표시) |
| **Travel** | 교통/여행 정보 게시물 리스트 (페이지네이션) |

헤더: Crag명(좌측, 폰트 36px) + 커버이미지(360×240, 그라데이션 오버레이) + 로고 + 햄버거.

### 7.3 Sector 상세 (`/c/<crag-slug>/s/<sector-slug>`)

**Figma 레퍼런스**: Ver.1 `Crag_Boulder` (node 477:1324) — Crag 상세와 동일한 레이아웃 구조 사용.

```
[헤더: 커버이미지(360×240) + 어두운 오버레이 + Sector명(Heading1, 28px) + 설명(Body3, 12px)]
[탭바: Info | Boulder | Route | Map | Travel]
[Boulder 리스트]
  └ 커버이미지(328×216, rounded-8) + Boulder명(Heading3, 20px/Bold) + "N routes · VX-VY"(Label1, 회색)
```

Sector 상세는 Crag 상세와 유사한 구조를 쓰되 Sector 탭은 제외한다. Info/Boulder/Route/Map/Travel은 Sector 내 Boulder/Route만 필터링한다.

### 7.4 Route 선택 바텀시트 (Crag_Boulder_볼더_루트 선택)

Boulder 카드 탭 → 하단에서 바텀시트 슬라이드업:

```
[드래그 핸들]
[Boulder명 N/M] — 좌우 arrow로 Topo 전환
[Topo 이미지 270px 전체폭]
[Road map 아이콘 버튼 — 우측 상단 원형]
───────────────────────────────────────
[번호 원 | Route 이름 | Boulder명 | V등급 | FA]
[번호 원 | Route 이름 | Boulder명 | V등급 | FA]
  ...
각 행 우측에 [beta] 버튼 (icon_video + "beta" 레이블, bg #E8E8E8, 72×24 rounded)
```

- 번호 원: 검정 배경, 흰 숫자 (Topo 이미지의 라인 번호와 대응).
- Beta 버튼 탭 → "베타 동영상" 바텀시트 오버레이.

### 7.5 베타 동영상 바텀시트 (Crag_Boulder_볼더_루트 선택_beta)

```
[어두운 오버레이 60%]
[흰색 바텀시트, rounded top-12]
  [드래그 핸들]
  [제목: "베타 동영상"] [×닫기]
  ─────────────────────────────
  [안내 문구: 캡션을 복사하여 인스타그램 게시물에 넣어주면 …]
  [캡션/해시태그 미리보기 박스 (bg #F7F8F8, rounded-10)]
  [캡션 복사하고 Instagram 열기] (full-width, rounded-999, bg #1A1A1A)
  [베타 영상 올리기] (full-width, rounded-999, bg #1A1A1A)
```

### 7.6 기록 탭 (`/me/records`)

```
[프로필 요약] — 아바타 + 닉네임 + @IG핸들 + 신체정보(키/암스팬/몸무게)
[통계 행] — 총 완등 N | 최고 그레이드 VX
[완등 기록 섹션] — V등급 분포 막대차트 + "기록 추가 +" 버튼
[최근 기록] — "Route명 · VX · Crag명" 리스트 + "All →"
[세부 분석 →] (Phase 2)
[광고 배너]
```

**기록 추가 모달** (`기록_기록추가`):
- 루트명 검색 (필수, icon_search)
- 완등 날짜 (필수, 날짜 피커 icon_calendar)
- 영상 추가 (선택, URL 입력)
- [저장] 버튼

### 7.7 프로젝트 탭 (`/me/projects`)

```
[검색바]
[저장한 루트] + 정렬 탭(최신순 | Grade | Crag)
[루트 카드] — Route명 + "VX · Crag명" + bookmark 아이콘
```

프로젝트 = 즐겨찾기의 **Route 전용** 뷰. DB는 Favorite 테이블 `target_type='route'`로 처리.

### 7.8 마이페이지 (`/me`)

```
[아바타(64px) + 수정 아이콘]
닉네임 · 이메일 · 로그인 방법 · 비밀번호 관리
─────────
공개여부 토글
Instagram 계정 (핸들 입력)
키 / 암스팬 / 몸무게 (각각 공개 토글)
기록 공개 토글 / 프로젝트 공개 토글
─────────
계정 연결
  Instagram ← instagram_id 핸들 입력 (연결됨/연결안됨)
  Youtube   ← youtube_id 채널 ID 직접 입력 (OAuth 없음)
─────────
사용 방식
  알림 설정 토글
─────────
서비스
  문의 / 약관·개인정보처리방침
─────────
로그인
  로그아웃 / 회원탈퇴
```

### 7.9 검색

- 통합 검색: "문제, 볼더, 섹터, 암장, 난이도 검색"
- D1 `LIKE %query%`로 충분 (전체 데이터 < 수천). FTS5는 Phase 2.
- 결과는 카테고리별 그룹핑 (Route / Boulder / Sector / Crag).

### 7.10 지도 (Crag Map 탭)

- **카카오맵은 Crag 상세 > Map 탭**에만 존재 (홈이 아님).
- 해당 Crag 내 Boulder 마커 표시.
- 줌아웃 클러스터링 (`MarkerClusterer`).
- 마커 탭 → Boulder 선택 바텀시트.

### 7.11 광고

**Ver.2 기준 배치:**
- 홈: 검색바 아래, Area 섹션 아래, New Updates 아래, 뉴스 리스트 아래 — 총 4개 슬롯 (360×56)
- 기록 탭: 하단 1개 슬롯
- 초기에는 빈 플레이스홀더(`bg-[#d9d9d9]`)로 렌더. 실제 광고 연동은 후속 단계.

### 7.12 데스크톱 처리

- max-width 480 컨테이너, 좌우 회색 패딩.
- 별도 디자인 분기 없음.

### 7.13 오프라인

- 초기: 브라우저 캐시 의존만.
- Phase 2: PWA로 사전 다운로드/오프라인 대응.

---

## 8. 관리자 페이지

### 8.1 Phase 1 포함 범위

- 콘텐츠 CRUD
  - Area 추가/이름 변경
  - Crag/Sector/Boulder/Topo/Route CRUD
  - 이미지 업로드/순서/삭제 (R2)
  - `is_published` 토글
- **공지(Announcement) CRUD** (홈 New Updates 콘텐츠 관리)

### 8.2 Phase 2 포함 범위

- **베타 모더레이션** (숨김/삭제)
- **웹훅 인박스** (unmatched 수동 매칭, rejected)

### 8.3 Phase 3 포함 범위

- 회원 목록/검색
- Region 시드 관리(GUI)
- 통계 대시보드
- 공지/배너
- 캡션 템플릿 GUI

---

## 9. 개인정보 & 정책

### 9.1 공개 정책 문서

서비스 내 푸터, 회원가입/로그인, 마이페이지, 회원탈퇴/삭제 안내 화면은 아래 기존 정책 문서 원문을 파싱/이관한 내부 정적 페이지로 제공한다. 원본 URL은 출처와 동기화 기준으로 유지한다.

| 문서 | URL |
|------|-----|
| 이용약관 | `https://granite.kr/terms/` |
| 개인정보처리방침 | `https://granite.kr/privacy/` |
| 데이터 삭제 안내 | `https://granite.kr/data-deletion/` |

### 9.2 단계별 수집 항목

| 단계 | 수집/저장 항목 | 목적 |
|------|----------------|------|
| Phase 1 | 관리자 이메일, 비밀번호 해시, 관리자 audit log | 관리자 인증/운영 추적 |
| Phase 2 | Instagram username/id, 게시물 id, caption, Instagram/YouTube media URL, thumbnail URL, raw webhook payload, 수동 등록 표시명/핸들 | 베타 수집, 중복 방지, 관리자 검수 |
| Phase 3 | OAuth provider uid, 이메일, 표시 이름, 아바타, Instagram 핸들 | 로그인, 계정 식별, Beta 클레임 |
| Phase 3 선택 | 키, 암스팬, 몸무게, YouTube ID | 프로필/기록 분석 기반 |

### 9.3 공개 범위

- 신체정보, 기록, 프로젝트는 기본 비공개를 우선한다.
- 사용자가 공개 토글을 켠 항목만 타 사용자 프로필(`/u/<user-id>`)에 노출한다.
- unclaimed Beta는 소유권 확인 전까지 특정 사용자 프로필에 자동 귀속하지 않는다.

### 9.4 삭제/탈퇴

- 회원탈퇴 시 OAuth identity, 세션, 프로필 식별정보는 삭제한다.
- 사용자가 직접 등록한 수동 Beta는 정책 문서 기준에 따라 삭제 또는 익명화한다.
- Instagram 웹훅 raw payload는 운영상 필요한 최소 기간만 보관하고 이후 삭제/익명화한다.

---

## 10. 배포 & 운영

### 10.1 환경

| 환경 | 인프라 |
|------|--------|
| local | Next.js dev + Worker dev(wrangler) + D1 로컬(wrangler) + R2 mock |
| preview | Vercel Preview + Cloudflare Worker preview + D1 (preview) + R2 (preview 버킷) |
| production | Vercel Production (`granite.kr`) + Cloudflare Worker production + D1 (prod) + R2 (prod) |

### 10.2 도메인

| 도메인 | 가리키는 곳 |
|--------|------------|
| `granite.kr` | Vercel Production |
| `cdn.granite.kr` | Cloudflare CDN + Image Resizing → R2 |

- DNS는 Cloudflare 위임.

### 10.3 시크릿

웹앱 시크릿은 Vercel Environment Variables로 관리한다. Worker 시크릿과 Cloudflare 리소스 설정은 `wrangler.toml`/`wrangler secret`으로 관리한다.

| 키 | 용도 |
|----|------|
| `D1_HTTP_URL` / `D1_API_TOKEN` / `D1_DATABASE_ID` | D1 HTTP API |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` / `R2_ENDPOINT` | R2 S3 |
| `CDN_BASE_URL` | `https://cdn.granite.kr` |
| `JWT_SECRET` | 사용자 세션 |
| `ADMIN_JWT_SECRET` | 관리자 세션 (별도 키) |
| `KAKAO_OAUTH_CLIENT_ID` / `SECRET` | 카카오 로그인 |
| `NAVER_OAUTH_CLIENT_ID` / `SECRET` | 네이버 로그인 |
| `GOOGLE_OAUTH_CLIENT_ID` / `SECRET` | 구글 로그인 |
| `APPLE_TEAM_ID` / `KEY_ID` / `PRIVATE_KEY` / `CLIENT_ID` | 애플 로그인 |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 카카오맵 JS (도메인 제한) |
| `META_APP_ID` / `META_APP_SECRET` / `META_WEBHOOK_VERIFY_TOKEN` | IG 웹훅 |

### 10.4 마이그레이션

- 롤포워드 only. 컬럼 삭제/이름변경은 3단계로 분리 (추가 → 코드 전환 → 삭제).
- 배포 전 `wrangler d1 migrations apply` 수동/CI 선행.

### 10.5 백업

- D1: 일 1회 export → R2 백업 버킷 (`granite-backup`), 7일 보관.
- R2: 자체 복제. 추가 백업 없음.

### 10.6 관측성

- Vercel Analytics + Vercel Logs (30일).
- 슬로우 쿼리: DB 래퍼에서 `console.log` (>200ms).
- 웹훅 audit: `webhook_inbox` 테이블 자체가 audit log.
- Sentry/UptimeRobot은 Phase 2에서 검토.

### 10.7 헬스체크 / 외부 콜백

- `GET /healthz` — DB 핑 포함
- `GET /webhooks/instagram` — Cloudflare Worker, Meta hub.challenge 에코
- `POST /webhooks/instagram` — Cloudflare Worker, IG 멘션 수신
- `GET /api/auth/callback/<provider>` — OAuth 콜백 (4종)

### 10.8 비용 (초기 가정, 월별)

| 항목 | 예상 |
|------|------|
| Vercel | 플랜/상업 사용 조건 재검증 필요 |
| Cloudflare D1 | 초기 Free/저비용 가정 |
| Cloudflare R2 | 초기 Free/저비용 가정 |
| Image Resizing | Cloudflare 플랜/사용량 기준 재검증 필요 |
| 카카오맵 | $0 |
| 도메인 `.kr` | ~$20/년 |
| **합계** | **런칭 전 실제 플랜 기준 재산정** |

### 10.9 런칭 체크리스트

**Phase 1**
- [ ] `granite.kr` 등록 + Cloudflare DNS
- [ ] `cdn.granite.kr` Cloudflare CDN/Image Resizing/R2 origin 설정
- [ ] 카카오맵 키 + 도메인 제한
- [ ] D1/R2 production 리소스 생성
- [ ] 관리자 계정 1개 마이그레이션으로 생성

**Phase 2**
- [ ] Instagram 비즈니스 계정 + Meta 앱 + 웹훅 구독 + 검수
- [ ] `META_APP_SECRET` 기반 HMAC 검증 테스트

**Phase 3**
- [ ] OAuth 4종 앱 등록 + 리다이렉트 URL
- [ ] 정책 문서 링크가 회원가입/마이페이지/탈퇴 플로우에 노출되는지 확인

---

## 11. 후속 후보

- 통계 화면 (Route 완등자 분포, 개인 스타일 분석, 협업 필터링 추천)
- PWA + 오프라인 캐시
- IG OAuth 소유 증명
- 캡션 템플릿 GUI
- 네이버 외 추가 provider
- 회원 모더레이션 GUI
- 백그라운드 잡 큐 (썸네일 재시도, 통계 집계)
- 검색 강화 (FTS5)
- D1 → Postgres 마이그레이션 검토 (스팟 > 100k 등)
- Sentry, UptimeRobot

---

## 12. 미결 (Open Issues)

| 항목 | 상태 |
|------|------|
| Figma 디자인 접근 | ✅ 해결됨 (figma-remote-mcp OAuth 인증 완료, Ver.1/Ver.2 확인) |
| 캡션 해시태그 정규화 규칙 | Boulder/Route 이름 중복과 특수문자 처리 정책 확정 필요 |
| Instagram Business 검수 일정 | Meta 앱 검수가 출시 일정 영향 가능 |
| Naver OAuth 검수 일정 | 비즈니스 인증 절차 검토 필요 |
| unclaimed Beta 클레임 정책 | 관리자 승인 필요 여부 확정 필요 |
| 웹훅 raw payload 보관 기간 | 개인정보처리방침과 맞춰 기간 확정 필요 |

---

## 13. 참고 문서

- [CLAUDE.md](../../../CLAUDE.md) — 작업 원칙·컨벤션
- [docs/PRD.md](../../PRD.md) — 제품 요구사항
- [docs/decisions/](../../decisions/README.md) — 의사결정 기록(ADR)
- [docs/ROADMAP.md](../../ROADMAP.md) — 출시 로드맵
- [docs/ARCHITECTURE.md](../../ARCHITECTURE.md) — 본 문서와 동기화된 구체 아키텍처
