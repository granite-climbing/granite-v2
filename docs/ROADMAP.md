# Granite v2 — Roadmap

> 작성일: 2026-05-13
> 상태: Draft
> 기준 문서: [docs/PRD.md](PRD.md), [docs/ARCHITECTURE.md](ARCHITECTURE.md), [docs/decisions/](decisions/README.md)

3단계 출시 ([ADR 0008](decisions/0008-phased-release-1-2-3.md))의 마일스톤, 사전 작업, 게이트 조건을 정리한다. 일정은 인프라 검수(Meta/Naver 등)의 외부 의존이 있어 절대 일정 대신 **선후관계**와 **준비 체크리스트** 위주로 기록한다.

## 마일스톤 개요

| Phase | 사용자 가치 | 출시 조건 |
|:-----:|------------|----------|
| Phase 1 | 큐레이션된 자연 볼더링 콘텐츠 탐색 | 콘텐츠 시드 확보 + 관리자 운영 가능 |
| Phase 2 | Instagram 기반 베타 수집 + 비로그인 수동 등록 | Meta 앱 검수 통과 + 관리자 인박스 운영 |
| Phase 3 | OAuth 로그인 / 즐겨찾기·기록 / unclaimed Beta 클레임 | OAuth 4종 검수 + 정책 페이지 확정 |

각 Phase는 독립 배포 가능하다. 다음 Phase가 직전 Phase의 기능을 제거하지 않는다.

---

## Phase 1 — 탐색 / 관리자 CRUD

### 사전 준비 (개발 착수 전)

- [ ] 도메인 `granite.kr` 소유권 정리 + Cloudflare DNS 위임
- [ ] `cdn.granite.kr` Cloudflare CDN + Image Resizing + R2 origin 설정
- [ ] 카카오맵 JS 키 발급 + 도메인 화이트리스트 (`granite.kr`, `*.vercel.app` preview)
- [ ] D1/R2 production 리소스 생성 (`granite-prod`, `granite-prod-images`)
- [ ] Vercel 프로젝트 생성 + `icn1` 리전 고정
- [ ] 관리자 계정 1개 마이그레이션 또는 CLI로 생성 준비
- [ ] 초기 콘텐츠 시드 계획 (Crag 최소 N개, 운영자 작성 분담)
- [ ] Figma 최종본 확정 (Ver.2 기준, 컴포넌트 토큰 정리)

### 개발 범위

- 공개 화면: 홈, Crag 상세 (Info/Sector/Boulder/Route/Map/Travel), Sector 상세 (Info/Boulder/Route/Map/Travel), Boulder 바텀시트, Route 상세, 공지
- 관리자: Area/Crag/Sector/Boulder/Topo/Route CRUD, 이미지 업로드, 공지 CRUD, 관리자 인증
- 인프라: Vercel + Cloudflare D1/R2/CDN, `unstable_cache` + revalidateTag, healthz, SEO 메타데이터

### 출시 게이트 (Go/No-Go)

- [ ] 시드 Crag/Sector/Boulder/Route 입력 완료 (운영팀 합의 수치 이상)
- [ ] 모든 P0 기능의 모바일 QA 통과
- [ ] LCP < 2.0s (4G, 주요 상세 페이지)
- [ ] 관리자 계정 비밀번호 회전 SOP 합의
- [ ] 정책 페이지 3종(`/terms`, `/privacy`, `/data-deletion`) 앱 내 이관 ([ADR 0015](decisions/0015-policy-docs-mirrored-in-app.md))
- [ ] D1 일일 export → R2 backup bucket 7일 보관 동작 확인 ([ADR 0004](decisions/0004-cloudflare-d1-as-database.md))

### 위험 / 의존

- **콘텐츠 확보 지연**: Phase 1의 가장 큰 일정 리스크. 운영자 1명 기준 큐레이션 속도 측정 필요.
- **저작권**: 사진/Topo 이미지 출처와 사용 허가. 운영 SOP 사전 정의.

---

## Phase 2 — 베타 / Instagram 웹훅

### 사전 준비 (Phase 1과 병행 시작 권장 — 검수 리드타임 ↑)

- [ ] Instagram **비즈니스 계정** 또는 크리에이터 계정 준비
- [ ] Meta for Developers 앱 생성 + Instagram Graph API 권한 신청
- [ ] 웹훅 endpoint(`https://<worker-domain>/webhooks/instagram`) 등록 + 검수 제출
- [ ] `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` 발급 + Worker secret 등록
- [ ] HMAC 검증 로직 단위 테스트 fixture 준비
- [ ] 캡션 정규화 규칙 확정 (공백/대소문자/특수문자 처리, [PRD 오픈 이슈](PRD.md#13-오픈-이슈))
- [ ] 동명 Boulder/Route 처리 운영 정책 확정
- [ ] 웹훅 raw payload 보관 기간 확정 (개인정보처리방침과 정합)

### 개발 범위

- Cloudflare Worker: `GET/POST /webhooks/instagram`, `webhook_inbox` 적재, Route 매칭, Beta 생성, 썸네일 동기 수집
- 비로그인 수동 Beta 등록 Server Action (Instagram/YouTube URL + 핸들 + 날짜)
- 관리자: 웹훅 인박스 (`unmatched` 수동 매칭 / 거절), 베타 모더레이션 (숨김/삭제)
- Route 상세에 캡션 생성기 UI

### 출시 게이트

- [ ] Meta 앱 검수 승인
- [ ] 웹훅 HMAC 검증 통과 (production 시크릿)
- [ ] 캡션 → 매칭 → Beta 생성 end-to-end 시나리오 검증 (스테이징에서 실제 IG 게시)
- [ ] 동명 Boulder 케이스에서 unmatched 처리 동작 확인
- [ ] 썸네일 수집 실패 시 기본 이미지 폴백 동작 확인
- [ ] 관리자 인박스 SOP 문서화 (어떤 케이스를 reject할지)

### 위험 / 의존

- **Meta 검수 일정**: 외부 의존, 수 주~수 개월 가능. **Phase 1 진행 중 병행 시작 필수**.
- **사칭 IG 핸들**: 수동 등록 시 타인 핸들 입력 가능 → 관리자 모더레이션으로 1차 방어. ([ADR 0012](decisions/0012-unclaimed-beta-by-ig-handle.md))
- **썸네일 수집 안정성**: oEmbed/og:image 변동 가능. 실패 허용 + 재시도는 후속.

---

## Phase 3 — 로그인 / 즐겨찾기 / 클레임

### 사전 준비

- [ ] OAuth 4종 앱 등록
  - [ ] Kakao Developers: `account_email`, `profile_nickname` 스코프
  - [ ] Naver Developers: 비즈니스 서비스 검수 제출 (일정 여유 확보)
  - [ ] Google Cloud: OpenID 스코프
  - [ ] Apple Developer: Sign in with Apple, Service ID, Private Key 발급
- [ ] 리다이렉트 URL 등록: `https://granite.kr/api/auth/callback/<provider>`
- [ ] `JWT_SECRET` 생성 (관리자 시크릿과 별도)
- [ ] 정책 페이지가 회원가입/마이페이지/탈퇴 흐름에 노출되는지 확인
- [ ] 회원탈퇴 시 데이터 삭제·익명화 처리 SOP 확정
- [ ] unclaimed Beta 클레임 정책 확정 (즉시 귀속 vs 관리자 검토)

### 개발 범위

- OAuth 4종 콜백 + 세션 (`granite_session` cookie, 30일 sliding)
- 마이페이지: 프로필 편집, IG/YouTube 핸들 직접 입력, 공개 범위 토글, 계정 연결/해제
- 즐겨찾기(Route) + 프로젝트 탭, 내 기록 탭, 본인 Beta 관리
- IG 핸들 등록 시 unclaimed Beta 일괄 클레임
- 관리자: 회원 목록/검색, 통계 대시보드, 캡션 템플릿 GUI, Region 시드 GUI

### 출시 게이트

- [ ] OAuth 4종 모두 production에서 가입/로그인/머지 동작 확인
- [ ] Apple Private Relay 케이스 별도 계정 생성 검증
- [ ] 동일 이메일 머지 안내 동작 검증
- [ ] unclaimed Beta 클레임 시 audit 로그 남는지 확인
- [ ] 회원탈퇴 시 OAuth identity / 세션 / 식별정보 삭제 확인

### 위험 / 의존

- **Naver 비즈니스 검수**: 일정 여유 필요.
- **Apple 첫 로그인 이메일/이름 1회성 전달**: 콜백 시점 즉시 저장 필수.
- **클레임 사칭**: MVP는 형식 검증만 수행, 사후 관리자 무효화로 대응. 향후 IG OAuth 소유 증명으로 확장 가능 ([ADR 0012](decisions/0012-unclaimed-beta-by-ig-handle.md)).

---

## 단계 간 의존 관계

```
Phase 1 ──┬──> Phase 2 (콘텐츠 + Crag/Route가 있어야 매칭 가능)
          └──> Phase 3 일부 (마이페이지 인프라는 Phase 2 무관 진행 가능)

Phase 2 ──> Phase 3 클레임 (unclaimed Beta 데이터가 있어야 클레임 가치)

병행 가능: Meta 검수 (Phase 2 사전 준비) + Phase 1 개발
병행 가능: Naver 검수 (Phase 3 사전 준비) + Phase 2 개발
```

## 변경 관리

- 본 ROADMAP은 단계 경계와 게이트 조건만 관리한다.
- 세부 이슈/스프린트는 별도 트래커에서 운영.
- 단계 정의 자체가 바뀌면 [ADR 0008](decisions/0008-phased-release-1-2-3.md)을 새 ADR로 supersede 하고 본 문서를 갱신한다.
