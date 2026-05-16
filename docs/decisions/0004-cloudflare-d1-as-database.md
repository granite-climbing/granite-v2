---
id: 0004
title: 데이터베이스로 Cloudflare D1 채택
status: Accepted
date: 2026-05-13
---

## Context

초기 데이터 규모는 Route 기준 수천~수만 건, 사용자도 출시 초기에는 수백~수천 명 수준으로 가정한다. 비용·운영 부담을 최소화하면서 R2/CDN과 동일 생태계에 있는 DB가 필요하다. 한편 공간 인덱스나 복잡한 분석 쿼리는 요구사항이 아니다.

## Decision

Cloudflare D1(SQLite)을 채택하고 HTTP API 경로로 접근한다. 공간 검색은 bounding box + 앱 레벨 거리 계산으로 처리하고, PostGIS류는 사용하지 않는다.

## Consequences

- 운영 비용 낮음, R2와 동일 콘솔에서 관리.
- 공간 인덱스 부재 → Map 탭의 Boulder 마커 조회는 `(lat, lng)` 복합 인덱스 + bounding box 1차 필터링 + 거리 계산 순서로 처리.
- 검색은 Phase 1에서 `LIKE %query%`로 충분하다(전체 데이터 < 수천). FTS5는 Phase 2 후보.
- HTTP API는 원격 호출이므로 N+1 쿼리에 취약 → 캐싱과 batch 쿼리 설계 필수.
- 백업: 일 1회 export → R2 backup bucket, 7일 보관.

## Transition trigger

다음 중 하나가 발생하면 Postgres(Neon/Supabase/Vercel Postgres) 전환을 검토한다.

- Route/Beta 합계 > 100k
- p95 공개 페이지 응답 > 500ms가 지속
- 분석 쿼리(통계 화면) 요구가 우선순위 P0로 올라옴
- 공간 검색이 bounding box로 부족한 단계

## Alternatives considered

- **Postgres (Neon/Supabase)**: 풍부한 기능과 PostGIS. 비용·운영 부담이 초기에는 과함.
- **Cloudflare KV**: 관계형 쿼리 부적합.
