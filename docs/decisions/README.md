# Decisions (ADR)

> Granite v2의 아키텍처·제품 의사결정 기록.
> 요구사항 목록은 `docs/PRD.md`, 구체 설계는 `docs/ARCHITECTURE.md`, 일정/마일스톤은 `docs/ROADMAP.md`를 참조한다.

## 작성 규칙

- 한 결정 = 한 파일. 파일명: `NNNN-kebab-case-title.md`
- 결정을 **번복하더라도 기존 ADR은 삭제하지 않는다**. 새 ADR을 추가하고 기존 ADR의 상태를 `Superseded by NNNN`으로 표시한다.
- 본문은 4개 절을 권장한다.

```markdown
---
id: NNNN
title: …
status: Accepted | Proposed | Superseded by NNNN | Deprecated
date: YYYY-MM-DD
---

## Context
무엇을 결정해야 했는가. 제약과 배경.

## Decision
무엇을 택했는가. 한 문단으로.

## Consequences
좋은 영향 / 비용 / 향후 트리거.

## Alternatives considered
검토한 다른 선택지와 기각 사유.
```

## 인덱스

| # | 제목 | 상태 |
|---|------|------|
| [0001](0001-mobile-first-and-max-width.md) | 모바일 전용 렌더링과 데스크톱 max-width 480 | Accepted |
| [0002](0002-server-actions-first.md) | Server Actions 우선, REST API 최소화 | Accepted |
| [0003](0003-vercel-cloudflare-runtime-split.md) | Vercel + Cloudflare 런타임 분리 | Accepted |
| [0004](0004-cloudflare-d1-as-database.md) | 데이터베이스로 Cloudflare D1 채택 | Accepted |
| [0005](0005-r2-and-image-cdn-pipeline.md) | R2 원본 + Cloudflare Image Resizing | Accepted |
| [0006](0006-image-urls-on-entities.md) | 이미지 URL을 엔티티 컬럼에 직접 저장 | Accepted |
| [0007](0007-content-hierarchy-six-levels.md) | 6단계 콘텐츠 계층 (Area→Route) | Accepted |
| [0008](0008-phased-release-1-2-3.md) | 3단계 출시 (탐색 / 베타 / 로그인) | Superseded by 0017 |
| [0009](0009-cache-and-revalidation.md) | unstable_cache + tag 기반 무효화 | Accepted |
| [0010](0010-instagram-webhook-on-worker.md) | Instagram 웹훅을 Cloudflare Worker로 분리 | Accepted |
| [0011](0011-beta-source-vs-platform.md) | Beta의 source와 platform 축 분리 | Accepted |
| [0012](0012-unclaimed-beta-by-ig-handle.md) | Instagram 핸들 기반 unclaimed Beta | Accepted |
| [0013](0013-admin-auth-separate-from-user.md) | 관리자 인증을 사용자 인증과 분리 | Accepted |
| [0014](0014-rollforward-only-migrations.md) | 마이그레이션 롤포워드 only | Accepted |
| [0015](0015-policy-docs-mirrored-in-app.md) | 공개 정책 문서를 앱 내 정적 페이지로 이관 | Accepted |
| [0016](0016-defer-r2-backup.md) | R2 백업은 MVP 단계에서 진행하지 않음 | Accepted |
| [0017](0017-phased-release-1-5.md) | 5단계 출시 (UI / DB / Admin / Instagram / Personalization) | Accepted |
| [0018](0018-no-coord-precision-column.md) | 민감 좌표는 관리자 큐레이션으로 통제, coord_precision 컬럼 제거 | Accepted |
