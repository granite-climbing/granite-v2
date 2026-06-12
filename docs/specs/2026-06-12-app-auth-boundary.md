# App Auth Boundary

Granite has two runtime surfaces:

- **Web browser:** the website owns navigation and authentication UI.
- **Flutter app:** the native shell owns app startup, app login state, and when the WebView may be shown.

The app must not show protected WebView fallback screens such as "로그인이 필요합니다." as the first experience. If an app user is not authenticated, the app shows a native login screen before opening the WebView.

## Session Ownership

- Flutter stores the app session in app-owned storage.
- Granite web stores the web session as a server-set HttpOnly cookie.
- The app does not inject long-lived app tokens into WebView JavaScript.
- The app may open a short-lived handoff URL in WebView after native login.

## Handoff Flow

```text
App launches
  -> AuthGate checks app session
  -> no app session: show NativeLoginScreen
  -> native login succeeds
  -> app stores app session
  -> app requests or builds a short-lived web handoff
  -> WebView opens /api/auth/app-handoff?code=...
  -> server verifies handoff
  -> server sets Granite web HttpOnly cookie
  -> server redirects WebView to the intended destination
```

## Protected Routes

The app treats these destinations as protected:

- `/me`
- `/me/projects`
- `/me/records`

When the app user is logged out, tapping these destinations must not navigate the WebView first. The app should route to native login and then continue to the intended destination after session sync.

## Web Fallback

The web app still handles direct browser visits safely. A browser user who opens `/me` without a web session may see a web login or fallback state. That fallback is not the app's primary auth UX.
