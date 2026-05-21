---
id: 0017
title: 5단계 출시 (UI / DB / Admin / Instagram / Personalization)
status: Accepted
date: 2026-05-22
---

## Context

초기 Phase 1 구현 브랜치(`phase1-implementation`)는 Figma 기반 모바일 public UI, 탐색 흐름, 정적 정책 페이지, mock/seed 데이터 기반 화면을 만드는 데 집중했다. 반면 기존 [ADR 0008](0008-phased-release-1-2-3.md)은 Phase 1에 D1/R2 연결, 관리자 CRUD, 이미지 업로드, 공지 운영까지 포함하고 있어 문서상 Phase 1의 완료 조건과 실제 구현 상태가 어긋난다.

DB migration, 관리자 운영, Instagram 연동은 서로 다른 리스크와 검증 게이트를 가진다. 이를 한 Phase 안에 묶으면 현재 완료된 UI baseline을 종료하지 못하고, 이후 작업의 범위도 불명확해진다.

## Decision

출시 단계를 5단계로 재정의한다.

- **Phase 1 — Public UI Baseline**: 홈, Crag 상세, Topo/Route 흐름, 정책 페이지, 모바일 shell을 Figma 기준으로 구현한다. 데이터는 mock/seed 기반으로 허용하며, admin/DB/R2는 scaffold 또는 후속 범위로 남긴다.
- **Phase 2 — DB Migration & Data Layer**: D1 schema/migrations, seed/import 전략, repository의 실제 D1 HTTP API 연결, public UI의 DB-backed read path를 구현한다.
- **Phase 3 — Admin Operations**: 관리자 인증, 콘텐츠 CRUD, 이미지 업로드/R2/CDN, 공지 관리, revalidation, audit log를 구현한다.
- **Phase 4 — Beta / Instagram**: Instagram webhook, WebhookInbox, Route 매칭, manual beta 등록, beta moderation을 구현한다. 로그인은 포함하지 않는다.
- **Phase 5 — Login / Favorites / Claims**: Kakao/Naver/Google/Apple OAuth, 사용자 세션, 마이페이지, Route 프로젝트, 내 기록, unclaimed Beta 클레임을 구현한다.

## Consequences

- 현재 `phase1-implementation` 브랜치를 Phase 1 완료로 닫을 수 있다.
- Phase 2는 DB와 read path 안정화에 집중하므로 Admin UI와 운영 인증 리스크를 분리할 수 있다.
- Phase 3은 운영자 CRUD와 이미지 파이프라인만 검증하면 된다.
- Phase 4는 Meta 검수와 웹훅 안정성에 집중하고, 사용자 계정 의존 없이 베타 데이터를 축적할 수 있다.
- Phase 5는 개인화와 클레임 정책을 별도 제품 단계로 다룬다.
- 기존 3단계 문서를 참조하던 계획과 체크리스트는 본 ADR 기준으로 갱신해야 한다.

## Alternatives considered

- **기존 3단계 유지**: Phase 1 범위가 너무 커서 현재 구현분을 완료 처리하기 어렵고, DB/Admin/Instagram 리스크가 섞인다.
- **4단계로 Login을 Phase 4에 포함**: Instagram 연동과 OAuth/개인화 검수 리스크가 다시 결합된다.
- **Phase 1을 미완료로 유지**: 이미 확보한 UI baseline의 기준선을 만들지 못해 이후 작업이 계속 기존 브랜치에 누적된다.
