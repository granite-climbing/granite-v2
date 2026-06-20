# Native Social Login Design

**Goal:** 앱 WebView에서 네이티브 소셜 로그인을 완료한 뒤, 별도 D1 handoff 테이블 없이 WebView 세션 쿠키를 설정한다.

**Architecture:** 웹 로그인 화면은 브라우저에서는 기존 OAuth form submit을 유지한다. Flutter WebView 안에서는 `FlutterWebView` 브릿지가 로그인 요청을 가로채고, 네이티브 SDK로 받은 provider token을 WebView 자체의 POST request로 Next.js 서버에 제출한다. Next.js는 provider profile을 검증한 뒤 같은 POST 응답에서 `granite_session` 또는 `granite_pending_signup` 쿠키를 설정하고 303 redirect를 반환한다.

## Flow

1. 사용자가 WebView 로그인 화면에서 provider 버튼을 누른다.
2. `LoginProviderForm`은 Flutter bridge가 있으면 `auth.native.login.requested` 메시지를 보낸다.
3. Flutter는 provider별 native SDK 로그인을 수행한다.
4. Flutter는 `WebViewController.loadRequest`로 `POST /api/auth/native/session`을 호출한다.
5. 서버는 `fetchOAuthProfile(provider, { accessToken, idToken })`으로 provider token을 검증한다.
6. 기존 user identity가 있으면 `granite_session` 쿠키를 설정하고 `returnTo`로 303 redirect한다.
7. 신규 identity면 `granite_pending_signup` 쿠키를 설정하고 `/signup`으로 303 redirect한다.

## Request

`POST /api/auth/native/session`

Content type:

```text
application/x-www-form-urlencoded
```

Body:

```text
provider=apple&idToken=<id-token>&returnTo=/me
```

Provider token rules:

- `apple`: `idToken` required
- `google`: `accessToken` or `idToken` required
- `kakao`: `accessToken` required
- `naver`: `accessToken` required

`returnTo` must be a same-origin path starting with `/` and not `//`; invalid values fall back to `/me`.

## Error Handling

Invalid native session requests redirect to `/login?error=<code>` with 303. Provider profile failures are logged without access tokens or id tokens.

## Removed Handoff Design

The previous `POST /api/auth/native/exchange -> GET /api/auth/native/consume` design required a temporary D1 table named `native_auth_handoffs`. That table is no longer part of this flow. The WebView POST response sets cookies directly, so no database-backed handoff code is needed.
