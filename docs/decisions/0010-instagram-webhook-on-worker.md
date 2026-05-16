---
id: 0010
title: Instagram 웹훅을 Cloudflare Worker로 분리
status: Accepted
date: 2026-05-13
---

## Context

Meta는 웹훅에 대해 (1) `GET /webhooks/instagram?hub.challenge=…` 검증, (2) `POST` JSON 페이로드, (3) `X-Hub-Signature-256` HMAC 헤더, (4) 빠른 200 응답을 요구한다. Server Action은 공개 안정 URL이 없고 GET 검증을 다루기에 부적합하다. 또한 웹훅 처리는 D1/R2 인접성이 유리하고, 향후 재시도/scheduled job으로 확장 가능성이 크다.

## Decision

Instagram 웹훅은 Cloudflare Worker에 분리한다.

- `GET /webhooks/instagram` — `META_WEBHOOK_VERIFY_TOKEN` 검증 후 `hub.challenge` 에코
- `POST /webhooks/instagram` — HMAC 검증 → `webhook_inbox` INSERT (멱등 키 `external_id`) → 빠른 200 응답 → 가능하면 동일 요청 내 Route 매칭/Beta 생성 시도
- 썸네일 재시도, scheduled job도 같은 Worker 패키지에서 관리

매칭 실패(`status='unmatched'`) 건은 `/admin/webhooks` 인박스에서 수동 매칭/거절.

## Consequences

- 웹훅은 Vercel cold start 영향을 받지 않고 즉시 ACK 가능.
- D1/R2 인접 호출로 처리 지연 감소.
- 시크릿이 Worker 쪽에 분산됨(`META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`).
- 일반 CRUD를 Worker로 만들지 않는다는 경계는 유지([0002](0002-server-actions-first.md)).

## Alternatives considered

- **Next.js Route Handler에서 웹훅 처리**: Vercel cold start, 재시도/scheduled job 확장이 어려움.
- **Vercel Cron + Route Handler 조합**: webhook 즉시 ACK 요건 미충족.
