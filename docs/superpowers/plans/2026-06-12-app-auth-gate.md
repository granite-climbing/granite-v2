# App Web Login Entrypoint Plan

> Supersedes the earlier native AuthGate/handoff direction. The current product decision is to show the existing web login screen inside the app WebView.

**Goal:** Keep app authentication on the existing web login UI while preventing the app from opening a protected logged-out fallback as the first screen.

**Architecture:** Flutter opens the web app entrypoint `/app` in WebView. Granite v2 checks the server-owned `granite_session` cookie and redirects to either `/me` or `/login?returnTo=/me`. The app does not own a separate auth session in this implementation.

**Tech Stack:** Flutter, Dart widget tests, Next.js server components, Vitest, existing Granite user session JWT helpers.

---

### Task 1: Document The Auth Boundary

**Files:**
- Modify: `docs/specs/2026-06-12-app-auth-boundary.md`

- [x] **Step 1: Record the agreed boundary**

The spec must state:
- App uses web login UI in WebView.
- Web session is established only by server-set HttpOnly cookie.
- App enters through `/app`, not directly through protected fallback pages.

- [ ] **Step 2: Commit**

```bash
git add docs/specs/2026-06-12-app-auth-boundary.md docs/superpowers/plans/2026-06-12-app-auth-gate.md
git commit -m "docs(auth): use web login for app entry"
```

### Task 2: Add Web App Entrypoint

**Files:**
- Create: `app/(site)/app/page.tsx`
- Create: `app/(site)/app/page.test.ts`

- [x] **Step 1: Write failing Vitest tests**

Tests must prove:
- no web session redirects to `/login?returnTo=/me`;
- a valid web session redirects to `/me`;
- a stale web session redirects to `/login?returnTo=/me`.

- [x] **Step 2: Implement `/app` route**

Read the `granite_session` cookie, verify it, check the active user, and redirect.

### Task 3: Point Flutter At The Web Entrypoint

**Files:**
- Modify: `/Users/scorchedrice/granite/granite-climbing-app/lib/app/app.dart`
- Modify: `/Users/scorchedrice/granite/granite-climbing-app/lib/core/constants/app_constants.dart`
- Test: `/Users/scorchedrice/granite/granite-climbing-app/test/app/app_test.dart`

- [x] **Step 1: Update app tests**

Tests must prove:
- `GraniteApp` starts directly with WebView;
- default app URL is `/app`.

- [x] **Step 2: Simplify app startup**

Remove the native AuthGate from the app startup path and use `WebViewScreen(initialUrl: initialUrl)`.

### Task 4: Verify End-To-End

**Files:**
- No source changes expected.

- [ ] **Step 1: Run web verification**

```bash
cd /Users/scorchedrice/granite/granite-v2
pnpm typecheck
pnpm test
pnpm build
```

- [ ] **Step 2: Run app verification**

```bash
cd /Users/scorchedrice/granite/granite-climbing-app
dart format --set-exit-if-changed lib test
flutter analyze
flutter test
```

- [ ] **Step 3: Manual Simulator check**

Run the app against local v2 and confirm:
- app opens the web login screen first when no WebView session exists;
- tapping Kakao proceeds to Kakao OAuth inside WebView.

---

**Self-review:** This plan keeps the current app login path simple: one web login UI, server-owned HttpOnly cookies, and no token injection into JavaScript. Native provider SDK integration remains a future option only if WebView OAuth becomes insufficient.
