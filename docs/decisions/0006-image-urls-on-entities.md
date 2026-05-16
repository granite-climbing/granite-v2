---
id: 0006
title: 이미지 URL을 엔티티 컬럼에 직접 저장
status: Accepted
date: 2026-05-13
---

## Context

Crag/Sector/Boulder/Topo/Route/Announcement 각각이 이미지를 가진다. 흔한 패턴은 `images` polymorphic 테이블을 두고 `(owner_type, owner_id)`로 다대일 연결하는 방식이다. 그러나 Granite의 이미지 종류는 엔티티당 1~2개로 한정적(커버 1, Topo의 base 1, Route의 line 1)이며 정렬/다중 이미지 요건이 크지 않다.

## Decision

별도 이미지 테이블을 두지 않는다. 각 엔티티에 필요한 이미지 URL을 `TEXT` 컬럼으로 직접 저장한다.

- `crags.cover_image_url`, `sectors.cover_image_url`, `boulders.cover_image_url`
- `topos.base_image_url`
- `routes.line_image_url`
- `announcements.cover_image_url`
- `betas.thumbnail_url`, `betas.media_url`
- `users.avatar_url`

다중 이미지가 필요해지는 시점(예: Topo 한 면에 여러 컷)에 한해 해당 엔티티에 자식 테이블을 추가한다.

## Consequences

- 스키마와 쿼리가 단순. JOIN 1개 줄어듦.
- 폴리모픽 FK 무결성 문제 회피.
- 단점: 이미지 출처·촬영자·라이선스 메타데이터를 같은 컬럼에 담기 어렵다. 필요 시 별도 `image_metadata` 테이블을 키(URL 또는 R2 key) 기준으로 붙인다.
- 동일 이미지의 여러 URL이 다른 엔티티에 중복 저장될 수 있음 → R2 key 단위로 중복 업로드 방지 정책 운영.

## Alternatives considered

- **`images` polymorphic 테이블**: 다중/정렬에 강하지만 현 요구에 과함.
- **JSON 컬럼에 이미지 배열**: D1 SQLite JSON 쿼리/인덱스 제약.
