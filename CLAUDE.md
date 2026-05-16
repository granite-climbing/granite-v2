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
| 런타임/배포 | Cloudflare Pages + Workers (`@cloudflare/next-on-pages`) |
| 데이터베이스 | Cloudflare D1 (SQLite) |
| 오브젝트 스토리지 | Cloudflare R2 (이미지/원본 파일) |
| CDN/이미지 변환 | Cloudflare CDN + Image Resizing |
| 지도 | Kakao Map JavaScript SDK |
| 스타일 | Tailwind CSS |
| 언어 | TypeScript (strict) |

## 디렉터리 구조 (목표)

```
granite-v2/
├── app/                    # Next.js App Router
│   ├── (public)/           # 비로그인 라우트
│   ├── spots/[id]/         # 스팟 상세
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
- 원본은 R2에 업로드, 클라이언트에는 `cdn.granite.app/<key>?w=…` 형태의 변환된 URL을 노출.
- `next/image`의 `loader`로 Cloudflare Image Resizing 사용.
- R2 키는 `spots/{spotId}/{uuid}.{ext}` 컨벤션.

### 좌표/지도
- DB에는 `lat`, `lng` 를 `REAL`로 저장. PostGIS류는 없음 (D1).
- 영역 검색은 bounding box(min/max lat·lng) 기반 1차 필터링 후 거리 계산.
- 좌표계는 WGS84.

### 캐싱
- 스팟 리스트/상세는 `unstable_cache` + 태그 기반 무효화 (`spot:<id>`, `spots:list`).
- 정적 자산은 Cloudflare CDN 캐싱 풀 활용.

### 인증
- MVP에서는 익명 열람. 관리자 작업은 별도 보호된 라우트 (Cloudflare Access 또는 단순 토큰)로 보호.

## 코딩 컨벤션

- TypeScript strict. `any` 금지 (불가피한 경우 주석으로 사유 명시).
- Server Component 기본. 인터랙션이 필요한 leaf만 `"use client"`.
- DB 스키마 변경은 반드시 `migrations/` 에 SQL 파일 추가 (롤포워드 only).
- 커밋 메시지: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:` 접두어.

## 환경 변수

`.env.local` 또는 `wrangler.toml`의 `[vars]`/`[[d1_databases]]`/`[[r2_buckets]]`로 관리.

| 키 | 용도 |
|----|------|
| `DB` | D1 바인딩 (wrangler) |
| `BUCKET` | R2 바인딩 (wrangler) |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 카카오 JS 키 (도메인 제한 필수) |
| `CDN_BASE_URL` | 이미지 CDN 베이스 URL |
| `ADMIN_TOKEN` | 관리자 라우트 보호 (MVP) |

## 개발/배포 명령 (예정)

```bash
pnpm install
pnpm dev                # 로컬 개발
pnpm wrangler d1 migrations apply granite --local
pnpm pages:build        # @cloudflare/next-on-pages
pnpm wrangler pages deploy .vercel/output/static
```

## 참고 문서

- 제품 요구사항: [docs/PRD.md](docs/PRD.md)
- 아키텍처 설계: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 출시 로드맵: [docs/ROADMAP.md](docs/ROADMAP.md)
- 의사결정 기록(ADR): [docs/decisions/](docs/decisions/README.md)
