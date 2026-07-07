# Granite v2 — Roadmap

> 작성일: 2026-05-13
> 갱신일: 2026-07-07
> 상태: Phase 6 로그인/계정관리 완료 후 Phase 7-10 UX 계획 반영
> 기준 문서: [docs/PRD.md](PRD.md), [docs/ARCHITECTURE.md](ARCHITECTURE.md), [docs/decisions/](decisions/README.md)

Granite v2는 Phase 6까지 구현을 진행했다. 단, Phase 6의 실제 완료 범위는 로그인/회원가입/세션/마이 계정관리이며, 기존 Phase 6에 포함되어 있던 Favorites, Claims, 기록 관리의 본 구현은 후속 Phase로 분리한다.

최근 커밋과 코드 기준으로 확인한 핵심 근거는 다음과 같다.

- Phase 5는 `phase5-implementation` 병합과 후속 webhook/beta 보강 커밋을 통해 Beta/Instagram 수집, 수동 제출, 관리자 모더레이션, operational event 보강이 반영되었다.
- Phase 6는 `phase6-social-login-main` 병합과 `feat(auth)`, `fix(auth)` 계열 커밋을 통해 OAuth, pending signup, 사용자 세션, WebView/native handoff, `/me` 계정 화면이 반영되었다.
- `migrations/0009_user_auth.sql`에는 `users`, `user_oauth_identities`만 추가되어 있다. `favorites` 테이블은 아직 없으므로 프로젝트/Favorites는 완료 범위가 아니다.
- `/me/projects`, `/me/records`는 현재 안내용 scaffold 화면이며, Route 저장/기록 데이터 조회/클레임 로직은 아직 후속 작업이다.

---

## 마일스톤 개요

| Phase | 상태 | 사용자/운영 가치 | 출시 조건 |
|:-----:|:----:|------------------|----------|
| Phase 1 | 완료 | Figma 기준 public UI 1차 탐색 경험 | mock/seed 데이터로 주요 화면 QA 통과 |
| Phase 2 | 완료 | 실제 D1 데이터로 public UI 구동 | migration + DB-backed read path 안정화 |
| Phase 3 | 완료 | 운영자가 콘텐츠와 이미지를 관리 | 관리자 인증/CRUD/R2/CDN/revalidation 동작 |
| Phase 4 | 완료 | Phase 3 기반 public/admin UX 보정 | 홈/Area/Crag/Route/Topo/Admin polish 반영 |
| Phase 5 | 완료 | Instagram/수동 베타 수집과 검수 | 웹훅/인박스/베타 모더레이션 구현 |
| Phase 6 | 완료 | 로그인/회원가입/계정관리 기반 | OAuth 4종, 세션, signup, `/me`, app handoff 구현 |
| Phase 7 | 예정 | Route 상세 최신 UX 반영 | Location 워딩, Beta->More, More 상세 정보 반영 |
| Phase 8 | 예정 | 프로젝트 탭 본 구현 | 하단 프로젝트 탭과 Route 저장 UX 구현 |
| Phase 9 | 예정 | 기록 탭 본 구현 | 기록 홈/목록/분석성 UI 구현 |
| Phase 10 | 예정 | 기록 추가 UI | 기록 추가 진입, 루트 검색, 미디어 입력 플로우 구현 |

각 Phase는 독립 배포 가능해야 한다. 다음 Phase는 직전 Phase의 사용자 경험을 깨지 않고, 미완성 기능은 명시적인 scaffold 또는 coming soon 상태로 유지한다.

---

## Phase 1 — Public UI Baseline

### 완료 범위

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

### 완료 게이트

- [x] 모바일 주요 화면 QA 통과
- [x] Figma의 status bar 장식 미구현 확인
- [x] 실제 앱 헤더가 56px 검정 네비게이션 바로 시작하는지 확인
- [x] `pnpm test`, `pnpm typecheck`, `pnpm build` 기준선 통과
- [x] Phase 1 완료 내용을 문서와 브랜치 기준선에 반영

---

## Phase 2 — DB Migration & Data Layer

### 완료 범위

- D1 schema/migrations 정리
- Phase 1 mock 데이터와 동등한 seed/import 데이터 준비
- `lib/db/`에 D1 HTTP API client와 typed query boundary 구현
- 홈, Crag 상세, Topo/Route 화면을 DB-backed read path로 연결
- 공개 콘텐츠 캐싱(`unstable_cache`, tag invalidation 준비)
- `/healthz` DB ping 검증

### 완료 게이트

- [x] mock/seed 화면과 DB-backed 화면의 주요 데이터 동등성 확인
- [x] 컴포넌트에서 직접 SQL을 쓰지 않는지 확인
- [x] `pnpm test`, `pnpm typecheck`, `pnpm build` 기준선 통과

---

## Phase 3 — Admin Operations

### 완료 범위

- `/admin/login` 이메일+비밀번호 인증과 `granite_admin` HttpOnly cookie
- Area/Crag/Sector/Boulder/Topo/Route CRUD
- soft-delete / restore / publish toggle Server Actions
- 공지(Announcement) CRUD와 홈 New Updates 연동
- R2 업로드, CDN URL 저장
- Server Action mutation의 Zod 검증, `requireAdmin()`, revalidation
- `admin_audit_logs` 기록
- `migrations/0003_admin_operations.sql`
- 데스크톱 관리자 UI: shell, table, card, field, publish-badge, delete-restore 컴포넌트
- 관리자 read model 쿼리와 공개 쿼리의 soft-delete 필터
- 관리자 계정 bcrypt SOP(`scripts/create-admin-hash.ts`, `docs/admin-operations.md`)

### 남은 운영 확인

- [x] 운영 D1에 migration 적용 상태 확인
- [x] 최초 admin 행 삽입 및 비밀번호 회전 SOP 운영 확인
- [x] production R2/CDN 업로드 end-to-end 확인

---

## Phase 4 — Public/Admin UX Refinement

### 완료 범위

- 홈 Area/Crag 슬라이더
- Area 상세 페이지(`/a/<area-slug>`)
- Area 상세 Crag 리스트와 overview map
- Crag 상세 Info/Sector/Boulder/Route 탭 보정
- Route 탭 검색/정렬 보정
- Route/Topo 아이콘과 Topo 이동 보정
- Admin 신규 생성/수정 drawer 흐름
- Admin 부모 필터와 URL search params 기반 상태 유지
- Admin Location 좌표 UX 후속 보정
  - what3words 변환 액션
  - Crag/Sector/Boulder Location 섹션 재사용 컴포넌트
  - Kakao map preview

### 참고 문서

- [Phase 4 Plan](plans/2026-06-02-granite-phase-4.md)
- [Phase 4 Follow-up Plan](plans/2026-06-02-granite-phase-4-followup.md)
- [Admin w3w Coordinate Preview](plans/2026-06-21-admin-w3w-coordinate-preview.md)

---

## Phase 5 — Beta / Instagram

### 완료 범위

- Cloudflare Worker Instagram webhook
- webhook inbox 저장, 상태 관리, operational event 기록
- Instagram caption 기반 Route 매칭과 unclaimed Beta 생성
- 비로그인 수동 Beta 등록
  - Instagram/YouTube URL
  - 표시명/Instagram 핸들/완등 날짜
  - duplicate 방지
  - published route boundary 검증
- 관리자 웹훅 인박스 수동 매칭/거절
- 관리자 Beta 승인/숨김/삭제 모더레이션
- Beta thumbnail 수집, R2 복사, 실패 폴백
- Route/Topo 화면의 Beta video sheet와 수동 제출 UI
- 운영 SOP와 launch checklist 문서화

### 남은 운영 확인

- [ ] Meta 앱 production 권한/검수 승인
- [ ] production secret 기반 HMAC 검증
- [x] 실제 Instagram mention/comment 이벤트 end-to-end 확인
- [ ] 썸네일 수집 실패 시 Beta 생성 유지 확인

### 참고 문서

- [Phase 5 Plan](plans/2026-06-02-granite-phase-5.md)
- [Phase 5 Launch Checklist](phase5-launch-checklist.md)
- [Admin Operations Phase 5](admin-operations.md#phase-5--beta--instagram-운영)

---

## Phase 6 — Login / Account Management

### 완료 범위

Phase 6는 기존 명칭의 `Login / Favorites / Claims` 전체가 아니라, 로그인과 계정관리 기반까지만 완료한 상태로 정리한다.

- Kakao/Naver/Google/Apple OAuth provider 설정과 authorization URL 생성
- OAuth callback route
  - `GET/POST /api/auth/callback/[provider]`
  - state cookie 검증
  - code exchange
  - provider profile fetch
  - 기존 identity는 `granite_session` 발급
  - 신규 identity는 pending signup cookie 발급 후 `/signup` 이동
- pending signup onboarding
  - 닉네임/Instagram ID 기반 display name
  - 성별, 키, ape index, 최고 볼더링/스포츠 등급 입력
  - `users`, `user_oauth_identities` 생성
- 사용자 세션
  - `granite_session` HttpOnly cookie
  - `/me` 보호 라우팅
  - `/api/auth/logout`
- `/me` 계정 화면
  - 프로필 표시
  - 공개여부 토글 UI scaffold
  - OAuth 계정 연결 표시
  - 약관/개인정보처리방침 링크
  - 로그아웃
- 앱/WebView 진입과 native handoff 보강
  - `/app` entry
  - `POST /api/auth/native/session`
  - Apple native callback GET 보강
  - Google/Apple/Kakao/Naver token 기반 session handoff
- 하단 탭 shell
  - 홈, 프로젝트, 기록, 마이 탭
  - `/login`, `/signup`에서는 숨김
  - 프로젝트/기록 탭은 아직 본 기능이 아닌 scaffold

### 명시적 제외

- Route 즐겨찾기 저장/해제
- `favorites` DB 테이블과 Server Actions
- 프로젝트 탭의 Route 리스트/필터/삭제 UX
- 내 기록 탭의 Beta 조회, 통계, 상세 분석
- Instagram 핸들 기반 unclaimed Beta claim
- 계정 머지, provider 연결/해제의 실제 mutation
- 회원탈퇴 mutation과 식별정보 삭제 처리
- 관리자 회원 목록/검색/통계 대시보드

### 완료 게이트

- [x] OAuth 4종 provider configuration과 callback 경로 구현
- [x] 신규 OAuth 사용자의 pending signup 플로우 구현
- [x] 기존 OAuth identity의 session 발급 구현
- [x] `/me` 보호 라우팅과 계정 화면 구현
- [x] 로그아웃 구현
- [x] 앱/WebView session handoff 구현
- [x] `migrations/0009_user_auth.sql`로 user auth 스키마 추가
- [x] 관련 auth/session/signup 테스트 추가

### 남은 운영 확인

- [ ] OAuth 4종 production 앱 등록과 redirect URL 검증
- [ ] Apple Private Relay 케이스 검증
- [ ] WebView provider별 production handoff 검증
- [ ] 회원탈퇴/계정 삭제 정책 확정

---

## Phase 7 — Route Detail UX Update

### 목적

업데이트된 Route 상세 Figma를 반영한다. 기존 Route/Topo 상세의 Beta 중심 액션을 More 기반 정보 구조로 바꾸고, Location 워딩과 상세 정보 표시를 정돈한다.

### Figma

- [Route 상세 업데이트: Location 워딩 추가, Beta -> More 변경](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=56-1738&t=Nj8NzKW38WUPfN3F-4)
- [More 클릭 시 표시되는 Route 상세 정보](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=56-1870&t=Nj8NzKW38WUPfN3F-4)

### 참고 문서

- [Phase 7 Plan](plans/2026-07-07-granite-phase-7.md)

### 개발 범위

- Route 상세 화면의 `Location` 워딩/표시 위치 반영
- 기존 `Beta` 버튼/아이콘을 `More` 액션으로 변경
- More 클릭 시 Route 상세 정보 패널 또는 바텀시트 표시
- 기존 Beta video sheet 진입점과 충돌하지 않도록 정보 구조 재정의
- Topo 상세 내 Route 액션도 동일한 패턴을 따르는지 확인
- Figma 기준 spacing, typography, icon, touch target QA

### 명시적 제외

- 프로젝트 저장/해제
- 기록 추가
- Claims
- Route 데이터 모델 확장

### 출시 게이트

- [ ] Route 상세에서 Location 워딩이 Figma 기준으로 노출
- [ ] Beta 액션명이 More로 변경되고 기존 사용자 흐름이 끊기지 않음
- [ ] More 상세 정보가 모바일 max-width 레이아웃에서 overflow 없이 표시
- [ ] 기존 approved Beta video 노출 경로가 유지되거나 명확한 새 위치로 이동
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm build` 통과

---

## Phase 8 — Project Tab / Favorites

### 목적

하단 프로젝트 탭을 본 구현으로 전환한다. Phase 6에서 만든 bottom nav와 `/me/projects` scaffold를 기반으로 Route 저장 기능과 프로젝트 리스트 UX를 제공한다.

### Figma

- [프로젝트 탭](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=56-975&t=Nj8NzKW38WUPfN3F-4)

### 참고 문서

- [Phase 8 Plan](plans/2026-07-07-granite-phase-8.md)

### 개발 범위

- `favorites` migration 추가
  - `user_id`
  - `target_type`
  - `target_id`
  - `created_at`
  - unique `user_id + target_type + target_id`
- Route 저장/해제 Server Action
- Route 상세 또는 More 패널에서 프로젝트 추가/삭제 액션 제공
- `/me/projects` 본 화면 구현
  - 저장한 Route 리스트
  - grade, crag/boulder context
  - 빈 상태
  - 삭제/해제 UX
- 로그인 필요 상태 처리
- 프로젝트 공개 토글은 `/me` UI와 정책을 맞춰 실제 저장 여부 결정

### 명시적 제외

- 기록 탭 통계
- 기록 추가 UI
- unclaimed Beta claim
- Crag/Sector/Boulder favorite 확장

### 출시 게이트

- [ ] 로그인 사용자가 Route를 저장/해제할 수 있음
- [ ] 중복 저장이 DB unique constraint로 방지됨
- [ ] `/me/projects`가 저장 Route를 최신순 또는 Figma 기준 순서로 표시
- [ ] 비로그인 사용자는 저장 시 로그인으로 유도됨
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm build` 통과

---

## Phase 9 — Records Tab

### 목적

기록 탭을 본 구현으로 전환한다. Phase 5에서 쌓인 approved Beta와 Phase 6 사용자 계정을 연결할 수 있는 조회 중심 화면을 먼저 만든다.

### Figma

- [기록 탭 화면 1](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=56-1299&t=Nj8NzKW38WUPfN3F-4)
- [기록 탭 화면 2](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=56-1399&t=Nj8NzKW38WUPfN3F-4)

### 개발 범위

- `/me/records` 본 화면 구현
- 내 Beta/기록 리스트 read model 정의
- approved/visible 기록만 사용자 화면에 노출
- grade 분포, 최근 기록, route/crag context 표시
- 기록 공개 토글 정책과 UI 연결 여부 결정
- Phase 5 unclaimed Beta와 로그인 사용자의 연결 방식 설계
  - 즉시 자동 claim은 사칭 리스크 때문에 보류 가능
  - claim 상태는 `claim_status`를 활용하되 실제 claim mutation은 별도 게이트로 둠

### 명시적 제외

- 기록 추가 UI
- Instagram 소유권 검증 자동화
- 관리자 claim 승인 queue
- 세부 분석 고도화

### 출시 게이트

- [ ] `/me/records`가 scaffold가 아닌 실제 기록 화면으로 동작
- [ ] 사용자 본인 기록만 조회되거나, claim 전 unclaimed 기록은 명확히 분리 표시
- [ ] 빈 상태와 데이터 있는 상태가 Figma 기준으로 모두 구현
- [ ] 공개/비공개 정책이 문서와 UI에서 일치
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm build` 통과

---

## Phase 10 — Add Record UI

### 목적

기록 추가 UI를 구현한다. 사용자가 기록 탭에서 Route를 검색하고 날짜/미디어 URL을 입력해 수동 Beta 또는 사용자 기록을 만들 수 있게 한다.

### Figma

- [기록 추가 UI 1](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=56-1439&t=Nj8NzKW38WUPfN3F-4)
- [기록 추가 UI 2](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=56-1457&t=Nj8NzKW38WUPfN3F-4)

### 개발 범위

- 기록 탭의 `기록 추가` 진입점
- Route 검색 UI
  - route name
  - grade
  - crag/boulder context
  - published route boundary
- 완등 날짜 입력
- Instagram/YouTube URL 입력과 platform normalization
- 로그인 사용자 기반 Beta 생성 또는 기존 manual Beta flow 확장
- 생성 후 pending/approved 정책 결정
  - 기본은 Phase 5 정책과 맞춰 `pending` 생성 후 관리자 검수
  - 신뢰 사용자 자동 승인 여부는 후속 정책으로 둠
- 중복 URL/외부 media id 방지
- 생성 성공 후 `/me/records` 반영

### 명시적 제외

- Instagram OAuth 기반 소유권 검증
- 영상 업로드 원본 저장
- 고급 통계/분석
- 소셜 공유 자동화

### 출시 게이트

- [ ] 로그인 사용자가 Route를 검색해 기록을 추가할 수 있음
- [ ] Instagram/YouTube URL validation과 canonical id dedupe가 동작
- [ ] 생성된 기록이 관리자 검수 상태와 사용자 표시 정책에 맞게 저장됨
- [ ] 성공 후 `/me/records`에서 상태가 명확히 표시됨
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm build` 통과

---

## 단계 간 의존 관계

```text
Phase 1 UI baseline
  -> Phase 2 DB-backed public read path
    -> Phase 3 Admin operations
      -> Phase 4 Public/Admin UX refinement
        -> Phase 5 Beta / Instagram
          -> Phase 6 Login / Account Management
            -> Phase 7 Route Detail UX Update
              -> Phase 8 Project Tab / Favorites
                -> Phase 9 Records Tab
                  -> Phase 10 Add Record UI
```

병행 가능:

- Phase 7 Route 상세 UX는 Phase 8 favorites schema와 독립적으로 진행 가능
- OAuth provider production 검수는 Phase 7-8과 병행 가능
- Meta production 검수와 webhook 실이벤트 검증은 Phase 7-9와 병행 가능
- Favorites schema 설계와 Records read model 설계는 Phase 8 착수 전 함께 검토 가능

## 변경 관리

- 본 ROADMAP은 단계 경계와 게이트 조건만 관리한다.
- 세부 이슈/스프린트는 별도 트래커에서 운영한다.
- 단계 정의 자체가 바뀌면 새 ADR을 추가하고 본 문서를 갱신한다.
