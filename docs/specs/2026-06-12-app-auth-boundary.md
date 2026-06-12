# App Auth Boundary

Granite has two runtime surfaces:

- **Web browser:** the website owns navigation, authentication UI, and the web session cookie.
- **Flutter app:** the native shell owns the WebView container and app-native integrations, but uses the same web login screen for authentication.

The app must not show protected WebView fallback screens such as "로그인이 필요합니다." as the first experience. Instead, the app opens the web app entrypoint at `/app`; the web server redirects authenticated users to `/me` and unauthenticated users to `/login?returnTo=/me`.

## Session Ownership

- Granite web stores the web session as a server-set HttpOnly cookie.
- The app does not store a separate login session for the current web-login implementation.
- The app does not inject tokens into WebView JavaScript.
- WebView cookies are isolated from the user's normal browser cookies, so the app and browser can keep their sessions independently while sharing the same web login UI.

## App Entrypoint Flow

```text
App launches
  -> WebView opens /app
  -> server checks granite_session cookie
  -> valid session: redirect to /me
  -> no valid session: redirect to /login?returnTo=/me
  -> OAuth callback sets Granite web HttpOnly cookie
  -> callback redirects to /me or signup
```

## Protected Routes

Protected destinations still validate the web session server-side:

- `/me`
- `/me/projects`
- `/me/records`

The app should enter these destinations through `/app` or a future app-specific web entrypoint so logged-out users land on the web login screen instead of a logged-out protected fallback.

## Native Auth

Native provider SDK login and app-to-web session handoff are intentionally deferred. They can be added later if a provider blocks WebView OAuth or if we need app-owned credentials, but they are not required for the current app login flow.
