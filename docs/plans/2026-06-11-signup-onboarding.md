# Signup Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route first-time OAuth users through the Granite signup profile screen before creating a normal user session.

**Architecture:** Keep provider OAuth exchange in the callback route, but replace immediate user creation with a short-lived pending signup cookie for new provider identities. The signup page reads that pending cookie, collects required profile fields, creates `users` and `user_oauth_identities`, then issues the `granite_session` cookie.

**Tech Stack:** Next.js App Router, Server Actions, D1 HTTP API, Vitest, Tailwind CSS.

---

### Task 1: Data Model And Tests

**Files:**
- Modify: `migrations/0009_user_auth.sql`
- Modify: `lib/db/schema.ts`
- Modify: `lib/db/user-auth-migration.test.ts`
- Modify: `lib/db/user-auth-queries.test.ts`

- [ ] Add onboarding fields to `users`: `gender`, `height_cm`, `ape_index_cm`, `top_bouldering_grade`, `top_sport_grade`, `onboarding_completed_at`.
- [ ] Update TypeScript `User`.
- [ ] Add tests proving the migration includes the new fields.

### Task 2: Pending Signup Boundary

**Files:**
- Create: `lib/auth/signup.ts`
- Create: `lib/auth/signup.test.ts`
- Modify: `app/api/auth/callback/[provider]/route.ts`
- Modify: `app/api/auth/callback/[provider]/route.test.ts`

- [ ] Add signed pending signup tokens with provider, provider user id, email, display name, avatar, return target, and expiry.
- [ ] Update callback behavior: existing identity creates session; missing identity creates pending signup cookie and redirects to `/signup`.
- [ ] Keep callback failures redirecting to `/login?error=callback_failed`.

### Task 3: Signup Completion

**Files:**
- Create: `app/(site)/signup/page.tsx`
- Create: `lib/actions/signup.ts`
- Create: `lib/actions/signup.test.ts`
- Modify: `lib/db/user-auth-queries.ts`

- [ ] Add `completeSignupAction` with Zod validation for nickname, gender, height, ape index, bouldering grade, and sport grade.
- [ ] Create user and OAuth identity from the pending signup token.
- [ ] Issue `granite_session`, clear pending cookie, redirect to the original return target.

### Task 4: Screen Implementation

**Files:**
- Modify: `app/(site)/login/page.tsx`
- Create or modify: `app/(site)/signup/page.tsx`

- [ ] Rebuild `/login` to match the provided black Granite social-login screen.
- [ ] Build `/signup` to match the provided black onboarding form.
- [ ] Only enable provider buttons whose env vars are configured; unavailable buttons stay visually present but disabled.
- [ ] Keep policy links available from login/signup.

### Task 5: Verification

- [ ] Run targeted auth tests.
- [ ] Run full `pnpm test`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm build`.
- [ ] Run browser smoke checks for `/login`, `/signup`, existing OAuth callback behavior, and `/me`.

---

Self-review: This plan covers the approved flow, provided screens, schema changes, auth state boundary, tests, and verification. No placeholders remain.
