# D1 읽기 경로 왕복 완화 (집계 SQL + HTTP 배치) 설계

날짜: 2026-07-09
상태: 승인됨 (A + B 범위)

## 문제

D1을 REST API로 호출하는 구조(ADR 0003)에서 쿼리 1개 = HTTPS 왕복 150~400ms.
`lib/db/repository.ts`의 공개 읽기 로더들은 캐시 미스 시 요청 수가 데이터 양에
비례해 늘어난다:

| 로더 | 현재 요청 수 | 원인 |
|------|-------------|------|
| `loadHomeModel` | 5 + 크랙 수 N | 크랙마다 `getCragStats` |
| `loadAreaBySlug` | 6 + N | 크랙마다 `getCragStats` |
| `loadCragBySlug` | 5 | 병렬이지만 요청 5개 |
| `loadSectorBySlug` | 4 | 2 waves × 2 |
| `loadBoulderById` | 2 + 토포 수 N | 토포마다 `getTopoRoutes` |
| `loadTopoById` | 3 | |
| `loadAllRouteItems` | 1 + 지역 N + 크랙 M | 이중 루프 |

`unstable_cache`가 반복 진입은 흡수하지만, 미스 1회의 지연과 D1 API 요청 수
(비용·레이트리밋)가 문제.

## 범위 A — 집계 SQL로 N→1

`lib/db/queries.ts`에 추가 (기존 함수 시그니처 변경 없음):

- `getAllCragStats(areaId?)`: 크랙별 sectors/boulders/routes 카운트를
  단일 쿼리(크랙별 상관 서브쿼리)로 반환. `getCragStats`의 published/soft-delete
  필터 의미론 동일. `loadHomeModel`(전체) / `loadAreaBySlug`(areaId 필터) 사용.
- `getBoulderTopoRoutes(boulderId)`: 볼더의 published 토포 전체의 루트를
  `topoId` 포함 단일 쿼리로 반환. repository에서 topoId로 그룹핑.
- `getAllRouteItemsFlat()`: 전체 published 루트를 크랙 필터 없이 단일 쿼리로.
  `loadAllRouteItems`의 이중 루프 대체.

## 범위 B — D1 HTTP 배치

- `lib/db/d1-http.ts`:
  - `D1Query<T>` 디스크립터 타입: `{ sql, params, map(rows) => T }`.
  - `batchD1(queries)`: 공식 배치 바디 `{ batch: [{ sql, params }, ...] }` 1회
    POST. 응답 `result[]`는 statement별 1엔트리 — 길이 불일치 시 throw.
    가변 튜플 제네릭으로 각 디스크립터의 매핑 결과 튜플 반환.
    (Cloudflare API 스키마 확인됨: `D1SingleQuery | MultipleQueries{batch}`)
- `lib/db/queries.ts`: 로더 핫패스 쿼리마다 디스크립터 빌더(`xxxQuery()`) 노출.
  기존 async 함수는 빌더를 사용해 동작 유지 (내부 리팩터링만).
- `lib/db/repository.ts`: 로더의 병렬 wave를 `batchD1` 1요청으로 병합.

### 적용 후 요청 수 (캐시 미스 기준)

| 로더 | 전 | 후 |
|------|----|----|
| `loadHomeModel` | 5+N | **1** |
| `loadAreaBySlug` | 6+N | **2** (slug 조회 → 배치) |
| `loadCragBySlug` | 5 | **2** |
| `loadSectorBySlug` | 4 | **2** |
| `loadBoulderById` | 2+N | **1** |
| `loadTopoById` | 3 | **2** |
| `loadAllRouteItems` | 1+N+M | **1** |

## 범위 외

- 뮤테이션(Server Actions) 경로 — 오늘자 pending-ux-perf 설계에서 별도 처리됨.
- admin 읽기 경로 (`admin-read-queries.ts`) — 트래픽 낮음, 후속 과제.
- D1 바인딩 전환 / 런타임 이동 — ADR 0003 유지.

## 테스트

- `d1-http.test.ts`: batchD1 요청 바디 형태, statement별 결과 매핑, 결과 수
  불일치·에러 엔벨로프 throw, params 기본값.
- `queries.test.ts`: 신규 집계 쿼리 3종 + 디스크립터 빌더가 기존 함수와 동일한
  SQL/매핑을 쓰는지.
- `repository.test.ts`: 디스크립터 빌더 목 + `batchD1` 목으로 로더 산출물 검증
  (기존 픽스처 유지), 로더별 HTTP 요청 횟수 검증.

## 캐시 영향

캐시 키·태그 변경 없음. 로더 반환 타입 변경 없음 → 페이지 컴포넌트 무변경.
