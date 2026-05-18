# Granite Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 Granite web app: public exploration, administrator CRUD, D1 schema, R2 URL-based image handling, policy pages, and deployment scaffolding.

**Architecture:** Next.js App Router renders mobile-first public pages and admin pages. Mutations use Server Actions and repository functions instead of CRUD route handlers. Cloudflare D1/R2 are abstracted behind small modules so local development can use deterministic seed data until real resources are configured.

**Tech Stack:** Next.js, React, TypeScript strict, Tailwind CSS, Vitest, Cloudflare D1/R2 integration points, Vercel runtime for the app.

---

## File Map

- `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `vitest.config.ts`: project toolchain.
- `app/**`: App Router pages, layouts, route handlers, server actions.
- `components/**`: mobile shell, cards, tabs, forms, admin tables, map placeholders.
- `lib/db/**`: schema types, D1 HTTP client boundary, read repositories, mutation repositories, local seed repository.
- `lib/actions/**`: Server Action entry points for admin mutations.
- `lib/auth/**`: admin session/token helpers.
- `lib/r2/**`: upload key generation and public CDN URL helpers.
- `lib/policies/**`: mirrored policy page content.
- `migrations/0001_init.sql`: Phase 1 + forward-compatible schema.

## Tasks

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `vitest.config.ts`
- Create: `app/layout.tsx`
- Create: `app/globals.css`

- [ ] Add scripts: `dev`, `build`, `test`, `lint`, `typecheck`, `vercel:deploy`, `wrangler:deploy`.
- [ ] Configure strict TypeScript, path alias `@/*`, Tailwind content paths, and Vitest jsdom environment.
- [ ] Add root mobile max-width shell and base metadata for `granite.kr`.
- [ ] Run `pnpm install`, `pnpm test`, `pnpm typecheck`, then commit `chore: scaffold next app`.

### Task 2: Domain Model and Database

**Files:**
- Create: `migrations/0001_init.sql`
- Create: `lib/db/schema.ts`
- Create: `lib/db/seed.ts`
- Create: `lib/db/repository.ts`
- Create: `lib/db/repository.test.ts`

- [ ] Define Phase 1 tables: `areas`, `crags`, `sectors`, `boulders`, `topos`, `routes`, `announcements`, `admins`, `admin_audit_logs`.
- [ ] Include forward-compatible `betas`, `webhook_inbox`, `users`, `user_oauth_identities`, `favorites` because docs already reserve them.
- [ ] Store image references as `TEXT` URL columns; do not create a polymorphic image table.
- [ ] Store `boulders.hashtags` as JSON text and expose parser helpers with tests.
- [ ] Commit `feat: add phase 1 data model`.

### Task 3: Public Exploration UI

**Files:**
- Create: `app/(public)/page.tsx`
- Create: `app/c/[cragSlug]/page.tsx`
- Create: `app/c/[cragSlug]/s/[sectorSlug]/page.tsx`
- Create: `app/c/[cragSlug]/b/[boulderId]/page.tsx`
- Create: `app/r/[routeId]/page.tsx`
- Create: `components/public/*`
- Create: `components/layout/*`

- [ ] Implement Figma Ver.2 mobile shell: header, hero, search, ad placeholders, bottom nav, max-width 480 desktop treatment.
- [ ] Implement home Area tabs, stats card, Crag horizontal cards, New Updates.
- [ ] Implement Crag tabs `Info/Sector/Boulder/Route/Map/Travel`.
- [ ] Implement Sector tabs `Info/Boulder/Route/Map/Travel`.
- [ ] Implement Boulder bottomsheet-style page and Route share page.
- [ ] Commit `feat: build public exploration pages`.

### Task 4: Admin Authentication and CRUD

**Files:**
- Create: `app/admin/login/page.tsx`
- Create: `app/admin/layout.tsx`
- Create: `app/admin/content/**`
- Create: `app/admin/announcements/page.tsx`
- Create: `lib/auth/admin.ts`
- Create: `lib/actions/admin-content.ts`

- [ ] Implement token/password-based admin guard suitable for Phase 1.
- [ ] Implement Server Actions for Area, Crag, Sector, Boulder, Topo, Route, Announcement create/update/delete/publish.
- [ ] Keep DB writes behind repository functions and call `revalidatePath`/`revalidateTag`.
- [ ] Commit `feat: add admin crud`.

### Task 5: Images, Policies, and Operations

**Files:**
- Create: `lib/r2/images.ts`
- Create: `app/terms/page.tsx`
- Create: `app/privacy/page.tsx`
- Create: `app/data-deletion/page.tsx`
- Create: `app/healthz/route.ts`
- Create: `.env.example`
- Create: `wrangler.toml`

- [ ] Add R2 key generation with `{entityType}/{entityId}/{purpose}-{uuid}.{ext}` convention and CDN URL builder.
- [ ] Add policy pages mirrored from existing public URL content as static in-app pages.
- [ ] Add health check route and environment documentation.
- [ ] Commit `feat: add operations and policy pages`.

### Task 6: Verification

**Files:**
- Modify: any files needed for fixes only.

- [ ] Run `pnpm test`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm build`.
- [ ] Fix only regressions in Phase 1 scope.
- [ ] Commit final fixes as `fix: stabilize phase 1 build`.
