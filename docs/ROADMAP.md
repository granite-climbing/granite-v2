# Granite v2 — Roadmap

> 작성일: 2026-05-13
> 갱신일: 2026-05-29
> 상태: Phase 2 완료 기준 반영
> 기준 문서: [docs/PRD.md](PRD.md), [docs/ARCHITECTURE.md](ARCHITECTURE.md), [docs/decisions/](decisions/README.md)

5단계 출시 ([ADR 0017](decisions/0017-phased-release-1-5.md))의 마일스톤, 사전 작업, 게이트 조건을 정리한다. 기존 3단계 출시안([ADR 0008](decisions/0008-phased-release-1-2-3.md))은 실제 Phase 1 구현 범위와 맞지 않아 supersede되었다.

## 마일스톤 개요

| Phase | 사용자/운영 가치 | 출시 조건 |
|:-----:|------------------|----------|
| Phase 1 | Figma 기준 public UI 1차 탐색 경험 | mock/seed 데이터로 주요 화면 QA 통과 |
| Phase 2 | 실제 D1 데이터로 public UI 구동 | migration + DB-backed read path 안정화 |
| Phase 3 | 운영자가 콘텐츠와 이미지를 관리 | 관리자 인증/CRUD/R2/CDN/revalidation 동작 |
| Phase 4 | Instagram/수동 베타 수집과 검수 | 웹훅/인박스/베타 모더레이션 end-to-end |
| Phase 5 | 로그인, 즐겨찾기, 내 기록, 클레임 | OAuth 4종 + 개인화/클레임 정책 검증 |

각 Phase는 독립 배포 가능해야 한다. 다음 Phase는 직전 Phase의 사용자 경험을 깨지 않고, 미완성 기능은 명시적인 scaffold 또는 coming soon 상태로 유지한다.

---

## Phase 1 — Public UI Baseline

### 현재 종료 기준

`phase1-implementation` 브랜치의 현재 목표는 Phase 1 완료로 간주한다.

- 홈 탐색 화면, Area 탭, Crag 카드, New Updates UI
- Crag 상세 탭과 Topo/Route 탐색 흐름
- Route 상세 공유 화면
- 모바일 shell, header, footer, bottom nav
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

- [ ] 관리자 계정 생성 방식 확정(migration 또는 CLI)
- [ ] `ADMIN_JWT_SECRET` 발급 및 회전 SOP 초안 작성
- [ ] R2 bucket, S3-compatible credentials, `CDN_BASE_URL` 준비
- [ ] 이미지 원본 보관/저작권 운영 가이드 초안 작성

### 개발 범위

- `/admin/login` 이메일+비밀번호 인증과 `granite_admin` HttpOnly cookie
- Area/Crag/Sector/Boulder/Topo/Route CRUD
- 공지(Announcement) CRUD와 홈 New Updates 연동
- R2 업로드, EXIF 위치정보 제거, CDN URL 저장
- Server Action mutation의 Zod 검증, `requireAdmin()`, revalidation
- `admin_audit_logs` 기록

### 출시 게이트

- [ ] 관리자 로그인/로그아웃/세션 만료 검증
- [ ] 콘텐츠 생성/수정/삭제/게시 토글 end-to-end 검증
- [ ] 이미지 업로드 후 `https://cdn.granite.kr/...` URL만 클라이언트에 노출
- [ ] 관리자 데이터가 공개 캐시에 들어가지 않는지 확인
- [ ] 관리자 계정 비밀번호 회전 SOP 합의

---

## Phase 4 — Beta / Instagram

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

## Phase 5 — Login / Favorites / Claims

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
              ├──> Phase 4 Beta / Instagram
              └──> Phase 5 Login / Favorites / Claims

Phase 4 ──> Phase 5 클레임 가치 강화
```

병행 가능:

- Meta 검수 준비는 Phase 3 후반부터 시작 가능
- OAuth provider 검수 준비는 Phase 4와 병행 가능
- 콘텐츠 원본 정리와 이미지 저작권 확인은 Phase 2부터 계속 진행

## 변경 관리

- 본 ROADMAP은 단계 경계와 게이트 조건만 관리한다.
- 세부 이슈/스프린트는 별도 트래커에서 운영한다.
- 단계 정의 자체가 바뀌면 새 ADR을 추가하고 본 문서를 갱신한다.
