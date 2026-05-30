# Granite

국내 자연 볼더링 스팟을 사용자들이 편하게 탐색·확인할 수 있는 웹앱.

## 프로젝트 개요

- **서비스명**: Granite (그래나이트)
- **목적**: 한국 내 자연 볼더링(외벽 볼더) 스팟 정보를 지도/리스트 기반으로 제공
- **사용자**: 자연 볼더링에 관심 있는 클라이머
- **현재 상태**: 초기 셋업 단계 (코드 없음, Figma 디자인 존재)

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js (App Router, **Server Actions** 중심) |
| 웹앱 런타임/배포 | **Vercel** Functions Node runtime (`icn1` 서울 리전). 자세한 분리 근거는 [ADR 0003](docs/decisions/0003-vercel-cloudflare-runtime-split.md) |
| 보조 런타임 | Cloudflare Workers — Instagram 웹훅·재시도·scheduled job 전용 (일반 CRUD는 Worker로 만들지 않음) |
| 데이터베이스 | Cloudflare D1 (SQLite) — **HTTP API**로 호출 (`lib/db/d1-http.ts`), 바인딩 아님 |
| 오브젝트 스토리지 | Cloudflare R2 — **S3 호환 SDK**(`@aws-sdk/client-s3`)로 접근 |
| CDN/이미지 변환 | Cloudflare CDN + Image Resizing (`cdn.granite.kr`) |
| 지도 | Kakao Map JavaScript SDK |
| 스타일 | Tailwind CSS |
| 언어 | TypeScript (strict) |

## 디렉터리 구조 (목표)

```
granite-v2/
├── app/                    # Next.js App Router
│   ├── (public)/           # 비로그인 홈
│   ├── c/[cragSlug]/       # 크랙 상세
│   ├── topos/[topoId]/     # 토포 상세
│   ├── r/[routeId]/        # 루트 상세
│   ├── admin/              # 관리자 (Phase 3, JWT 보호)
│   ├── api/                # 필요한 경우에만 (가급적 Server Actions 사용)
│   └── layout.tsx
├── components/             # UI 컴포넌트
├── lib/
│   ├── db/                 # D1 쿼리/스키마
│   ├── r2/                 # R2 업로드/조회
│   ├── actions/            # Server Actions
│   └── kakao/              # 카카오맵 래퍼
├── migrations/             # D1 마이그레이션 SQL
├── public/
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   └── decisions/         # ADR (의사결정 기록)
├── wrangler.toml
└── CLAUDE.md
```

## 작업 원칙

### 데이터 액세스
- **Server Actions 우선**. REST/Route Handler는 외부 통신·웹훅·서드파티 콜백 등 명확한 사유가 있을 때만 사용.
- D1 쿼리는 `lib/db/` 내부로 한정. 컴포넌트에서 직접 SQL 쓰지 않는다.
- 모든 mutation은 Server Action을 통하고, 반환 후 `revalidatePath` 또는 `revalidateTag` 호출.

### 이미지 처리
- 원본은 R2에 업로드, 클라이언트에는 `cdn.granite.kr/<key>?w=…` 형태의 변환된 URL을 노출 (베이스는 `CDN_BASE_URL`).
- `next/image`의 `loader`로 Cloudflare Image Resizing 사용 (`lib/r2/cloudflare-image-loader.ts`).
- R2 키는 `{entityType}/{entityId}/{purpose}-{uuid}.{ext}` 컨벤션 (`lib/r2/images.ts`의 `buildR2ImageKey`).

### 좌표/지도
- DB에는 `lat`, `lng` 를 `REAL`로 저장. PostGIS류는 없음 (D1).
- 영역 검색은 bounding box(min/max lat·lng) 기반 1차 필터링 후 거리 계산.
- 좌표계는 WGS84.

### 캐싱
- 리스트/상세는 `unstable_cache` + 태그 기반 무효화. 실제 태그: `home`, `areas:list`, `crag:<slug>`, `sector:<slug>`, `boulder:<id>`, `route:<id>` (`lib/db/repository.ts`).
- 정적 자산은 Cloudflare CDN 캐싱 풀 활용.

### 인증
- 공개 페이지는 익명 열람. 관리자 작업은 `/admin/*` 보호 라우트 + `granite_admin` HttpOnly 쿠키(JWT, `ADMIN_JWT_SECRET`)로 보호 ([ADR 0013](docs/decisions/0013-admin-auth-separate-from-user.md), Phase 3).

## 코딩 컨벤션

- TypeScript strict. `any` 금지 (불가피한 경우 주석으로 사유 명시).
- Server Component 기본. 인터랙션이 필요한 leaf만 `"use client"`.
- DB 스키마 변경은 반드시 `migrations/` 에 SQL 파일 추가 (롤포워드 only).
- 커밋 메시지: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:` 접두어.

## 환경 변수

웹앱(Vercel)은 `.env.local` / Vercel 프로젝트 ENV로, 보조 Worker는 `wrangler secret`으로 관리한다 (시크릿 분산: [ADR 0003](docs/decisions/0003-vercel-cloudflare-runtime-split.md)). 정본 목록은 `.env.example` 참고.

| 키 | 용도 |
|----|------|
| `D1_HTTP_URL` | D1 HTTP API 엔드포인트 (`lib/db/d1-http.ts`) |
| `D1_API_TOKEN` | D1 HTTP API 토큰 |
| `D1_DATABASE_ID` | D1 데이터베이스 ID |
| `CDN_BASE_URL` | 이미지 CDN 베이스 URL (`https://cdn.granite.kr`) |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 카카오 JS 키 (도메인 제한 필수) |
| `ADMIN_JWT_SECRET` | 관리자 세션 JWT 서명 키 (프로덕션 필수) |
| `CLOUDFLARE_ACCOUNT_ID` | R2 S3 엔드포인트 파생 (`https://<id>.r2.cloudflarestorage.com`) |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 S3 자격증명 (관리자 이미지 업로드) |
| `R2_BUCKET_NAME` | R2 버킷 이름 |

## 개발/배포 명령

```bash
pnpm install
pnpm dev                # 로컬 개발
pnpm test               # vitest
pnpm typecheck          # tsc --noEmit
pnpm build              # next build
pnpm wrangler d1 migrations apply granite --local   # 로컬 D1 마이그레이션
pnpm vercel:deploy      # Vercel 프리뷰 배포
pnpm vercel:deploy:prod # Vercel 프로덕션 배포
```

## 참고 문서

- 제품 요구사항: [docs/PRD.md](docs/PRD.md)
- 아키텍처 설계: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 출시 로드맵: [docs/ROADMAP.md](docs/ROADMAP.md)
- 의사결정 기록(ADR): [docs/decisions/](docs/decisions/README.md)
