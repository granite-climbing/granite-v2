---
id: 0018
title: 민감 좌표는 관리자 큐레이션으로 통제하고 coord_precision 컬럼은 두지 않는다
status: Accepted
date: 2026-05-29
---

## Context

초기 설계(ADR 이전 문서)는 자연 볼더링 스팟의 환경 보호를 위해 `boulders.coord_precision`(`exact` / `approximate` / `hidden`) 컬럼으로 민감 좌표의 공개 정밀도를 DB에서 제어하는 것을 전제했다. AGENTS.md `좌표/지도` 절, ARCHITECTURE.md 지도 절, PRD.md 리스크/오픈 이슈에 해당 정책 흔적이 남아 있었다. 다만 PRD에서 "민감 스팟 좌표 정밀도 운영 기준"은 미확정 오픈 이슈로 남아 있었다.

Phase 2 데이터 레이어를 D1로 정리하면서, 이 정밀도 컬럼을 실제로 운영할지 결정해야 했다. 현재 콘텐츠는 전량 관리자가 큐레이션해 등록하며(비로그인 사용자 입력 없음), Boulder는 공개(`is_published`) 여부를 행 단위로 제어한다.

## Decision

`coord_precision`(및 사용되지 않던 `rock_type`) 컬럼을 스키마에서 제거한다. 민감 좌표는 별도의 정밀도 enum이 아니라 **관리자 큐레이션 + 공개 플래그 + 설명 텍스트**로 통제한다.

- 민감한 스팟은 애초에 등록하지 않거나, 등록하더라도 `is_published = 0`으로 비공개 처리한다.
- 접근·주의가 필요한 안내는 `description`(Crag/Sector/Route) 등 텍스트 필드에 관리자가 직접 작성한다.
- `boulders.lat`/`lng`에는 **공개 가능한 정확 좌표만** 저장한다. 즉 published Boulder의 좌표는 그대로 노출돼도 되는 값이라는 것을 등록 시점에 관리자가 보장한다.

## Consequences

- 스키마가 단순해지고, 정밀도 enum·좌표 라운딩·노출 분기 로직이 불필요해진다.
- 민감 좌표 보호 책임이 DB 컬럼에서 **관리자 큐레이션 규율**로 이동한다. Phase 3 Admin CRUD에서 Boulder 등록 시 "공개 가능한 좌표인가"를 확인하는 운영 가이드/체크가 필요하다.
- "정확히는 숨기되 근사 위치는 공개" 같은 중간 단계는 현재 DB로 표현할 수 없다. 향후 그런 요구가 생기면 새 ADR로 `coord_precision` 또는 visibility 컬럼을 다시 도입한다(롤포워드 마이그레이션, ADR 0014 준수).
- PRD 오픈 이슈 "민감 스팟 좌표 정밀도 운영 기준"은 본 결정(컬럼 기반 정밀도 대신 큐레이션 정책)으로 해소한다.
- AGENTS.md / ARCHITECTURE.md / PRD.md의 관련 서술을 본 ADR 기준으로 갱신한다.

## Alternatives considered

- **`coord_precision` enum 유지**: 운영 기준이 미확정이라 당장 쓰이지 않는 컬럼을 유지하게 되고, public 쿼리/렌더링에 분기 복잡도가 추가된다. 사용처가 생기기 전까지 죽은 필드가 된다.
- **좌표를 라운딩해서 저장**: 비가역적이고 정확도 손실이 크며, 동일 컬럼에 정확/근사가 섞여 운영 의미가 모호해진다.
- **별도 좌표 visibility 테이블 / geofencing**: 현재 데이터 규모와 전량 관리자 큐레이션 구조에 비해 과설계.
