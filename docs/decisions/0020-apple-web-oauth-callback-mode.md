---
id: 0020
title: Apple web OAuth callback mode
status: Proposed
date: 2026-07-10
---

## Context

Apple login on `https://v2.granite.kr` reached the Apple authorization page and returned to Granite, but the user ended up back on `/login?error=invalid_state`.

This is different from the earlier `invalid_request: Invalid web redirect url` failure. That earlier failure was caused by Apple Developer configuration and meant Apple rejected the redirect URL before a valid callback. The current `invalid_state` failure means the browser completed the Apple round trip and hit Granite's callback route, but Granite could not validate the OAuth `state`.

The current web OAuth flow is:

1. `/login` submits `startOAuthLoginAction`.
2. `lib/actions/oauth-login.ts` creates `granite_oauth_state`.
3. The state cookie is set as `HttpOnly`, `Path=/`, `SameSite=Lax`, and `Secure` in production.
4. Apple authorization URL is generated from `lib/auth/oauth/providers.ts`.
5. Apple currently uses `response_mode=form_post`.
6. Apple posts back to `/api/auth/callback/apple`.
7. `app/api/auth/callback/[provider]/route.ts` compares the callback `state` with `granite_oauth_state`.

The suspected root cause is the combination of Apple `response_mode=form_post` and the state cookie's `SameSite=Lax` setting. Apple's callback is a cross-site `POST` from `appleid.apple.com` to `v2.granite.kr`; browsers may omit `SameSite=Lax` cookies on that request, so Granite receives the callback `state` but not the original state cookie and returns `invalid_state`.

There is also a separate domain consistency requirement: login must start on `https://v2.granite.kr`. If login starts on `https://granite.kr` and the OAuth callback returns to `https://v2.granite.kr`, the state cookie is scoped to the wrong host and validation will fail for the same reason.

## Decision

For the current Granite v2 web login, Apple OAuth should use a query callback instead of a form POST callback:

```ts
// lib/auth/oauth/providers.ts
apple: {
  provider: "apple",
  label: "Apple",
  authorizationUrl: "https://appleid.apple.com/auth/authorize",
  tokenUrl: "https://appleid.apple.com/auth/token",
  userInfoUrl: null,
  clientIdEnv: "APPLE_WEB_CLIENT_ID",
  clientIdFallbackEnv: "APPLE_CLIENT_ID",
  clientSecretEnv: "APPLE_CLIENT_SECRET",
  scopes: [],
  responseMode: "query"
}
```

Granite currently does not request Apple `name` or `email` scopes, so `form_post` is not required for this flow. With `response_mode=query`, Apple should return through `GET /api/auth/callback/apple?code=...&state=...`, where `SameSite=Lax` cookies are expected to be included.

After this code change, deploy `granite-v2` to production. No iOS or Android app rebuild is required for this specific fix because the app loads the web login flow from `https://v2.granite.kr`.

## Consequences

Apple login should stop failing at `invalid_state` when started and completed on `https://v2.granite.kr`.

This keeps the state cookie on the safer default `SameSite=Lax` behavior used by the other OAuth providers.

If Granite later needs Apple first-name, last-name, or email scopes from the initial authorization response, revisit this decision. Apple may require `response_mode=form_post` when requesting those scopes. In that case, Apple-specific state handling should be changed to support cross-site POST callbacks, most likely by setting the OAuth state cookie with `SameSite=None; Secure` only for Apple or by using another server-side state store.

## Alternatives considered

Use `SameSite=None; Secure` for the Apple OAuth state cookie:

- This likely fixes `form_post` callbacks.
- It is broader cookie behavior than needed for the current Apple flow.
- It becomes the preferred option only if Granite must keep `form_post`, especially when requesting Apple profile scopes.

Keep `form_post` and move state to a server-side store:

- This avoids relying on a cross-site callback cookie.
- It introduces storage and expiry complexity that is unnecessary for the current scope-less Apple login.

Treat the issue as a native app or WebView problem:

- Rejected. The same failure appears in the regular web browser.
- The callback reaches the web route and fails in web state validation, so this is a web OAuth flow issue.

## Verification checklist

Before deploying:

- Confirm Apple Developer Services ID has `v2.granite.kr` as a domain.
- Confirm Apple return URL is exactly `https://v2.granite.kr/api/auth/callback/apple`.
- Confirm production `APP_BASE_URL` is `https://v2.granite.kr`.
- Confirm `APPLE_WEB_CLIENT_ID` matches the Apple Services ID used for web login.

After deploying:

- Open a clean or private browser session at `https://v2.granite.kr/login`.
- Start Apple login from that exact host.
- Confirm the final URL is not `/login?error=invalid_state`.
- Confirm existing users land on `/me`.
- Confirm first-time users land on `/signup` with the pending signup cookie set.
- Repeat inside the mobile app WebView; app rebuild is not required if the app already points to `https://v2.granite.kr`.
