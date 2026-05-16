---
id: 0014
title: 마이그레이션 롤포워드 only
status: Accepted
date: 2026-05-13
---

## Context

D1 환경에서 down 마이그레이션은 데이터 손실 위험과 운영 복잡도가 크다. Phase별 점진 출시에서는 "되돌리기"보다 "앞으로 고치기"가 안전하다. 한편 컬럼 삭제/이름 변경처럼 호환성을 깨는 변경은 배포 순서에 따라 다운타임을 유발할 수 있다.

## Decision

- 마이그레이션은 **롤포워드 only**. down 마이그레이션을 작성하지 않는다.
- 컬럼 삭제/이름 변경은 3단계로 분리한다.
  1. 새 컬럼 추가 (병행 보관)
  2. 코드가 새 컬럼만 사용하도록 전환 + 데이터 백필
  3. 옛 컬럼 삭제
- 배포 전 `wrangler d1 migrations apply`를 수동 또는 CI로 선행한다.
- 마이그레이션 파일명은 `NNNN_description.sql` 규칙(예: `0001_init.sql`).

## Consequences

- "롤백" 대신 "전진 수정 PR"이 표준 → 인시던트 대응 절차가 명확해짐.
- 호환성 깨는 변경의 작업량이 3배 → 작은 변경은 1단계로 통과, 큰 변경은 ADR로 기록.
- D1 export 일 1회 + R2 백업 7일 보관으로 최후 복구 수단 확보 ([0004](0004-cloudflare-d1-as-database.md)).

## Alternatives considered

- **up/down 양방향**: D1 환경에서 down 실행 시 데이터 손실 위험.
- **블루/그린 DB 스위치**: D1 인프라로 부담 큼.
