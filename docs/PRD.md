# Granite v2 — Product Requirements Document (PRD)

> 작성일: 2026-05-13
> 갱신일: 2026-05-22
> 상태: Draft
> 기준 설계: `docs/specs/2026-05-13-granite-design.md`

## 1. 배경

국내 자연 볼더링 정보는 카페, 블로그, 인스타그램, PDF 토포 등으로 흩어져 있어 신뢰성과 접근성이 낮다. Granite v2는 운영자가 큐레이션한 스팟 정보를 모바일 웹에서 빠르게 탐색하게 하고, Instagram 기반 베타(완등) 기록을 Route 단위로 연결한다.

## 2. 목표

1. 국내 자연 볼더링 콘텐츠를 Area → Crag → Sector → Boulder → Topo → Route 계층으로 정리한다.
2. 모바일 사용자가 스팟, 바위, 루트, 접근 정보를 빠르게 확인할 수 있게 한다.
3. 실제 DB-backed 콘텐츠 조회와 운영자 CRUD를 단계적으로 안정화한다.
4. Instagram 멘션을 통해 Route별 베타 기록을 수집하고 관리자 검수 흐름을 제공한다.
5. 로그인 이후에는 즐겨찾기, 프로젝트, 본인 Beta 관리, unclaimed Beta 클레임을 제공한다.

## 3. 비목표

- 실내 클라이밍장 정보
- 사용자 간 메시징/커뮤니티 게시판
- 결제·예약 기능
- 해외 스팟
- 사용자 제보 기반 자동 게시
- Phase 1에서의 실제 DB/Admin/Instagram/OAuth 운영 완성
- Phase 2에서의 관리자 운영 UI
- Phase 3까지의 사용자 계정/개인화 기능

## 4. 단계별 범위

### Phase 1 — Public UI Baseline

| ID | 기능 | 우선순위 |
|----|------|---------|
| P1-01 | 홈 탐색 화면, Area 탭, Crag 카드, New Updates | P0 |
| P1-02 | Crag 상세 탭(Info/Sector/Boulder/Route/Map/Travel) | P0 |
| P1-03 | Topo 상세, Route 리스트, Route 상세 공유 링크 | P0 |
| P1-04 | 모바일 shell, header/footer/bottom nav, 광고 placeholder | P0 |
| P1-05 | 정책 페이지 3종(`/terms`, `/privacy`, `/data-deletion`) | P0 |
| P1-06 | Figma 로고/이미지 에셋 반영 | P0 |
| P1-07 | mock/seed 데이터 기반 화면 검증 | P0 |
| P1-08 | SEO 메타데이터와 OG 이미지 기본값 | P1 |

Phase 1은 실제 DB/API/Admin 운영 완성을 목표로 하지 않는다. 현재 `phase1-implementation` 브랜치의 public UI 1차 구현을 Phase 1 완료 기준으로 삼는다.

### Phase 2 — DB Migration & Data Layer

| ID | 기능 | 우선순위 |
|----|------|---------|
| P2-01 | D1 schema와 rollforward migration 정리 | P0 |
| P2-02 | Phase 1 mock/seed 콘텐츠의 DB seed/import 전략 | P0 |
| P2-03 | D1 HTTP API client와 typed repository boundary | P0 |
| P2-04 | 홈/Crag/Topo/Route public read path를 DB 데이터로 연결 | P0 |
| P2-05 | 공개 콘텐츠 캐싱과 revalidation tag 준비 | P0 |
| P2-06 | `/healthz` DB ping | P1 |

### Phase 3 — Admin Operations

| ID | 기능 | 우선순위 |
|----|------|---------|
| P3-01 | 관리자 이메일+비밀번호 로그인과 `granite_admin` 세션 | P0 |
| P3-02 | Area/Crag/Sector/Boulder/Topo/Route CRUD | P0 |
| P3-03 | R2 이미지 업로드/정렬/삭제와 CDN 이미지 서빙 | P0 |
| P3-04 | 공지(Announcement) CRUD와 홈 New Updates 연동 | P0 |
| P3-05 | Server Action 권한 검증, Zod 검증, revalidation | P0 |
| P3-06 | 관리자 audit log | P1 |

### Phase 4 — Beta / Instagram

| ID | 기능 | 우선순위 |
|----|------|---------|
| P4-01 | Route별 Instagram 캡션 생성/복사 UI | P0 |
| P4-02 | Cloudflare Worker `GET/POST /webhooks/instagram` 수신 및 HMAC 검증 | P0 |
| P4-03 | WebhookInbox 저장, 멱등 처리, 원본 payload audit | P0 |
| P4-04 | 캡션의 Boulder/Route/운영 해시태그 기반 Route 매칭과 unclaimed Beta 생성 | P0 |
| P4-05 | 관리자 웹훅 인박스 수동 매칭/거절 | P0 |
| P4-06 | 관리자 베타 숨김/삭제 모더레이션 | P0 |
| P4-07 | 베타 썸네일 수집과 R2 저장, 실패 시 기본 이미지 처리 | P1 |
| P4-08 | 비로그인 수동 베타 등록(Instagram/YouTube URL + 핸들/표시명) | P0 |

Phase 4는 로그인 없이 동작하는 수집/운영 흐름에 한정한다. 수동 베타 등록은 Instagram/YouTube 링크 기반 unclaimed Beta로 저장한다. 내 기록, 프로젝트, 클레임은 Phase 5에 포함한다.

### Phase 5 — Login / Favorites / Claims

| ID | 기능 | 우선순위 |
|----|------|---------|
| P5-01 | Kakao/Naver/Google/Apple OAuth 로그인 | P0 |
| P5-02 | 사용자 세션, 마이페이지, 프로필 설정 | P0 |
| P5-03 | Route 즐겨찾기와 프로젝트 탭 | P0 |
| P5-04 | 내 기록 탭과 본인 Beta 관리 | P0 |
| P5-05 | Instagram 핸들 등록 후 unclaimed Beta 클레임 | P0 |
| P5-06 | 계정 머지와 OAuth provider 연결/해제 | P1 |
| P5-07 | 공개 프로필(`/u/<user-id>`)과 공개 범위 설정 | P1 |

## 5. 타겟 사용자

| 페르소나 | 설명 | 핵심 니즈 |
|---------|------|----------|
| 탐험형 클라이머 | 새로운 자연 볼더링 스팟을 찾아다님 | 신규/숨은 스팟, 접근법, 좌표 |
| 주말 볼더러 | 가까운 스팟 위주로 등반 | 거리, 난이도, 주차, 시즌 |
| 여행 클라이머 | 출장/여행 중 지역 등반 | 지역별 스팟 클러스터, 여행 정보 |
| 운영자 | 콘텐츠를 직접 큐레이션 | 빠른 CRUD, 이미지 관리, 검수 |

## 6. 핵심 사용자 시나리오

### S1. 홈에서 지역별 Crag 탐색

사용자는 홈에서 Area 탭을 선택하고, 지역 통계와 Crag 카드를 확인한다. Crag 카드를 탭하면 Crag 상세로 이동한다.

### S2. Crag/Sector 상세 확인

사용자는 Crag 상세의 Info/Sector/Boulder/Route/Map/Travel 탭에서 설명, Sector 목록, Boulder 목록, Route 목록, 지도 마커를 확인한다. Sector 상세에서는 해당 Sector 범위의 Info/Boulder/Route/Map/Travel 정보를 확인한다.

### S3. Boulder와 Route 확인

사용자는 Boulder 카드를 탭해 바텀시트를 열고 Topo 이미지와 Route 리스트를 확인한다. Route는 공유 가능한 `/r/<route-id>` 링크를 가진다.

### S4. Instagram 베타 자동 수집

사용자는 Route 화면에서 캡션을 복사해 Instagram에 게시한다. Granite는 멘션 웹훅을 수신하고 Route를 매칭해 Beta를 생성한다. 가입 전 기록은 unclaimed 상태로 남는다.

### S5. 비로그인 수동 베타 등록

사용자는 로그인 없이 Route 화면에서 Instagram 또는 YouTube 링크와 표시명/Instagram 핸들을 입력해 베타를 등록한다. 기록은 unclaimed 상태로 저장되고 관리자 검수 대상이 된다.

### S6. 로그인 후 개인화

사용자는 OAuth로 로그인한 뒤 Route를 프로젝트에 저장하고, 본인 Beta를 관리하고, 자신의 Instagram 핸들과 일치하는 unclaimed Beta를 클레임한다.

### S7. 관리자 운영

관리자는 콘텐츠와 이미지를 등록하고, 웹훅 인박스에서 미매칭 게시물을 Route에 연결하거나 거절하며, 부적절한 베타를 숨김/삭제한다.

## 7. 콘텐츠 모델

```
Area ──< Crag ──< Sector ──< Boulder ──< Topo ──< Route
```

- **Area**: 수도권, 강원, 충청, 전라, 경상 등 상위 지역.
- **Crag**: 등반지 단위. Area에 속하고 선택 좌표를 가진다.
- **Sector**: 접근/주차/운영 단위. Crag에 속하고 선택 좌표를 가진다.
- **Boulder**: 한 바위. Sector에 속하고 필수 좌표를 가진다.
- **Boulder hashtag**: 캡션 생성/매칭에 쓰는 운영 관리 해시태그 목록.
- **Topo**: 바위의 한 면. 베이스 면 사진을 가진다.
- **Route**: 라인. Topo에 속하고 이름, V등급, FA, 설명, 라인 이미지, 베타 기록을 가진다.
- **Image URL**: 별도 polymorphic Image 엔티티 없이 각 콘텐츠 엔티티의 URL 컬럼으로 저장한다.
- **Beta source/platform**: Beta는 수동/웹훅 여부와 Instagram/YouTube 플랫폼을 별도로 가진다.

## 8. UX 요구사항

### 8.1 폼팩터

- 모바일 전용을 기본으로 하고 데스크톱은 max-width 480 컨테이너로 렌더한다.
- 홈은 지도 화면이 아니라 탐색 메인이다. 지도는 Crag/Sector 상세의 Map 탭에 제공한다.

### 8.2 네비게이션

**하단 탭바** (전역):

| 탭 | 경로 | 비고 |
|----|------|------|
| 홈 | `/` | 메인 탐색 |
| 기록 | `/me/records` | Phase 5 |
| 프로젝트 | `/me/projects` | Phase 5 |
| 마이 | `/me` | Phase 5 |

Phase 1~4에서는 기록/프로젝트/마이 탭은 로그인 유도 또는 coming soon 상태로 렌더한다.

**상단 네비게이션**: 로고(좌) + 햄버거 메뉴 아이콘(우). 햄버거 메뉴 항목:

- Home
- Crag
- Culture (서브메뉴: Travel / Rock Trip)

### 8.3 마이페이지의 외부 계정 연결 정책

마이페이지의 Instagram, YouTube 계정 연결은 OAuth가 아닌 **사용자가 핸들(또는 채널 ID)을 직접 입력**하는 방식이다. Instagram OAuth 소유 증명과 YouTube OAuth 연동은 MVP 범위에 포함하지 않는다.

- **Instagram**: 핸들 문자열 입력. unclaimed Beta 클레임의 키로 사용한다.
- **YouTube**: 채널 ID 또는 URL 문자열 입력. 사용자 프로필 표시 용도.

### 8.4 검색

- 통합 검색 입력: "문제, 볼더, 섹터, 암장, 난이도 검색".
- Phase 2는 D1 `LIKE %query%` 기반으로 충분하다(전체 데이터 < 수천).
- 결과는 카테고리별 그룹핑 (Route / Boulder / Sector / Crag).
- FTS5 도입은 Phase 4 이후 후보로 둔다.

### 8.5 광고 슬롯

광고 슬롯은 초기에는 회색 placeholder(`bg-[#d9d9d9]`)로 렌더하고 실제 연동은 후속 단계로 둔다. 배치 위치는 다음과 같다.

**홈 (4슬롯, 각 360×56)**
1. 통합 검색바 아래
2. Area 섹션(통계 카드 + Crag 가로 스크롤) 아래
3. New Updates 섹션 아래
4. 업데이트 뉴스 리스트 아래

**기록 탭 (1슬롯)**
- 화면 하단

### 8.6 접근성

- 키보드 네비게이션, 의미 있는 alt 텍스트, 버튼 레이블, 충분한 색 대비를 보장한다.
- 모바일 우선 환경에서 터치 타깃은 최소 44×44pt를 권장.

### 8.7 권한 매트릭스

| 작업 | 비로그인 | 일반 유저 | 관리자 |
|------|:--------:|:---------:|:------:|
| 콘텐츠 열람 (Crag/Sector/Boulder/Route) | ✅ | ✅ | ✅ |
| 캡션 복사 → Instagram 공유 | ✅ | ✅ | ✅ |
| 수동 베타 등록 (URL + 핸들) | ✅ | ✅ | ✅ |
| 즐겨찾기(프로젝트) | ❌ | ✅ | ✅ |
| 자기 베타 삭제 | — | ✅ | ✅ |
| Instagram 핸들 기반 unclaimed Beta 클레임 | — | ✅ | ✅ |
| 콘텐츠 CRUD (Area~Route) | ❌ | ❌ | ✅ |
| 공지(Announcement) CRUD | ❌ | ❌ | ✅ |
| 베타 모더레이션(숨김/삭제) | ❌ | ❌ | ✅ |
| 웹훅 인박스 매칭/거절 | ❌ | ❌ | ✅ |
| 회원 목록/검색 (Phase 5) | ❌ | ❌ | ✅ |

"비로그인" 열의 Beta 관련 ✅ 작업은 Phase 4부터 가능하다. 일반 유저 전용 작업은 모두 Phase 5 범위다.

## 9. 개인정보 및 정책

### 9.1 정책 문서

서비스 내 회원가입, 로그인, 마이페이지, 푸터에는 다음 공개 문서의 원문을 파싱/이관한 내부 정적 페이지를 제공한다. 원본 URL은 출처와 동기화 기준으로 유지한다.

- 이용약관: `https://granite.kr/terms/`
- 개인정보처리방침: `https://granite.kr/privacy/`
- 데이터 삭제 안내: `https://granite.kr/data-deletion/`

### 9.2 수집 항목

| 단계 | 항목 | 목적 |
|------|------|------|
| Phase 1 | 없음 또는 운영자가 제공한 정적/mock 콘텐츠 | public UI 검증 |
| Phase 2 | 공개 콘텐츠 DB 레코드, 좌표, 이미지 URL 문자열 | public read path |
| Phase 3 | 관리자 이메일, 비밀번호 해시, 관리자 audit log | 관리자 인증/운영 추적 |
| Phase 4 | Instagram username/id, 게시물 id, caption, Instagram/YouTube media URL, thumbnail URL, raw webhook payload, 수동 등록 표시명/핸들 | 베타 수집, 중복 방지, audit |
| Phase 5 | OAuth provider uid, 이메일, 표시 이름, 아바타, Instagram 핸들 | 로그인, 계정 식별, Beta 클레임 |
| Phase 5 선택 | 키, 암스팬, 몸무게, YouTube ID | 프로필/기록 분석 기반 |

### 9.3 공개 범위와 클레임

- 신체정보, 기록, 프로젝트는 기본 비공개를 우선한다.
- Instagram 핸들만으로 생성된 unclaimed Beta는 소유권 확인 전까지 특정 사용자에게 자동 공개 귀속하지 않는다.
- Phase 5 클레임은 로그인 사용자 입력과 기존 unclaimed Beta를 연결하되, 사칭 리스크를 줄이기 위해 관리자 검토 또는 소유 증명 흐름을 둘 수 있게 설계한다.

### 9.4 삭제/탈퇴

- 회원탈퇴 시 OAuth identity, 세션, 프로필 식별정보는 삭제한다.
- 사용자가 직접 등록한 수동 Beta는 삭제 또는 익명화 중 정책 문서 기준을 따른다.
- Instagram 웹훅 audit payload는 운영상 필요한 최소 기간만 보관하고 이후 삭제/익명화한다.

## 10. 비기능 요구사항

- **성능**: 주요 공개 페이지 LCP < 2.0s (4G 모바일 기준)
- **캐싱**: 공개 콘텐츠는 `unstable_cache` + tag 기반 무효화
- **이미지**: WebP/AVIF 자동 서빙, 리스트 썸네일 ≤ 50KB 목표
- **SEO**: Crag/Sector/Route 상세는 크롤링 가능한 메타데이터와 OG 이미지 제공
- **보안**: 모든 외부 입력 Zod 검증, SQL parameter binding, 관리자 이중 인가
- **가용성**: Vercel + Cloudflare 관리형 서비스 기반 99.9% 목표
- **언어**: 한국어 우선. i18n 구조는 열어두되 초기 출시는 ko만.

## 11. 성공 지표

- 등록된 Crag/Sector/Boulder/Route 수
- 홈 → Crag 상세 진입률
- Crag/Sector 상세 체류 시간
- Route 상세 공유/캡션 복사 수
- WebhookInbox 매칭 성공률
- 로그인 전환율, 프로젝트 저장 수, 수동 Beta 등록 수

## 12. 리스크와 가정

| 항목 | 내용 | 대응 |
|------|------|------|
| 콘텐츠 확보 | 초기 큐레이션 비용이 큼 | Phase 2 seed/import와 Phase 3 관리자 입력 UX 우선 |
| 환경 보호 | 민감 스팟 공개로 훼손 우려 | 관리자 큐레이션으로 통제: 미등록 또는 비공개(`is_published=0`), 안내는 `description`에 작성. 별도 좌표 정밀도 컬럼 미사용 (ADR 0018) |
| 저작권 | 사진·Topo 이미지 권리 필요 | 출처/촬영자 메타데이터 필수 |
| DB 전환 | mock UI와 실제 D1 데이터 간 불일치 | Phase 2를 별도 마일스톤으로 분리 |
| 관리자 운영 | CRUD/이미지/권한 검증 범위가 큼 | Phase 3에서 운영 기능만 집중 검증 |
| Instagram 검수 | Meta 앱 검수가 일정에 영향 | Phase 4를 별도 마일스톤으로 분리 |
| Naver 검수 | 비즈니스 검수 절차 필요 | Phase 5 일정 버퍼 확보 |
| 클레임 사칭 | IG 핸들 입력만으로 오귀속 가능 | 관리자 검토/소유 증명 확장 가능 구조 |

## 13. 오픈 이슈

- [ ] 캡션 해시태그 정규화 규칙과 중복 이름 처리 정책
- [x] 민감 스팟 좌표 정밀도 운영 기준 → 관리자 큐레이션으로 통제, 정밀도 컬럼 미사용으로 확정 (ADR 0018)
- [ ] unclaimed Beta 클레임 시 관리자 승인 필요 여부
- [ ] 실제 광고 연동 시점과 공급자
