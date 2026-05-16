---
id: 0002
title: Server Actions 우선, REST API 최소화
status: Accepted
date: 2026-05-13
---

## Context

전형적인 Next.js 앱은 사용자/관리자 mutation을 위해 `/api/*` Route Handler를 다수 만든다. Granite v2는 외부 시스템에 공개해야 할 안정 URL이 거의 없다(IG 웹훅, OAuth 콜백, healthz만). 그럼에도 CRUD용 REST API를 만들면 입력 검증·인가·캐시 무효화 코드를 RSC 측과 두 곳에 중복하게 된다.

## Decision

사용자와 관리자의 모든 mutation은 Server Actions로 구현한다. Route Handler는 다음 경우에만 만든다.

- OAuth callback (`/api/auth/callback/[provider]`)
- 헬스체크 (`/healthz`)
- 외부 시스템이 호출하는 공개 안정 URL

웹훅과 비동기 작업처럼 Next.js 앱 외부에서 호출하거나 Cloudflare 인접성이 뚜렷한 작업은 Cloudflare Worker로 분리한다 ([0010](0010-instagram-webhook-on-worker.md) 참조).

## Consequences

- 입력 검증(Zod), 권한(`requireAdmin`/세션), 캐시 무효화(`revalidateTag`)를 단일 진입점에서 관리.
- 클라이언트 fetch 보일러플레이트가 사라지고, 폼 제출이 progressive enhancement로 동작.
- 외부 통합 지점에서만 HTTP 계약을 문서화하면 된다 → 계약 노이즈 감소.
- 단점: Server Action은 공개 URL이 없으므로 외부 webhook이나 third-party 통합에는 부적합. → 이런 경우는 명시적으로 Route Handler 또는 Worker로 분리한다.

## Alternatives considered

- **전부 Route Handler**: Next.js의 흐름과 어긋나고 코드 중복.
- **tRPC**: 추상화 추가 비용 대비 이점이 크지 않음. 단일 팀, 단일 클라이언트 환경.
