# Native Social Login in Flutter WebView

## Context

Granite currently uses one Next.js login page for both the public web and the Flutter app WebView. The Kakao and Naver buttons submit the existing web OAuth form, so a mobile app user may be redirected through a provider web session and return immediately if the provider already has an active account session or prior consent.

That behavior is valid for web OAuth, but it is not the desired app experience. In the Flutter app, Kakao and Naver should use native provider login first:

- Kakao: prefer KakaoTalk login, then fall back to Kakao Account login.
- Naver: prefer the native Naver SDK/app login flow, with account login fallback from the provider SDK.
- Apple and Google stay unchanged for now.
- The public web login flow must not regress.

References:

- Kakao Flutter Login docs: https://developers.kakao.com/docs/latest/en/kakaologin/flutter
- Naver Login developer guide: https://developers.naver.com/docs/login/devguide/devguide.md
- Naver Android SDK guide: https://developers.naver.com/docs/login/android/android.md
- Naver iOS SDK guide: https://developers.naver.com/docs/login/ios/ios.md

## Decision

Use progressive enhancement on the existing login page:

1. Keep the current provider forms as the default behavior.
2. Add a small client-side bridge layer on the login page.
3. When `window.FlutterWebView` is available and the provider is `kakao` or `naver`, prevent the form submit and send an `auth.native.login.requested` message to Flutter.
4. When the bridge is unavailable, or the provider is not native-supported, let the existing web OAuth form submit.

This keeps the web browser path intact and confines app-specific behavior to the WebView surface.

## Rejected Alternatives

### Replace All Web OAuth Buttons with Native Login

This would break or complicate the public web login path. It also forces Apple and Google into scope before we need them.

### Use Provider Tokens Directly in the WebView

The WebView should not receive long-lived provider tokens as a browser-accessible session primitive. Provider tokens should be sent from the app to the server, verified server-side, and exchanged for a Granite session.

### Open Provider Authorization URLs Externally from WebView

This would improve some mobile browser behavior, but it still does not give the app a clean native SDK flow, token lifecycle, or provider-app fallback control.

## Architecture

### Web Login Page

Add a client component around provider buttons, for example `LoginProviderForm`.

Responsibilities:

- Render the existing form fields: `provider`, `returnTo`.
- Submit normally by default.
- On submit, detect a native bridge and native-supported providers.
- Send a bridge message to Flutter for `kakao` and `naver`.
- Show a short pending state while the app handles native login.
- If bridge sending fails, fall back to normal web submit.

Suggested bridge message:

```json
{
  "version": 1,
  "id": "native-login-<timestamp>",
  "type": "auth.native.login.requested",
  "direction": "web-to-native",
  "payload": {
    "provider": "kakao",
    "returnTo": "/me",
    "surface": "flutter-webview"
  }
}
```

The current `auth.login.requested` bridge message exists in the Flutter app, but it is tied to older session handoff scaffolding. Use a new message type so this flow can be implemented without reviving ambiguous legacy behavior.

### Flutter App

Add a native auth bridge handler for `auth.native.login.requested`.

Responsibilities:

- Read `provider` and `returnTo`.
- Call the provider-specific native service.
- Send provider credential material to the Granite server over HTTPS.
- Receive a short-lived handoff code.
- Load the WebView to the server consume endpoint.

Kakao service behavior:

- Initialize Kakao SDK at app startup with the native app key.
- If KakaoTalk login is available, call KakaoTalk login.
- Otherwise call Kakao Account login.
- Return the Kakao access token to the app-side bridge service for server exchange.

Naver service behavior:

- Connect the official Android/iOS Naver SDKs through platform channels.
- Keep the Dart interface provider-agnostic so platform-channel internals remain isolated from the WebView bridge and server exchange.
- Return the Naver access token to the app-side bridge service for server exchange.

### Server Native Auth Exchange

Add a server endpoint:

```text
POST /api/auth/native/exchange
```

Request body:

```json
{
  "provider": "kakao",
  "accessToken": "<provider access token>",
  "returnTo": "/me"
}
```

Server behavior:

1. Validate `provider` is `kakao` or `naver`.
2. Fetch the provider profile server-side using the provider access token.
3. Reuse existing profile normalization where possible.
4. If a Granite user exists, create a one-time handoff code tied to that user and return target.
5. If the user is new, create a pending signup token or handoff code that routes to `/signup`.
6. Return only the one-time handoff code to Flutter.

Response body:

```json
{
  "handoffCode": "<short-lived opaque code>",
  "returnTo": "/me"
}
```

Add a consume endpoint:

```text
GET /api/auth/native/consume?code=<handoffCode>
```

Server behavior:

1. Validate and consume the one-time code.
2. Set the existing `granite_session` httpOnly cookie for returning users, or set the existing pending signup cookie for new users.
3. Redirect to `/me` or `/signup`.

The code must be single-use and short-lived.

## Data Flow

### Public Web

```text
Login button
-> Existing form submit
-> startOAuthLoginAction
-> Provider web OAuth
-> /api/auth/callback/[provider]
-> Granite session or signup
```

### Flutter WebView, Kakao/Naver

```text
Login button
-> LoginProviderForm detects Flutter bridge
-> auth.native.login.requested
-> Flutter native provider SDK
-> POST /api/auth/native/exchange
-> handoffCode
-> WebView loads /api/auth/native/consume?code=...
-> httpOnly Granite cookie
-> /me or /signup
```

### Flutter WebView, Apple/Google

```text
Login button
-> Existing form submit
-> Existing web OAuth flow
```

## Configuration

### Kakao

Needed in Flutter app config:

- Kakao native app key.
- iOS URL scheme and `LSApplicationQueriesSchemes` entries required by Kakao SDK.
- Android manifest settings required by Kakao SDK.

Needed in Kakao developer console:

- Android package name and key hash.
- iOS bundle ID.
- Redirect URI remains required for web OAuth.

### Naver

Needed in Flutter app config:

- Naver client ID.
- Naver client secret or client metadata required by the native SDK setup.
- iOS URL scheme and query schemes.
- Android package/application settings.

Needed in Naver developer console:

- Android app settings.
- iOS app settings.
- Existing web OAuth settings remain for the public web.

Do not remove existing web OAuth environment variables. They continue to serve public web login and Apple/Google fallback behavior.

## Error Handling

Flutter should map native failures into predictable WebView destinations:

- User cancels provider login: stay on `/login?returnTo=/me` and show no scary error.
- Provider SDK failure: navigate to `/login?error=native_login_failed`.
- Server exchange failure: navigate to `/login?error=native_exchange_failed`.
- Handoff consume failure: navigate to `/login?error=native_handoff_failed`.

Server logs should include provider and stage, but never log access tokens.

## Testing

Web repo:

- Unit test that web login forms still contain the normal server action fallback.
- Unit/client test that bridge-enabled Kakao/Naver submits send native bridge messages instead of form submit.
- Unit/client test that Apple/Google still use web submit.
- Route tests for `/api/auth/native/exchange`.
- Route tests for `/api/auth/native/consume`.
- Regression tests for existing OAuth callback behavior.

Flutter repo:

- Bridge handler tests for `auth.native.login.requested`.
- Provider service tests using fake Kakao/Naver clients.
- WebView screen test or handler test proving the consume URL is loaded after a successful handoff.
- Manual simulator/device test:
  - KakaoTalk installed.
  - KakaoTalk not installed.
  - Naver app installed.
  - Naver app not installed.

## Rollout

Implement Kakao first because Kakao has an official Flutter SDK. Implement Naver second through official Android/iOS SDK platform channels. Keep the web OAuth path available throughout the rollout.

Apple and Google stay out of scope until Kakao/Naver native login is stable.
