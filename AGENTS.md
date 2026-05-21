# Granite

국내 자연 볼더링 스팟을 사용자들이 편하게 탐색·기록할 수 있는 모바일 웹앱.

## 프로젝트 개요

- **서비스명**: Granite (그래나이트)
- **도메인**: `granite.kr`
- **목적**: 한국 내 자연 볼더링(외벽 볼더) 스팟 정보를 탐색하고, 베타(완등) 기록을 연결한다.
- **사용자**: 자연 볼더링에 관심 있는 클라이머
- **현재 상태**: Phase 1 public UI baseline 진행 완료 기준 정리 중 (`phase1-implementation` 브랜치)
- **단일 설계 소스**: `docs/specs/2026-05-13-granite-design.md`

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js (App Router, **Server Actions** 중심) |
| 웹앱 런타임/배포 | Vercel Functions (Node runtime, `icn1` 서울 리전) |
| 보조 런타임/배포 | Cloudflare Workers (Instagram 웹훅, 썸네일 재시도, scheduled job, R2/CDN 보조 엔드포인트) |
| 데이터베이스 | Cloudflare D1 (SQLite, HTTP API 경로) |
| 오브젝트 스토리지 | Cloudflare R2 (S3 호환 SDK) |
| CDN/이미지 변환 | Cloudflare CDN + Image Resizing |
| 지도 | Kakao Map JavaScript SDK |
| 스타일 | Tailwind CSS |
| 언어 | TypeScript (strict) |

## 제품 단계

1. **Phase 1 — Public UI Baseline**
   - Area → Crag → Sector → Boulder → Topo → Route 콘텐츠 계층
   - 홈, Crag 상세(Info/Sector/Boulder/Route/Map/Travel), Topo 상세, Route 상세
   - Figma 기준 모바일 UI, 정책 페이지, mock/seed 데이터 기반 탐색
   - Admin/DB/R2/Instagram/OAuth는 완료 조건에 포함하지 않는다.
2. **Phase 2 — DB Migration & Data Layer**
   - D1 schema/migrations, seed/import 전략, D1 HTTP API client
   - public UI를 mock/seed 데이터에서 DB-backed read path로 전환
   - 공개 콘텐츠 캐싱과 `/healthz` DB ping
3. **Phase 3 — Admin Operations**
   - 관리자 인증, 콘텐츠 CRUD, 이미지 업로드, 공지 관리
   - R2/CDN URL 저장, revalidation, admin audit log
4. **Phase 4 — Beta / Instagram**
   - Instagram 멘션 웹훅 수신, WebhookInbox, Route 매칭, unclaimed Beta 생성
   - 비로그인 수동 베타 등록(Instagram/YouTube 링크)과 관리자 검수
   - 관리자 웹훅 인박스, 베타 모더레이션
5. **Phase 5 — Login / Favorites / Claims**
   - Kakao/Naver/Google/Apple OAuth, 세션, 마이페이지
   - Route 프로젝트(즐겨찾기), 내 기록 관리, unclaimed Beta 클레임

## 디렉터리 구조 (목표)

```
granite-v2/
├── app/
│   ├── (public)/
│   ├── c/[cragSlug]/
│   ├── r/[routeId]/
│   ├── me/                # Phase 5
│   ├── admin/             # Phase 3+
│   ├── api/
│   │   └── auth/callback/[provider]/
│   └── layout.tsx
├── components/
├── lib/
│   ├── actions/
│   ├── auth/
│   ├── db/
│   ├── kakao/
│   ├── r2/
│   └── validation/
├── migrations/
├── public/
├── workers/
│   └── instagram-webhook/
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   ├── decisions/
│   └── superpowers/
├── wrangler.toml
└── AGENTS.md
```

## 작업 원칙

### 데이터 액세스

- **Server Actions 우선**. REST/Route Handler는 OAuth 콜백, 헬스체크처럼 Next 앱 경계의 명확한 HTTP 계약이 필요한 경우에만 사용한다.
- D1 쿼리는 `lib/db/` 내부로 한정한다. 컴포넌트에서 직접 SQL을 쓰지 않는다.
- D1은 Vercel Node runtime에서 Cloudflare D1 HTTP API로 접근한다.
- 모든 mutation은 Server Action 또는 명시적 Route Handler를 통하고, 성공 후 `revalidatePath` 또는 `revalidateTag`를 호출한다.
- Cloudflare Worker는 일반 CRUD API를 만들기 위해 사용하지 않는다. Instagram 웹훅, 썸네일 재시도, scheduled job, R2/CDN 보조 엔드포인트처럼 외부 콜백·비동기·Cloudflare 인접성이 명확한 작업에만 둔다.
- DB 스키마 변경은 반드시 `migrations/`에 SQL 파일을 추가한다. 롤포워드 only.

### 이미지 처리

- 원본은 R2에 업로드하고, 클라이언트에는 `https://cdn.granite.kr/...` 형태의 CDN URL만 노출한다.
- `next/image`의 custom loader로 Cloudflare Image Resizing URL을 생성한다.
- 이미지 전용 polymorphic 테이블은 만들지 않는다. 각 엔티티에는 필요한 이미지 URL만 `TEXT` 컬럼으로 저장한다.
- R2 키는 `{entityType}/{entityId}/{purpose}-{uuid}.{ext}` 컨벤션을 사용한다.
- 업로드 시 EXIF 위치정보 제거와 이미지 크기/타입 검증을 수행한다.

### 좌표/지도

- DB에는 `lat`, `lng`를 WGS84 `REAL`로 저장한다. PostGIS류는 사용하지 않는다.
- Boulder 좌표는 필수이고, Crag/Sector 좌표는 선택이다.
- Boulder에는 캡션 생성/매칭용 운영 해시태그 목록을 저장한다.
- 민감 스팟은 `coord_precision` 또는 공개 정책으로 정밀 좌표 노출을 제한한다.
- 영역 검색은 bounding box(min/max lat·lng) 기반 1차 필터링 후 앱 레벨 거리 계산을 사용한다.
- 지도는 홈이 아니라 Crag/Sector 상세의 Map 탭에서 제공한다.

### 캐싱

- 공개 콘텐츠 조회는 `unstable_cache` + 태그 기반 무효화(`crag:<id>`, `sector:<id>`, `boulder:<id>`, `route:<id>`, `areas:list`, `home`)를 사용한다.
- 정적 자산과 이미지 변환 결과는 Cloudflare CDN 캐싱을 활용한다.
- 관리자/개인화 데이터는 공개 캐시에 넣지 않는다.

### 인증

- 관리자 인증은 사용자 인증과 분리한다. `/admin/login`은 이메일+비밀번호를 검증하고 `granite_admin` HttpOnly 쿠키를 발급한다. 운영 가능한 관리자 인증은 Phase 3 범위다.
- 사용자 OAuth는 Phase 5에서 Kakao/Naver/Google/Apple을 도입한다.
- 세션 쿠키는 HttpOnly + Secure + SameSite=Lax를 기본으로 한다.
- 관리자 Route Handler/Server Action 진입점에서는 `requireAdmin()`을 이중 방어로 호출한다.

### 베타/캡션

- Beta는 등록 방식(`source`: `manual` 또는 `instagram_webhook`)과 미디어 플랫폼(`platform`: `instagram` 또는 `youtube`)을 별도 컬럼으로 저장한다.
- Instagram 캡션은 `@granite.kr #볼더이름 #루트이름 #해시태그1 #해시태그2` 형식을 기본으로 한다.
- 자동 매칭은 정규화된 Boulder 이름 hashtag + Route 이름 hashtag 조합을 우선하고, Boulder 운영 해시태그는 후보 검증/동명이인 처리에 사용한다.

### 개인정보

- 정책 문서는 기존 공개 URL의 원문을 파싱/이관해 앱 내부 정적 페이지로 제공하고, 원본 URL도 참조로 유지한다.
  - 이용약관: `https://granite.kr/terms/`
  - 개인정보처리방침: `https://granite.kr/privacy/`
  - 데이터 삭제 안내: `https://granite.kr/data-deletion/`
- 수집 개인정보는 목적별 최소화한다. Phase 5 전까지 일반 사용자 계정 정보는 수집하지 않는다.
- Instagram 핸들 기반 unclaimed Beta는 소유권이 확인되기 전까지 사용자에게 자동 귀속하지 않는다.
- 회원탈퇴/데이터 삭제 요청 시 계정 식별정보는 삭제하고, 공개 콘텐츠 무결성에 필요한 기록은 익명화 정책을 따른다.

## 코딩 컨벤션

- TypeScript strict. `any` 금지. 불가피하면 근거 주석을 남긴다.
- Server Component 기본. 인터랙션이 필요한 leaf만 `"use client"`를 사용한다.
- Zod로 모든 외부 입력을 검증한다.
- SQL은 parameter binding을 사용한다.
- 커밋 메시지 접두어는 `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`를 사용한다.

## 환경 변수

웹앱 시크릿은 `.env.local` 또는 Vercel Environment Variables로 관리한다. Worker 시크릿과 Cloudflare 리소스 설정은 `wrangler.toml`/`wrangler secret`을 사용한다.

| 키 | 용도 |
|----|------|
| `D1_HTTP_URL` / `D1_API_TOKEN` / `D1_DATABASE_ID` | D1 HTTP API |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` / `R2_ENDPOINT` | R2 S3 호환 접근 |
| `CDN_BASE_URL` | 이미지 CDN 베이스 URL (`https://cdn.granite.kr`) |
| `JWT_SECRET` | 사용자 세션 |
| `ADMIN_JWT_SECRET` | 관리자 세션 |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 카카오 JS 키 (도메인 제한 필수) |
| `META_APP_ID` / `META_APP_SECRET` / `META_WEBHOOK_VERIFY_TOKEN` | Instagram 웹훅 |
| `KAKAO_OAUTH_CLIENT_ID` / `KAKAO_OAUTH_CLIENT_SECRET` | Kakao OAuth |
| `NAVER_OAUTH_CLIENT_ID` / `NAVER_OAUTH_CLIENT_SECRET` | Naver OAuth |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth |
| `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` / `APPLE_CLIENT_ID` | Apple OAuth |

## 개발/배포 명령 (예정)

```bash
pnpm install
pnpm dev
pnpm wrangler d1 migrations apply granite --local
pnpm vercel deploy
pnpm vercel deploy --prod
pnpm wrangler deploy
```

## 참고 문서

- 제품 요구사항: [docs/PRD.md](docs/PRD.md)
- 아키텍처 설계: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 단계별 로드맵: [docs/ROADMAP.md](docs/ROADMAP.md)
- 설계 결정 기록: [docs/decisions/README.md](docs/decisions/README.md)
- Granite v2 설계 원본: [docs/specs/2026-05-13-granite-design.md](docs/specs/2026-05-13-granite-design.md)
