---
id: 0009
title: unstable_cache + tag 기반 무효화
status: Accepted
date: 2026-05-13
---

## Context

트래픽의 90% 이상이 공개 콘텐츠 GET 요청(홈, Crag/Sector 상세, Route 상세, Map)이다. D1은 HTTP API 원격 호출이므로 매 요청마다 DB를 때리면 TTFB 목표(<200ms)를 맞추기 어렵다. 한편 관리자 CRUD는 빈도가 낮지만 즉시 반영이 필요하다.

## Decision

공개 콘텐츠는 Next.js `unstable_cache`로 감싸고, tag 기반 무효화를 사용한다.

| 자원 | 태그 |
|------|------|
| 홈 데이터 | `home`, `areas:list` |
| Crag 상세 | `crag:<id>` |
| Sector 상세 | `sector:<id>` |
| Boulder | `boulder:<id>` |
| Route | `route:<id>` |
| Announcement | `announcements:list` |

Mutation Server Action은 작업 완료 후 관련 tag와 path를 `revalidateTag` / `revalidatePath`로 무효화한다. 관리자 데이터·개인화 데이터는 캐시하지 않는다.

## Consequences

- 캐시 히트 시 D1 호출 0회 → TTFB·비용 모두 개선.
- 단점: tag 누락 시 stale 데이터가 노출 → mutation 코드 리뷰 시 tag 무효화 체크가 의무 항목.
- 다중 Phase 무효화(예: Route 수정 → Crag 카운트 표시)에 대비해 mutation별로 무효화 대상 목록을 문서화한다.

## Alternatives considered

- **HTTP 캐시 헤더만**: D1 호출은 줄지 않음.
- **Redis/KV 캐시**: 인프라 추가 부담. Next.js 빌트인으로 충분.
