# Granite v2 — Roadmap

> 작성일: 2026-05-13
> 갱신일: 2026-06-01
> 상태: Phase 3 구현 완료 후 Phase 4 재정의 반영
> 기준 문서: [docs/PRD.md](PRD.md), [docs/ARCHITECTURE.md](ARCHITECTURE.md), [docs/decisions/](decisions/README.md)

6단계 출시 ([ADR 0019](decisions/0019-insert-phase-4-ui-admin-refinement.md))의 마일스톤, 사전 작업, 게이트 조건을 정리한다. 기존 5단계 출시안([ADR 0017](decisions/0017-phased-release-1-5.md))은 Phase 3 이후 public/admin UX 보정 단계를 끼워 넣기 위해 supersede되었다.

## 마일스톤 개요

| Phase | 사용자/운영 가치 | 출시 조건 |
|:-----:|------------------|----------|
| Phase 1 | Figma 기준 public UI 1차 탐색 경험 | mock/seed 데이터로 주요 화면 QA 통과 |
| Phase 2 | 실제 D1 데이터로 public UI 구동 | migration + DB-backed read path 안정화 |
| Phase 3 | 운영자가 콘텐츠와 이미지를 관리 | 관리자 인증/CRUD/R2/CDN/revalidation 동작 |
| Phase 4 | Phase 3 기반 public/admin UX 보정 | 홈/Area/Crag/Route/Topo/Admin polish QA 통과 |
| Phase 5 | Instagram/수동 베타 수집과 검수 | 웹훅/인박스/베타 모더레이션 end-to-end |
| Phase 6 | 로그인, 즐겨찾기, 내 기록, 클레임 | OAuth 4종 + 개인화/클레임 정책 검증 |

각 Phase는 독립 배포 가능해야 한다. 다음 Phase는 직전 Phase의 사용자 경험을 깨지 않고, 미완성 기능은 명시적인 scaffold 또는 coming soon 상태로 유지한다.

---

## Phase 1 — Public UI Baseline

### 현재 종료 기준

`phase1-implementation` 브랜치의 현재 목표는 Phase 1 완료로 간주한다.

- 홈 탐색 화면, Area 탭, Crag 카드, New Updates UI
- Crag 상세 탭과 Topo/Route 탐색 흐름
- Route 상세 공유 화면
- 모바일 shell, header, footer
- Figma 로고/이미지 에셋 반영
- 정책 페이지(`/terms`, `/privacy`, `/data-deletion`)
- mock/seed 데이터 기반 repository와 화면 검증

### 명시적 제외

- D1 production migration 적용
- public UI의 실제 D1 HTTP API read path
- 관리자 인증/CRUD의 운영 가능 수준 완성
- R2 업로드와 CDN 이미지 운영
- Instagram webhook, Beta, OAuth, 즐겨찾기

### 출시 게이트

- [x] 모바일 주요 화면 QA 통과
- [x] Figma의 status bar 장식 미구현 확인
- [x] 실제 앱 헤더가 56px 검정 네비게이션 바로 시작하는지 확인
- [x] `pnpm test`, `pnpm typecheck`, `pnpm build` 통과
- [x] Phase 1 완료 내용을 문서와 브랜치 기준선에 반영

---

## Phase 2 — DB Migration & Data Layer

### 사전 준비

- [x] Cloudflare D1 local/preview/production 리소스 이름 확정
- [x] `D1_HTTP_URL`, `D1_API_TOKEN`, `D1_DATABASE_ID` 발급 방식 정리
- [x] mock/seed JSON을 migration seed 또는 import script로 옮기는 기준 확정
- [x] public UI에서 필요한 read query 목록 확정

### 개발 범위

- D1 schema/migrations 정리
- Phase 1 mock 데이터와 동등한 seed/import 데이터 준비
- `lib/db/`에 D1 HTTP API client와 typed query boundary 구현
- 홈, Crag 상세, Topo/Route 화면을 DB-backed read path로 연결
- 공개 콘텐츠 캐싱(`unstable_cache`, tag invalidation 준비)
- `/healthz` DB ping 검증

### 출시 게이트

- [x] mock/seed 화면과 DB-backed 화면의 주요 데이터 동등성 확인
- [x] 컴포넌트에서 직접 SQL을 쓰지 않는지 확인
- [x] `pnpm test`, `pnpm typecheck`, `pnpm build` 통과

---

## Phase 3 — Admin Operations

### 사전 준비

- [x] 관리자 계정 생성 방식 확정(migration 또는 CLI) — bcrypt CLI(`scripts/create-admin-hash.ts`) + D1 console insert SOP(`docs/admin-operations.md`)
- [x] `ADMIN_JWT_SECRET` 발급 및 회전 SOP 초안 작성 — `docs/admin-operations.md` Password Rotation 섹션
- [x] R2 bucket, S3-compatible credentials, `CDN_BASE_URL` 준비 — `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `CDN_BASE_URL` env 정의
- [x] 이미지 원본 보관/저작권 운영 가이드 초안 작성 — `docs/admin-operations.md` Image Policy 섹션

### 개발 범위

- [x] `/admin/login` 이메일+비밀번호 인증과 `granite_admin` HttpOnly cookie
- [x] Area/Crag/Sector/Boulder/Topo/Route CRUD (save / soft-delete / restore + togglePublish Server Actions)
- [x] 공지(Announcement) CRUD와 홈 New Updates 연동
- [x] R2 업로드, CDN URL 저장(Server Action bodySizeLimit 10 MB)
- [x] Server Action mutation의 Zod 검증, `requireAdmin()`, revalidation
- [x] `admin_audit_logs` 기록(비치명적 — mutation은 audit 실패 시에도 커밋 유지)
- [x] `migrations/0003_admin_operations.sql` — `admins`, `admin_audit_logs`, `deleted_at` 컬럼
- [x] 데스크탑 관리자 UI: shell, table, card, field, publish-badge, delete-restore 컴포넌트 + 6 entity 페이지 + announcements + audit log 페이지
- [x] 관리자 read model 쿼리 + 공개 쿼리의 soft-delete 필터(`lib/db/queries.ts`)
- [x] 관리자 계정 bcrypt SOP(`scripts/create-admin-hash.ts`, `docs/admin-operations.md`)

### 출시 게이트

- [x] `pnpm test` 통과 (13 files, 227 tests)
- [x] `pnpm typecheck` 통과 (0 errors)
- [x] `pnpm build` 통과 (23 routes)
- [ ] `migrations/0003_admin_operations.sql`을 local/preview/prod D1에 적용
- [ ] D1 console에서 최초 admin 행 삽입 (bcrypt hash 사용)
- [ ] 관리자 로그인/로그아웃/세션 만료 브라우저 검증
- [ ] 콘텐츠 생성/수정/삭제/게시 토글 end-to-end 브라우저 검증
- [ ] 이미지 업로드 후 `https://cdn.granite.kr/...` URL만 클라이언트에 노출 확인
- [ ] 관리자 데이터가 공개 캐시에 들어가지 않는지 확인
- [ ] 관리자 계정 비밀번호 회전 SOP 합의
- [ ] audit log 행이 콘텐츠 mutation/이미지 업로드 시 생성되는지 확인

---

## Phase 4 — Public/Admin UX Refinement

### 목적

Phase 3까지 확보한 DB-backed public UI와 관리자 운영 UI를 실제 Phase 5(Beta/Instagram) 개발 전에 정돈한다. 이 단계는 새 데이터 모델을 크게 늘리지 않고, Figma 최신 화면 기준으로 탐색 흐름, 탭 UI, 아이콘, 정렬/검색 동작, 관리자 생성/필터 경험을 보정하는 중간 릴리스다.

### 사전 준비

- [ ] Figma `그라나이트 dudco` 참조 노드 접근 확인
  - [Area 페이지 `30:734`](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=30-734&t=z7QWEbhfHP7Z4mHh-4)
  - [Crag Info `30:889`](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=30-889&t=z7QWEbhfHP7Z4mHh-4)
  - [Crag Sector `30:2070`](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=30-2070&t=z7QWEbhfHP7Z4mHh-4)
  - [Crag Boulder/Route `30:2155`](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=30-2155&t=z7QWEbhfHP7Z4mHh-4)
  - [검색 UI `31:2518`](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=31-2518&t=z7QWEbhfHP7Z4mHh-4)
  - [Footer Instagram icon `1:186`](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=1-186&t=z7QWEbhfHP7Z4mHh-4)
  - [Route/Topo map icon `1:1420`](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=1-1420&t=z7QWEbhfHP7Z4mHh-4)
  - [Route/Topo beta icon `1:1417`](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=1-1417&t=z7QWEbhfHP7Z4mHh-4)
- [ ] Phase 3 운영 검증 중 남은 D1/admin/R2 환경 체크를 완료하거나 Preview 기준 QA 환경을 확정
- [ ] Area 상세 URL 정책 확정: `/a/<area-slug>`
- [ ] Topo 상세 URL 정책 확정: `/t/<topo-id>`
- [ ] Topo 간 이동 순서 정책 확정: 같은 Boulder 내 `sort_order ASC`, 없으면 `name ASC`, 마지막/처음에서는 disabled

### 개발 범위

#### Public home and Area flow

- 홈 Area 영역에서 칩 UI를 제거하고, 가로 슬라이딩 카드로 Area를 탐색한다.
- 홈 Crag 영역에 Figma 기준 마진을 추가하고, 가로 슬라이딩 카드로 Crag를 탐색한다.
- 홈 Area 클릭 시 이동하는 Area 상세 페이지를 추가한다.
  - Area 헤더, Area 통계, 해당 Area의 Crag 리스트를 제공한다.
  - Crag 카드는 기존 DB-backed read path를 재사용한다.
- Footer의 Instagram 아이콘을 Figma 기준 에셋/비율로 교체한다.

#### Crag detail tabs

- Crag 상세 Info 탭을 Figma `30:889` 기준으로 수정한다.
- Crag 상세 Sector 탭을 Figma `30:2070` 기준으로 수정한다.
- Crag 상세 Boulder 탭을 Figma `30:2155` 기준으로 수정한다.
- Crag 상세 Route 탭의 Grade 정렬 기능을 실제로 동작하게 하고, 정렬 아이콘을 정상 위치에 표시한다.
- Sector, Boulder, Route 탭의 검색 UI를 Figma `31:2518` 기준으로 통일한다.

#### Route and Topo detail

- Route 또는 Topo 페이지의 지도 아이콘을 Figma `1:1420` 기준으로 수정한다.
- Route 또는 Topo 페이지의 베타 아이콘을 Figma `1:1417` 기준으로 수정한다.
- Route 또는 Topo 페이지에서 화살표로 같은 Boulder의 이전/다음 Topo로 이동할 수 있게 한다.

#### Admin operations refinement

- Admin에서 Area/Crag/Sector/Boulder/Topo/Route 신규 생성 화면에도 사이드바가 유지되도록 라우팅/레이아웃을 수정한다.
- Admin 목록과 생성 폼에서 부모 항목 기반 필터를 제공한다.
  - Crag: Area 필터
  - Sector: Area → Crag 필터
  - Boulder: Area → Crag → Sector 필터
  - Topo: Area → Crag → Sector → Boulder 필터
  - Route: Area → Crag → Sector → Boulder → Topo 필터
- 필터는 URL search params로 유지해 새로고침, 공유, 뒤로가기를 안정화한다.

### 명시적 제외

- 하단 바텀 탭 신규 구현 또는 재도입
- 사용자 로그인, 회원가입, 마이페이지, 프로젝트, 내 기록
- Instagram 웹훅, 수동 베타 등록, 베타 모더레이션
- 새 콘텐츠 기여/제보 기능

하단 바텀 탭은 로그인/개인화 단계인 Phase 6에서 사용자 계정 플로우와 함께 재검토한다.

### 출시 게이트

- [ ] 홈 Area/Crag 슬라이더가 모바일 터치와 데스크톱 max-width 480 환경에서 레이아웃 깨짐 없이 동작
- [ ] `/a/<area-slug>`가 published Area/Crag만 노출하고, 없는 slug는 404 처리
- [ ] Crag Info/Sector/Boulder/Route 탭이 Figma 참조와 주요 spacing/typography/asset 기준 일치
- [ ] Route 탭 Grade 정렬이 오름차순/내림차순으로 동작하고 상태가 URL 또는 클라이언트 상태로 명확히 유지
- [ ] Sector/Boulder/Route 검색 UI가 동일한 높이, icon 위치, placeholder, focus state를 사용
- [ ] Route/Topo 지도·베타 아이콘이 모든 밀도에서 중앙 정렬되고 터치 타깃 44px 권장치를 만족
- [ ] Topo 이전/다음 화살표가 같은 Boulder 범위에서만 이동하고 경계 상태를 disabled 처리
- [ ] Admin 신규 생성 화면에서 사이드바가 유지되고 부모 필터 선택이 생성 폼 기본값에 반영
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm build` 통과

---

## Phase 5 — Beta / Instagram

### 사전 준비

- [ ] Instagram 비즈니스 또는 크리에이터 계정 준비
- [ ] Meta for Developers 앱 생성 + Instagram Graph API 권한 신청
- [ ] 웹훅 endpoint(`https://<worker-domain>/webhooks/instagram`) 등록 + 검수 제출
- [ ] `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` 발급 + Worker secret 등록
- [ ] 캡션 정규화 규칙과 동명 Boulder/Route 처리 정책 확정
- [ ] 웹훅 raw payload 보관 기간 확정

### 개발 범위

- Cloudflare Worker `GET/POST /webhooks/instagram`
- HMAC 검증, idempotency, `webhook_inbox` 저장
- 캡션 기반 Route 매칭과 unclaimed Beta 생성
- 비로그인 수동 Beta 등록(Instagram/YouTube URL + 핸들 + 날짜)
- 관리자 웹훅 인박스 수동 매칭/거절
- 관리자 베타 숨김/삭제 모더레이션
- 썸네일 수집과 실패 폴백
- Route 상세의 캡션 생성/복사 UI

### 출시 게이트

- [ ] Meta 앱 검수 승인
- [ ] production secret 기반 HMAC 검증 통과
- [ ] 캡션 → 매칭 → Beta 생성 end-to-end 시나리오 검증
- [ ] 동명 Boulder/Route 케이스가 unmatched로 떨어지는지 확인
- [ ] 관리자 인박스 SOP 문서화
- [ ] 썸네일 수집 실패 시 Beta 생성이 유지되는지 확인

---

## Phase 6 — Login / Favorites / Claims

### 사전 준비

- [ ] OAuth 4종 앱 등록
- [ ] Kakao Developers: `account_email`, `profile_nickname` 스코프
- [ ] Naver Developers: 비즈니스 서비스 검수 제출
- [ ] Google Cloud: OpenID 스코프
- [ ] Apple Developer: Sign in with Apple, Service ID, Private Key 발급
- [ ] 리다이렉트 URL 등록: `https://granite.kr/api/auth/callback/<provider>`
- [ ] `JWT_SECRET` 생성
- [ ] unclaimed Beta 클레임 정책 확정

### 개발 범위

- Kakao/Naver/Google/Apple OAuth callback + 사용자 세션
- 마이페이지, 프로필 편집, Instagram/YouTube 핸들 입력
- Route 즐겨찾기와 프로젝트 탭
- 내 기록 탭과 본인 Beta 관리
- Instagram 핸들 기반 unclaimed Beta 클레임
- 계정 머지와 OAuth provider 연결/해제
- 관리자 회원 목록/검색과 통계 대시보드

### 출시 게이트

- [ ] OAuth 4종 production 가입/로그인/로그아웃 검증
- [ ] Apple Private Relay 케이스 검증
- [ ] 동일 이메일 머지 안내 동작 검증
- [ ] unclaimed Beta 클레임 audit log 확인
- [ ] 회원탈퇴 시 OAuth identity / 세션 / 식별정보 삭제 확인

---

## 단계 간 의존 관계

```
Phase 1 UI baseline
  └──> Phase 2 DB-backed public read path
        └──> Phase 3 Admin operations
              └──> Phase 4 Public/Admin UX refinement
                    └──> Phase 5 Beta / Instagram
                          └──> Phase 6 Login / Favorites / Claims

Phase 5 ──> Phase 6 클레임 가치 강화
```

병행 가능:

- Meta 검수 준비는 Phase 4와 병행 가능
- OAuth provider 검수 준비는 Phase 5와 병행 가능
- 콘텐츠 원본 정리와 이미지 저작권 확인은 Phase 2부터 계속 진행

## 변경 관리

- 본 ROADMAP은 단계 경계와 게이트 조건만 관리한다.
- 세부 이슈/스프린트는 별도 트래커에서 운영한다.
- 단계 정의 자체가 바뀌면 새 ADR을 추가하고 본 문서를 갱신한다.
