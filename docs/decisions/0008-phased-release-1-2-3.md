---
id: 0008
title: 3단계 출시 (탐색 / 베타 / 로그인)
status: Accepted
date: 2026-05-13
---

## Context

기능 전체를 한 번에 출시하면 콘텐츠 확보, Meta/Naver 검수, OAuth 4종 구현, 베타 모더레이션이 동시 리스크가 된다. 한편 사용자 가치의 1차 원천은 "큐레이션된 콘텐츠 탐색"이고, 베타와 개인화는 그 위에 쌓이는 레이어다.

## Decision

세 단계로 독립 배포 가능하게 출시한다.

- **Phase 1 — 탐색/관리자 CRUD**: 홈, Crag/Sector/Route 상세, Map 탭, 콘텐츠/이미지/공지 CRUD. 일반 사용자 계정 없음.
- **Phase 2 — 베타/Instagram 웹훅**: 캡션 생성, IG 웹훅, 비로그인 수동 베타, WebhookInbox, unclaimed Beta, 관리자 매칭/모더레이션. 로그인 없음.
- **Phase 3 — 로그인/즐겨찾기/클레임**: OAuth 4종, 세션, 마이페이지, 즐겨찾기, 내 기록, unclaimed Beta 클레임.

## Consequences

- 각 Phase의 검수/협상 리드타임을 병렬화할 수 있음 (Phase 1 진행 중 Meta 검수 시작 가능).
- Phase 2는 로그인 없이도 베타 수집 데이터를 축적 가능 → Phase 3 출시 시점에 "이미 N건의 unclaimed Beta가 기다리고 있는" 콜드스타트 완화 효과.
- 단점: Phase 2/3 UI는 비로그인 상태와 로그인 상태 두 모드를 모두 렌더해야 함 → 디자인·QA 비용.
- 하단 탭바의 기록/프로젝트/마이 탭은 Phase 1/2에서 "coming soon" 또는 로그인 유도 상태로 처리한다.

## Alternatives considered

- **베타 + 로그인 동시 출시**: OAuth 4종 + Meta 검수의 일정 결합 리스크.
- **순서 뒤집기 (로그인 먼저)**: 로그인할 만한 가치(탐색·베타)가 없으면 가입 동기 부족.
