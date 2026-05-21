# Granite Phase 1 Public UI Baseline Plan

> 원작성일: 2026-05-16
> 갱신일: 2026-05-22
> 상태: Phase 1 종료 기준으로 재정의
> 기준 ADR: [ADR 0017 — 5단계 출시](../decisions/0017-phased-release-1-5.md)

## Goal

Build and close Phase 1 as the Figma-based public UI baseline for Granite: home exploration, Crag detail, Topo/Route browsing, route sharing, policy pages, and the mobile application shell.

Phase 1 intentionally does not require production-ready DB migrations, D1 HTTP API reads, admin CRUD, R2 uploads, Instagram webhook, or OAuth.

## Architecture

Next.js App Router renders a mobile-first public experience using deterministic mock/seed data. The code may include forward-looking scaffolds for data repositories, admin routes, migrations, and R2 helpers, but those scaffolds are not Phase 1 completion gates. Production data and operations begin in Phase 2 and Phase 3.

## Tech Stack

Next.js, React, TypeScript strict, Tailwind CSS, Vitest, mock/seed repository data, Figma-exported image/logo assets.

---

## Phase 1 File Map

- `app/(public)/page.tsx`: home exploration screen.
- `app/c/[cragSlug]/page.tsx`: Crag detail tabs and public exploration.
- `app/topos/[topoId]/page.tsx`: Topo detail and route list flow.
- `app/r/[routeId]/page.tsx`: route sharing/detail screen.
- `app/terms/page.tsx`, `app/privacy/page.tsx`, `app/data-deletion/page.tsx`: policy pages.
- `app/layout.tsx`, `app/(public)/layout.tsx`: application shell.
- `components/layout/**`: header, bottom nav, footer.
- `components/public/**`: cards, stat bars, tabs, route table, ads.
- `lib/db/mock/granite.seed.json`, `lib/db/repository.ts`, `lib/db/seed.ts`: mock/seed read model used by Phase 1.
- `public/images/figma/**`: Figma-derived public assets.

## Completed Scope

- [x] Project scaffold for Next.js, TypeScript, Tailwind, Vitest.
- [x] Figma-aligned home UI with Area tabs, Crag carousel, stats, ads, and updates.
- [x] Figma-aligned Crag detail tabs.
- [x] Topo/Route browsing path.
- [x] Route detail/share screen.
- [x] Root layout, header, footer, bottom nav.
- [x] Figma logo asset instead of text logo.
- [x] iPhone status bar decoration removed from actual app.
- [x] Policy pages added.
- [x] Mock/seed data variants added for public UI validation.

## Deferred From Original Phase 1

These items moved out of Phase 1 by [ADR 0017](../decisions/0017-phased-release-1-5.md):

- Phase 2: D1 schema/migration hardening, seed/import strategy, real D1 HTTP API read path, public cache tags, DB health check.
- Phase 3: administrator authentication, content CRUD, announcement CRUD, R2 image upload, CDN URL persistence, admin audit log.
- Phase 4: Instagram webhook, WebhookInbox, manual Beta registration, Beta moderation.
- Phase 5: OAuth login, favorites/projects, records, unclaimed Beta claims.

## Phase 1 Closeout Checklist

- [ ] Rebase `phase1-implementation` on top of updated `main`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm build`.
- [ ] Fix only regressions in the Phase 1 public UI baseline.
- [ ] Mark Phase 1 complete in release notes or branch handoff.
- [ ] Start Phase 2 from the rebased Phase 1 baseline.
