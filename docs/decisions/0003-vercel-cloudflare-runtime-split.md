---
id: 0003
title: Vercel + Cloudflare 런타임 분리
status: Accepted
date: 2026-05-13
---

## Context

CLAUDE.md 초기 버전은 "Cloudflare Pages + Workers + D1 + R2"로 풀 Cloudflare를 가정했지만, Apple OAuth JWT 서명 등 Node API 의존이 있는 작업과 Next.js App Router의 최신 기능(Server Actions, `unstable_cache`)을 가장 매끄럽게 쓰려면 Node runtime이 유리하다. 반대로 D1/R2 인접성과 외부 webhook 빠른 ACK는 Cloudflare 쪽이 강하다.

## Decision

- **웹앱**: Vercel Functions Node runtime, `icn1`(서울) 리전 고정. Next.js RSC 렌더, Server Actions, OAuth 콜백, healthz를 담당.
- **보조 런타임**: Cloudflare Workers. Instagram 웹훅, 썸네일 재시도, scheduled job, R2/CDN 보조 엔드포인트만 담당.
- **데이터/스토리지**: Cloudflare D1 (HTTP API), R2 (S3 호환 SDK), Cloudflare CDN + Image Resizing.
- **도메인**: `granite.kr`은 Vercel, `cdn.granite.kr`은 Cloudflare CDN → R2 origin. DNS는 Cloudflare에 위임.

## Consequences

- Vercel 단일 배포로 일반 CRUD 인프라가 가벼워짐.
- D1 호출이 Vercel→Cloudflare 원격 HTTP로 발생 → 캐싱과 batch query가 중요해진다 ([0009](0009-cache-and-revalidation.md)).
- 시크릿이 두 곳에 분산된다(Vercel ENV + `wrangler secret`). 운영 문서에서 명확히 구분 필요.
- Worker는 "Cloudflare 인접성/외부 콜백/재시도" 작업에만 쓴다. **일반 CRUD API를 Worker로 만들지 않는다**.

## Alternatives considered

- **풀 Cloudflare (Pages + Workers + D1 + R2)**: Next.js 최신 기능 호환·Node API 가용성이 Vercel 대비 약함. Apple OAuth 등 운영 리스크.
- **풀 Vercel (D1 대신 Vercel Postgres/Neon)**: 비용 증가, R2 이미지 파이프라인의 Cloudflare 인접성 손해.
