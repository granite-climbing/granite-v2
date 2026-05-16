---
id: 0011
title: Beta의 source와 platform 축 분리
status: Accepted
date: 2026-05-13
---

## Context

Beta는 두 가지 직교한 속성을 가진다.

- **어떻게 등록되었는가**: 사용자가 수동으로 URL 입력했는가, IG 웹훅으로 자동 수신했는가
- **어느 플랫폼의 미디어인가**: Instagram인가, YouTube인가

한 컬럼에 합치면(예: `source = 'manual_youtube' | 'manual_instagram' | 'webhook_instagram'`) enum이 폭발하고 두 축으로 동시에 분석/필터링하기 어렵다.

## Decision

두 축을 분리한다.

- `betas.source`: `'manual' | 'instagram_webhook'`
- `betas.platform`: `'instagram' | 'youtube'`

수동 등록 + Instagram URL = `(source='manual', platform='instagram')`.
웹훅 수신 = `(source='instagram_webhook', platform='instagram')`.
YouTube는 현재 `source='manual'`만 가능.

## Consequences

- "전체 베타 중 자동 수집 비율" 같은 운영 지표를 source 한 컬럼으로 산출 가능.
- 향후 YouTube 자동 수집이 생기면 `source` enum만 확장하면 됨.
- 인덱스 `(platform, source)`로 통계 쿼리 최적화.

## Alternatives considered

- **단일 enum**: 위 단점.
- **boolean `is_manual` + `platform`**: 향후 source 종류가 늘면 다시 enum 화 필요.
