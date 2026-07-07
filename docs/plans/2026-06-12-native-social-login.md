# Native Social Login Implementation Plan

> **For agentic workers:** Current implementation uses WebView POST session creation. The older D1 handoff plan has been superseded.

**Goal:** Replace native social login handoff codes with direct WebView POST session creation.

**Architecture:** Flutter performs native provider login, then asks the WebView to `POST /api/auth/native/session` with provider tokens in the request body. Next.js validates the token, sets the appropriate httpOnly cookie, and 303 redirects to `/me`, `/signup`, or an error page.

## Completed Tasks

- [x] Add `app/api/auth/native/session/route.ts`.
- [x] Test session cookie creation for existing native provider users.
- [x] Test pending signup cookie creation for first-time native provider users.
- [x] Redirect invalid native session requests back to login.
- [x] Add `NativeAuthSessionRequestBuilder` in the Flutter app.
- [x] Update `NativeAuthBridgeHandler` to load a WebView POST request instead of using `NativeAuthExchangeService`.
- [x] Update `WebViewScreen` to call `WebViewController.loadRequest` with POST method, headers, and body.
- [x] Remove the old D1 `native_auth_handoffs` migration and unused exchange/consume endpoints.

## Verification

Run from `/Users/scorchedrice/granite/granite-v2`:

```bash
pnpm test -- app/api/auth/native/session/route.test.ts
pnpm typecheck
pnpm build
```

Run from `/Users/scorchedrice/granite/granite-climbing-app`:

```bash
flutter test test/data/bridge/handlers/native_auth_bridge_handler_test.dart
flutter test test/features/webview/webview_screen_test.dart
flutter analyze
flutter test
```
