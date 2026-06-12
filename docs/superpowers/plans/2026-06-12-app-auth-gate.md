# App Auth Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Flutter app behave like a native app by showing native login before protected WebView access, while keeping web sessions as server-owned HttpOnly cookies.

**Architecture:** Flutter owns app auth state and does not show the WebView until app login succeeds. Granite v2 owns web session cookies and exposes a short-lived handoff endpoint that the app opens in WebView after native login. The app stores app auth separately from the web cookie; only a handoff code crosses from app to web.

**Tech Stack:** Flutter, Dart widget tests, Next.js app routes, Vitest, existing Granite user session JWT helpers.

---

### Task 1: Document The Auth Boundary

**Files:**
- Create: `docs/specs/2026-06-12-app-auth-boundary.md`

- [x] **Step 1: Record the agreed boundary**

The spec must state:
- Flutter app session and web session are separate.
- Flutter starts with an auth gate and does not open protected WebView routes while logged out.
- Web session is established only by server-set HttpOnly cookie.
- The app sends a short-lived handoff code to the web, never a long-lived app token through JavaScript.

- [x] **Step 2: Commit**

```bash
git add docs/specs/2026-06-12-app-auth-boundary.md docs/superpowers/plans/2026-06-12-app-auth-gate.md
git commit -m "docs(auth): define app web session boundary"
```

### Task 2: Add Native App Auth Gate

**Files:**
- Create: `/Users/scorchedrice/granite/granite-climbing-app/lib/features/auth/app_auth_session.dart`
- Create: `/Users/scorchedrice/granite/granite-climbing-app/lib/features/auth/app_auth_repository.dart`
- Create: `/Users/scorchedrice/granite/granite-climbing-app/lib/features/auth/auth_gate.dart`
- Create: `/Users/scorchedrice/granite/granite-climbing-app/lib/features/auth/native_login_screen.dart`
- Modify: `/Users/scorchedrice/granite/granite-climbing-app/lib/app/app.dart`
- Test: `/Users/scorchedrice/granite/granite-climbing-app/test/features/auth/auth_gate_test.dart`
- Test: `/Users/scorchedrice/granite/granite-climbing-app/test/app/app_test.dart`

- [ ] **Step 1: Write failing widget tests**

Tests must prove:
- no stored app session shows native login instead of WebView;
- tapping a native provider creates an app session and then shows WebView;
- an existing app session shows WebView immediately.

- [ ] **Step 2: Implement minimal auth gate**

Use an in-memory repository first. The repository interface is intentionally storage-agnostic so secure storage can replace it later without changing the UI.

- [ ] **Step 3: Commit**

```bash
git add lib test
git commit -m "feat(auth): gate app webview behind native login"
```

### Task 3: Add Web Session Handoff Contract

**Files:**
- Create: `lib/auth/app-handoff.ts`
- Create: `lib/auth/app-handoff.test.ts`
- Create: `app/api/auth/app-handoff/route.ts`
- Create: `app/api/auth/app-handoff/route.test.ts`

- [ ] **Step 1: Write failing Vitest tests**

Tests must prove:
- handoff return paths are sanitized;
- invalid handoff codes redirect to `/login?error=invalid_app_handoff`;
- valid handoff codes set `granite_session` and redirect to the sanitized return path.

- [ ] **Step 2: Implement minimal handoff**

Use a signed short-lived JWT handoff code with a distinct audience/purpose from the normal web session JWT.

- [ ] **Step 3: Commit**

```bash
git add lib/auth/app-handoff.ts lib/auth/app-handoff.test.ts app/api/auth/app-handoff
git commit -m "feat(auth): add app web session handoff"
```

### Task 4: Connect Flutter Login To Handoff URL

**Files:**
- Modify: `/Users/scorchedrice/granite/granite-climbing-app/lib/features/auth/session_handoff_service.dart`
- Modify: `/Users/scorchedrice/granite/granite-climbing-app/lib/features/auth/auth_gate.dart`
- Test: `/Users/scorchedrice/granite/granite-climbing-app/test/features/auth/session_handoff_service_test.dart`
- Test: `/Users/scorchedrice/granite/granite-climbing-app/test/features/auth/auth_gate_test.dart`

- [ ] **Step 1: Write failing tests**

Tests must prove native login completion builds `/api/auth/app-handoff?code=...&returnTo=...` and sends that URL to `WebViewScreen`.

- [ ] **Step 2: Implement minimal URL composition**

The app loads the handoff URL as the WebView initial URL after native login. The server sets the cookie and redirects to the real app destination.

- [ ] **Step 3: Commit**

```bash
git add lib test
git commit -m "feat(auth): sync native login into webview"
```

### Task 5: Verify End-To-End

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
- app opens native login first when no app session exists;
- WebView is not visible behind the logged-out state;
- tapping a provider proceeds to the handoff/WebView path.

---

**Self-review:** This plan keeps app and web sessions separate, uses server-owned HttpOnly cookies for web auth, avoids token injection into JavaScript, and provides small commits after each boundary. Real provider SDK integration is intentionally outside this first pass and will replace the dev native auth implementation behind the same `NativeAuthService` interface.
