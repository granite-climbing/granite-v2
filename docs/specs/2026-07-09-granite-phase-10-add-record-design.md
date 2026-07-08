# Granite Phase 10 — 기록 추가 UI 설계

> 상태: 설계 승인 (2026-07-09)
> 기준: [docs/ROADMAP.md](../ROADMAP.md) Phase 10, Figma 56-1439 / 56-1457

## 목적

사용자가 루트를 검색하고 완등 날짜를 입력해 자신의 완등 기록을 만들 수 있게 한다. 선택적으로 루트 평가(별점)와 Instagram/YouTube 영상 링크를 함께 등록할 수 있으며, 영상은 기존 수동 Beta 파이프라인으로 흘러간다.

## 확정된 정책 결정

1. **링크 없는 기록 허용.** 루트명 + 완등 날짜만 필수(Figma `*` 표기와 일치). 루트 평가와 영상 링크는 선택.
2. **내 기록은 즉시 반영.** 기록 자체는 생성 즉시 본인 `/me/records` 화면(차트/최근 기록)에 표시된다. 함께 등록한 영상(Beta)만 Phase 5 정책대로 `pending`으로 생성되어 관리자 검수 후 루트 페이지 등 공개 영역에 노출된다.
3. **새 `user_records` 테이블.** 기록과 공개 영상의 생명주기를 분리한다. betas 스키마는 변경하지 않는다.
4. 같은 루트의 재완등 기록 허용(중복 제한 없음).
5. More 시트의 별점/통계/댓글 mock은 Phase 10 범위 밖(로드맵의 "고급 통계/분석 제외" 유지). 별점은 기록 행에 저장만 한다.

## 진입점

| 진입점 | 현재 상태 | Phase 10 동작 |
|--------|-----------|---------------|
| `/me/records` 완등 기록 섹션의 `기록 추가` 버튼 (`components/public/record-send-chart.tsx`) | disabled placeholder | 다이얼로그 열기 (루트 미선택 상태, 검색부터 시작) |
| 루트 상세 More 시트 헤더의 체크(완등 기록) 버튼 (`components/public/route-more-sheet.tsx`) | 시각적 placeholder | 해당 루트가 프리필된 다이얼로그 열기 (검색 스킵). 비로그인 시 `/login?returnTo=` 이동 |

## 데이터 모델

`migrations/0012_user_records.sql` (롤포워드 only):

```sql
CREATE TABLE IF NOT EXISTS user_records (
  id         TEXT PRIMARY KEY,                          -- rec_<uuid>
  user_id    TEXT NOT NULL REFERENCES users(id),
  route_id   TEXT NOT NULL REFERENCES routes(id),
  beta_id    TEXT REFERENCES betas(id),                 -- 영상 링크 등록 시에만
  sent_at    TEXT NOT NULL,                             -- YYYY-MM-DD
  rating     INTEGER CHECK (rating BETWEEN 1 AND 5),    -- 루트 평가 (선택)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX idx_user_records_user_id ON user_records (user_id);
CREATE INDEX idx_user_records_route_id ON user_records (route_id);
```

## Server Actions (`lib/actions/record.ts`)

### `searchRoutesForRecordAction(term)`

- published 경계(area~route 전부 `is_published=1`, `deleted_at IS NULL`) 안에서 루트명 LIKE 검색, 최대 20건.
- 반환: `routeId`, `name`, `grade`, `boulderName`, `sectorName`, `cragName`, `boulderHashtags` (캡션 생성에 필요한 컨텍스트 포함).
- 쿼리는 `lib/db/record-queries.ts`에 추가 (`searchPublishedRoutesForRecord`).

### `addRecordAction(formData)`

1. 세션 검증 (`granite_session` 쿠키, 기존 `/me` 패턴). 비로그인 → 실패 반환.
2. zod 스키마 검증: `routeId` 필수, `sentAt` `YYYY-MM-DD`, `rating` 선택(1~5), `mediaUrl` 선택(URL).
3. `findPublishedRouteIdForBeta`로 published 루트 검증.
4. `mediaUrl`이 있으면 기존 수동 Beta 파이프라인 재사용:
   - `normalizeYouTubeOrInstagramUrl` → platform/external media id 추출
   - 중복 검사 (`findExistingBetaByExternalMedia` / `findExistingBetaByPermalink`) — 중복이면 실패 반환
   - Beta 생성: `source='manual'`, `status='pending'`, **`user_id`를 세션 사용자로 저장**, `claim_status='claimed'`, `sent_at` 동일, thumbnail 획득 시도(기존 로직)
5. `user_records` insert (beta_id는 4에서 생성된 경우만).
6. 성공 반환. `/me/records`는 세션 기반 dynamic 페이지라 별도 revalidate 불필요 (클라이언트에서 `router.refresh()`).

## Read model 교체 (`lib/records/user-records-view.ts`)

mock (`lib/mock/records.ts`) 제거하고 실데이터로:

- **완등 차트/총 완등/최고 그레이드/최근 기록**: `user_records` 기반 새 쿼리 (`getUserRecordsWithRouteContext`) — published 루트 join, `sent_at DESC`. 기존 `getRecordGradeBuckets`/`buildUserRecordsModel` 집계 유틸 재사용(입력 소스만 교체).
- **나의 영상 그리드**: 본인 `user_id`의 betas (`status IN ('pending','approved')`, 미삭제). 본인 화면이므로 pending도 즉시 표시.
- 기존 approved-beta 기반 함수(`getApprovedRecordsByUserId` 등)와 claim candidate 로직은 유지하되 화면 연결은 하지 않는다(claim UI는 후속 Phase).

## UI (`components/public/add-record-dialog.tsx`, client)

Figma 56-1439(검색 전) / 56-1457(검색 후) 기준 full-screen 다이얼로그:

- 헤더: 가운데 `기록 추가`, 우측 X(닫기)
- **루트명\*** 검색 필드: placeholder "문제 이름을 검색해주세요" + 돋보기. 입력 디바운스 후 `searchRoutesForRecordAction` 호출, 결과 리스트(루트명/그레이드/크랙 컨텍스트)에서 선택. 프리필 진입 시 선택 완료 상태로 시작.
- **완등 날짜\***: 기본 오늘, `YYYY / MM / DD` 표기 + 캘린더 아이콘 (native date input 기반).
- 루트 선택 후 노출 (56-1457):
  - **루트 평가**: 별 5개 탭 선택 (선택 사항)
  - **영상 추가**: 안내 문구("아래 캡션을 복사 후, 인스타그램 게시물 포스트 하단에 작성해주세요.") + 캡션 미리보기 박스 + `캡션 복사하고 → Instagram 열기` 버튼 (clipboard 복사 후 instagram.com 새 창)
  - **링크로 영상 추가**: placeholder "Youtube 혹은 Instagram 링크"
- 하단 `추가하기` 버튼: 루트+날짜 있어야 활성. 제출 → `addRecordAction` → 성공 시 닫기 + `router.refresh()`, 실패 시 메시지 표시.

진입점 연결:

- `record-send-chart.tsx`의 기록 추가 버튼 활성화(client 분리 필요 시 wrapper 컴포넌트).
- `route-more-sheet.tsx` 체크 버튼: 로그인 상태(서버에서 내려주는 prop)면 다이얼로그 열기, 아니면 `/login?returnTo=` 이동.

## 캡션

Figma 포맷으로 `buildInstagramCaption` 변경 (topo 페이지 기존 사용처 포함 통일):

```
"Honey No.6" V6 on 허니1, 허니 볼더, 안양예술공원. @granite.kr #안양_허니넘버6
```

- 형식: `"{routeName}" {grade} on {sectorName}, {boulderName}, {cragName}. @granite.kr {hashtags}`
- 웹훅 매칭에 필요한 `@granite.kr` 멘션과 볼더/루트 해시태그는 유지.

## 에러 처리

- 비로그인: action에서 실패 반환(다이얼로그 내 메시지) / More 시트 진입은 로그인 페이지로.
- 중복 영상 URL: "이미 등록된 영상입니다." (기존 문구 재사용)
- unpublished/삭제 루트: "유효하지 않은 루트입니다."
- thumbnail 획득 실패는 기록 생성을 막지 않음 (기존 Beta 파이프라인과 동일).

## 테스트 전략

TDD로 진행:

- `lib/db/record-queries.test.ts`: user_records insert/조회, 루트 검색 쿼리 (기존 queryD1 mock 패턴)
- `lib/actions/record.test.ts`: 스키마 검증, 세션 없음, 중복 URL, 링크 없는 기록, 링크 있는 기록(beta 생성+연결)
- `lib/beta/caption.test.ts`: 새 포맷
- `components/public/add-record-dialog.test.tsx`: 검색 전/후 렌더링, 필수값 게이트, 별점 선택
- `lib/records/user-records-view.test.ts`: mock → 실데이터 교체

완료 게이트: `pnpm test`, `pnpm typecheck`, `pnpm build` 통과.

## 명시적 제외 (로드맵 유지)

- Instagram OAuth 소유권 검증, 영상 원본 업로드, 고급 통계/분석, 소셜 공유 자동화
- More 시트 별점/통계/댓글 실데이터 연동
- unclaimed Beta claim UI
