# Granite v2

Granite는 국내 자연 볼더링 스팟을 모바일 웹에서 탐색하고 운영하기 위한 서비스입니다. Area부터 Route까지 이어지는 콘텐츠 계층을 정리하고, Route 단위로 베타 기록을 연결하며, 운영자가 콘텐츠와 이미지, 베타 검수 흐름을 관리할 수 있게 합니다.

상세한 제품 요구사항과 아키텍처 기준은 `docs/`에 있습니다. 이 README는 로컬 실행, 저장소 구조, 주요 운영 기준을 빠르게 파악하기 위한 진입 문서입니다.

## 프로젝트 상태

Granite는 다음 단계로 개발됩니다.

1. Phase 1: Public UI Baseline
2. Phase 2: D1 Migration & Data Layer
3. Phase 3: Admin Operations
4. Phase 4: Public/Admin UX Refinement
5. Phase 5: Beta / Instagram
6. Phase 6: Login / Favorites / Claims

현재 릴리스 경계는 `docs/ROADMAP.md`와 진행 중인 PR을 함께 확인하세요. Phase별 구현 계획은 `docs/plans/`에 정리되어 있습니다.

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| 프레임워크 | Next.js App Router, React, Server Actions |
| 언어 | TypeScript strict |
| 스타일 | Tailwind CSS |
| 데이터베이스 | Cloudflare D1 HTTP API |
| 오브젝트 스토리지 | Cloudflare R2 S3-compatible SDK |
| 이미지 제공 | Cloudflare CDN, Image Resizing |
| 지도 | Kakao Map JavaScript SDK |
| 웹앱 배포 | Vercel Functions, Node runtime, 서울 리전 |
| Worker 배포 | Cloudflare Workers |
| 테스트 | Vitest |

## 로컬 개발

의존성을 설치합니다.

```bash
pnpm install
```

Next.js 개발 서버를 실행합니다.

```bash
pnpm dev
```

검증 명령입니다.

```bash
pnpm typecheck
pnpm test
pnpm build
```

운영과 배포에 자주 쓰는 명령입니다.

```bash
pnpm wrangler d1 migrations apply granite --local
pnpm vercel deploy
pnpm vercel deploy --prod
pnpm wrangler deploy
```

## 환경 변수

로컬 웹앱 개발에는 `.env.local`을 사용합니다. 기본 키 목록은 `.env.example`을 기준으로 합니다.

| 키 | 용도 |
| --- | --- |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | Kakao Map JavaScript SDK 키 |
| `CDN_BASE_URL` | 공개 CDN 베이스 URL. 기본값은 `https://cdn.granite.kr` |
| `ADMIN_JWT_SECRET` | 관리자 세션 서명 키 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare API 연동용 account ID |
| `D1_HTTP_URL` | Cloudflare D1 HTTP API endpoint |
| `D1_API_TOKEN` | D1 HTTP 접근용 Cloudflare API token |
| `D1_DATABASE_ID` | Cloudflare D1 database ID |
| `R2_BUCKET_NAME` | 웹앱에서 사용하는 R2 bucket 이름 |
| `R2_ACCESS_KEY_ID` | R2 S3-compatible access key |
| `R2_SECRET_ACCESS_KEY` | R2 S3-compatible secret key |

Phase 5와 Phase 6 기능에는 Meta/OAuth provider secret이 추가됩니다. production 값은 저장소에 두지 말고 Vercel Environment Variables 또는 Cloudflare secret으로 관리하세요.

## 디렉터리 구조

```text
app/          Next.js App Router routes, layouts, route handlers
components/   public, admin, auth, beta, map, layout, UI components
lib/          Server Actions, auth/session, DB, R2, validation, domain logic
migrations/   rollforward-only D1 SQL migrations
workers/      Cloudflare Worker code, Instagram webhook handling
public/       static assets
scripts/      운영/개발 보조 스크립트
docs/         PRD, architecture, roadmap, decisions, implementation plans
```

## 개발 원칙

- 기본은 Server Component입니다. 인터랙션이 필요한 leaf에만 `"use client"`를 사용합니다.
- mutation은 Server Actions를 우선합니다. Route Handler는 OAuth callback, health check처럼 명확한 HTTP 계약이 필요한 경우에만 사용합니다.
- SQL은 `lib/db/` 내부에 둡니다. 컴포넌트에서 직접 query를 작성하지 않습니다.
- 외부 입력은 Zod로 검증합니다.
- SQL은 parameter binding을 사용합니다.
- DB schema 변경은 `migrations/`에 새 rollforward migration으로 추가합니다.
- 클라이언트에는 R2 원본 URL이 아니라 CDN URL 형태만 노출합니다.
- 관리자 인증과 사용자 인증은 분리합니다.

## 배포 메모

- Next.js 웹앱은 Vercel에서 배포합니다.
- Instagram webhook과 Cloudflare 인접 비동기 작업은 Cloudflare Workers에서 처리합니다.
- D1 migration은 환경별로 명시적으로 적용합니다.
- 이미지 업로드 흐름을 테스트하기 전 R2 bucket, credential, CDN 설정을 먼저 맞춥니다.
- Preview와 production 환경 변수는 분리합니다. 의도한 경우가 아니라면 production secret을 preview에서 재사용하지 않습니다.

배포 절차와 release gate는 `docs/deployment.md`, `docs/admin-operations.md`, `docs/phase5-launch-checklist.md`를 확인하세요.

## 주요 문서

- 제품 요구사항: `docs/PRD.md`
- 아키텍처: `docs/ARCHITECTURE.md`
- 데이터 모델: `docs/DATA_MODEL.md`
- 로드맵: `docs/ROADMAP.md`
- 배포: `docs/deployment.md`
- 관리자 운영: `docs/admin-operations.md`
- 설계 결정 기록: `docs/decisions/README.md`
- Granite v2 설계 원본: `docs/specs/2026-05-13-granite-design.md`

