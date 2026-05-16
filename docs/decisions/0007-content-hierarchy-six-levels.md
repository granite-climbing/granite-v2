---
id: 0007
title: 6단계 콘텐츠 계층 (Area→Crag→Sector→Boulder→Topo→Route)
status: Accepted
date: 2026-05-13
---

## Context

자연 볼더링 콘텐츠는 운영 단위(주차/접근), 물리 단위(바위), 표현 단위(바위의 한 면), 등반 단위(라인)가 모두 다르다. V1 시절 단순한 "스팟 → 문제" 2단 구조는 주차 정보와 바위 식별, Topo 사진의 중복을 처리하기 어려웠다.

## Decision

다음 6단계 계층을 표준으로 한다.

```
Area ──< Crag ──< Sector ──< Boulder ──< Topo ──< Route
```

- **Area**: 시드 5개(수도권/강원/충청/전라/경상). Enum 아닌 테이블.
- **Crag**: 등반지. Area에 1:N. 선택 좌표(중심점).
- **Sector**: 주차·접근로 단위. Crag에 1:N. 선택 좌표(주차장 핀).
- **Boulder**: 한 바위. Sector에 1:N. **필수 좌표** — 지도의 주 마커.
- **Topo**: 바위의 한 면. Boulder에 1:N. 베이스 면 사진 1장.
- **Route**: 라인. Topo에 1:N. 베타가 붙는 단위. UI/카운트 모두 "Route"로 통일.

## Consequences

- 주차/접근은 Sector에, 위치는 Boulder에, 베타는 Route에 깔끔히 귀속.
- 단점: 6단계는 관리자 입력 부담이 큼 → Sector가 1개뿐이거나 Topo가 1개뿐인 케이스를 UI에서 자연스럽게 단축할 필요(예: Sector 자동 생성).
- 슬러그는 Crag/Sector까지만, Boulder/Route는 ID 기반(이름 변경 안정성).

## Alternatives considered

- **4단계 (Crag→Boulder→Route)**: 주차/접근/지역 통계를 표현하기 어려움.
- **5단계 (Topo 제거, Route가 바로 사진 보유)**: 한 바위에 여러 면이 있을 때 사진 공유 불가, 라인 번호 매칭 곤란.
