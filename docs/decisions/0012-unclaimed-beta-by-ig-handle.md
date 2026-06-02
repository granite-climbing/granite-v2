---
id: 0012
title: Instagram 핸들 기반 unclaimed Beta
status: Accepted
date: 2026-05-13
---

## Context

Phase 5는 로그인 없이 운영된다. Instagram 웹훅으로 들어오거나 수동 등록된 Beta를 "어느 사용자 것"인지 즉시 알 수 없다. Phase 6에서 로그인 사용자가 자신의 Instagram 핸들을 등록하면 과거 Beta를 자기 기록으로 가져올 수 있어야 한다.

## Decision

- `betas.user_id`는 nullable. Phase 5의 모든 Beta는 `user_id = NULL`, `instagram_id`만 보존.
- Phase 6에서 가입 완료 직후, 또는 마이페이지에서 IG 핸들 등록/변경 시 다음 쿼리로 일괄 클레임:
  ```sql
  UPDATE betas SET user_id = ? WHERE instagram_id = ? AND user_id IS NULL
  ```
- 사칭 리스크를 위해 `betas.claim_status` 컬럼을 두고 즉시 귀속 vs 관리자 검토 vs IG OAuth 소유 증명을 선택 가능하게 한다. MVP는 형식 검증만으로 즉시 귀속, 관리자가 사후 무효화할 수 있게 둔다.

## Consequences

- Phase 5 출시 시점에 이미 Beta가 쌓일 수 있어 Phase 6 콜드스타트 완화.
- 사칭 리스크: 타인의 IG 핸들을 입력해 그 사람의 Beta를 가져갈 수 있음 → `claim_status`로 추후 IG OAuth 소유 증명 도입 시 호환 유지.
- unclaimed Beta는 소유권 확인 전까지 어떤 공개 사용자 화면에도 자동 노출되지 않는다.

## Alternatives considered

- **로그인 필수로 Beta 생성**: Phase 5에서 베타 데이터 축적 불가, 비로그인 캡션 흐름과 모순.
- **IG OAuth로 소유 증명 후 클레임**: Meta 검수 추가 필요. MVP 범위 밖.
