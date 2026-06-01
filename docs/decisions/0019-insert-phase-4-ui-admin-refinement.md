---
id: 0019
title: Phase 4에 Public/Admin UX 보정 단계 삽입
status: Accepted
date: 2026-06-01
---

## Context

Phase 3 Admin Operations 구현 이후 곧바로 Beta/Instagram 단계로 넘어가면, public 탐색 UI와 관리자 운영 UI의 미해결 품질 이슈가 베타 수집 기능 위에 누적된다. 현재 필요한 작업은 홈 Area/Crag 탐색 방식 변경, Area 상세 페이지 추가, Crag 상세 탭 보정, Route/Topo 아이콘과 Topo 이동, 검색 UI 통일, 관리자 생성/필터 경험 개선이다.

이 작업들은 Instagram 웹훅이나 OAuth처럼 외부 검수와 계정 정책 리스크가 큰 기능이 아니라, 기존 Phase 1~3 산출물을 실제 사용 흐름에 맞게 다듬는 성격이다. 별도 Phase로 분리하면 Beta/Instagram 개발 전에 탐색과 운영 기반을 안정화할 수 있다.

## Decision

출시 단계를 6단계로 재정의하고, 기존 Phase 4~5를 뒤로 미룬다.

- **Phase 1 — Public UI Baseline**: 홈, Crag 상세, Topo/Route 흐름, 정책 페이지, 모바일 shell을 Figma 기준으로 구현한다.
- **Phase 2 — DB Migration & Data Layer**: D1 schema/migrations, seed/import, D1 HTTP API 연결, DB-backed public read path를 구현한다.
- **Phase 3 — Admin Operations**: 관리자 인증, 콘텐츠 CRUD, 이미지 업로드/R2/CDN, 공지 관리, revalidation, audit log를 구현한다.
- **Phase 4 — Public/Admin UX Refinement**: 홈 Area/Crag 슬라이더, Area 상세 페이지(`/a/<area-slug>`), Topo 상세 canonical URL(`/t/<topo-id>`), Crag 상세 탭 보정, Route/Topo 아이콘과 Topo 이동, 검색 UI 통일, 관리자 생성/부모 필터 경험을 구현한다.
- **Phase 5 — Beta / Instagram**: Instagram webhook, WebhookInbox, Route 매칭, manual beta 등록, beta moderation을 구현한다. 로그인은 포함하지 않는다.
- **Phase 6 — Login / Favorites / Claims**: Kakao/Naver/Google/Apple OAuth, 사용자 세션, 마이페이지, Route 프로젝트, 내 기록, unclaimed Beta 클레임을 구현한다.

## Consequences

- Phase 4는 새 외부 연동 없이 public/admin 품질을 올리는 안정화 릴리스가 된다.
- Beta/Instagram 구현은 Area/Crag/Route 탐색과 관리자 데이터 선택 UX가 정돈된 뒤 시작한다.
- 기존 문서의 Phase 4 Beta/Instagram 참조는 Phase 5로, Phase 5 Login/Favorites/Claims 참조는 Phase 6으로 갱신해야 한다.
- 하단 바텀 탭은 로그인/개인화와 강하게 결합되므로 Phase 4에 포함하지 않고 Phase 6에서 재검토한다.
- 기존 ADR 0017은 삭제하지 않고 본 ADR로 supersede한다.

## Alternatives considered

- **Beta/Instagram을 기존 Phase 4로 유지**: 탐색/관리 UX 보정이 베타 기능과 섞여 QA 범위가 커지고, public UI 결함이 신규 베타 플로우의 문제처럼 보일 수 있다.
- **Phase 3.5 후속 패치로 처리**: 실제 작업 범위가 홈, Area 페이지, Crag 상세, Route/Topo, Admin까지 넓어 릴리스 게이트가 불명확하다.
- **Login/Favorites를 Phase 5로 유지하고 Beta를 Phase 6으로 이동**: 베타 수집 데이터가 개인화/클레임의 전제가 되므로 기존 의존 관계를 깨뜨린다.
