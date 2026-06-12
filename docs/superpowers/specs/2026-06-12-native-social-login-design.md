# Flutter WebView 네이티브 소셜 로그인 설계

## 배경

현재 Granite는 일반 웹과 Flutter 앱 WebView에서 같은 Next.js 로그인 페이지를 사용한다. 카카오와 네이버 버튼은 기존 웹 OAuth form을 제출한다. 그래서 모바일 앱 사용자가 카카오/네이버 웹 세션을 거쳐 로그인하게 되고, provider 쪽에 이미 활성 계정 세션이나 기존 동의 이력이 있으면 별도 대기 없이 바로 돌아올 수 있다.

이 동작은 웹 OAuth 관점에서는 정상이다. 하지만 앱 UX로는 원하는 형태가 아니다. Flutter 앱에서는 카카오와 네이버를 먼저 네이티브 provider 로그인으로 처리해야 한다.

- Kakao: 카카오톡 로그인을 우선 사용하고, 실패하거나 사용할 수 없으면 카카오계정 로그인으로 fallback한다.
- Naver: 네이버 네이티브 SDK/앱 로그인 흐름을 우선 사용하고, provider SDK의 계정 로그인 fallback을 따른다.
- Apple과 Google은 이번 범위에서 변경하지 않는다.
- 일반 웹 로그인 흐름은 깨지면 안 된다.

참고 문서:

- Kakao Flutter Login docs: https://developers.kakao.com/docs/latest/en/kakaologin/flutter
- Naver Login developer guide: https://developers.naver.com/docs/login/devguide/devguide.md
- Naver Android SDK guide: https://developers.naver.com/docs/login/android/android.md
- Naver iOS SDK guide: https://developers.naver.com/docs/login/ios/ios.md

## 결정

기존 로그인 페이지에 progressive enhancement 방식을 적용한다.

1. 현재 provider form을 기본 동작으로 유지한다.
2. 로그인 페이지에 작은 client-side bridge 레이어를 추가한다.
3. `window.FlutterWebView`가 있고 provider가 `kakao` 또는 `naver`이면 form submit을 막고 Flutter로 `auth.native.login.requested` 메시지를 보낸다.
4. bridge가 없거나 native 지원 provider가 아니면 기존 웹 OAuth form submit을 그대로 실행한다.

이 방식은 일반 웹 브라우저 경로를 그대로 유지하면서, 앱 전용 동작을 WebView surface 안에만 가둔다.

## 제외한 대안

### 모든 웹 OAuth 버튼을 네이티브 로그인으로 교체

일반 웹 로그인 경로를 깨뜨리거나 복잡하게 만든다. 또한 아직 필요하지 않은 Apple과 Google까지 범위에 들어온다.

### Provider 토큰을 WebView에서 직접 세션처럼 사용

WebView는 장기 provider 토큰을 브라우저에서 접근 가능한 세션 값으로 받아서는 안 된다. provider 토큰은 앱에서 서버로 보내고, 서버에서 검증한 뒤 Granite 세션으로 교환해야 한다.

### WebView에서 provider authorization URL을 외부 브라우저로 열기

일부 모바일 브라우저 동작은 개선될 수 있지만, 앱 SDK 기반 로그인 흐름, 토큰 생명주기, provider 앱 fallback 제어를 깔끔하게 확보하지 못한다.

## 아키텍처

### 웹 로그인 페이지

provider 버튼 주변에 client component를 추가한다. 예: `LoginProviderForm`.

역할:

- 기존 form field인 `provider`, `returnTo`를 렌더링한다.
- 기본값은 일반 submit이다.
- submit 시점에 native bridge와 native 지원 provider 여부를 확인한다.
- `kakao`, `naver`이면 Flutter로 bridge 메시지를 보낸다.
- 앱이 native login을 처리하는 동안 짧은 pending 상태를 보여준다.
- bridge 전송이 실패하면 일반 웹 submit으로 fallback한다.

권장 bridge 메시지:

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

현재 Flutter 앱에는 `auth.login.requested` bridge 메시지가 이미 있다. 다만 이 메시지는 이전 session handoff scaffolding과 연결되어 있다. 애매한 legacy 동작을 되살리지 않기 위해 이 흐름에는 새 메시지 타입을 사용한다.

### Flutter 앱

`auth.native.login.requested`를 처리하는 native auth bridge handler를 추가한다.

역할:

- `provider`, `returnTo`를 읽는다.
- provider별 native service를 호출한다.
- provider credential을 Granite 서버로 HTTPS 전송한다.
- 짧게 살아있는 handoff code를 받는다.
- WebView를 서버 consume endpoint로 이동시킨다.

Kakao service 동작:

- 앱 시작 시 Kakao SDK를 native app key로 초기화한다.
- 카카오톡 로그인이 가능하면 카카오톡 로그인을 호출한다.
- 그렇지 않으면 카카오계정 로그인을 호출한다.
- Kakao access token을 앱 쪽 bridge service에 반환해서 서버 교환에 사용한다.

Naver service 동작:

- 공식 Android/iOS Naver SDK를 platform channel로 연결한다.
- Dart interface는 provider-agnostic하게 유지해서 platform-channel 내부 구현이 WebView bridge와 server exchange에서 격리되게 한다.
- Naver access token을 앱 쪽 bridge service에 반환해서 서버 교환에 사용한다.

### 서버 native auth exchange

서버 endpoint를 추가한다.

```text
POST /api/auth/native/exchange
```

요청 body:

```json
{
  "provider": "kakao",
  "accessToken": "<provider access token>",
  "returnTo": "/me"
}
```

서버 동작:

1. `provider`가 `kakao` 또는 `naver`인지 검증한다.
2. provider access token으로 provider profile을 서버에서 조회한다.
3. 가능한 범위에서 기존 profile normalization을 재사용한다.
4. 기존 Granite 사용자가 있으면 user와 return target에 묶인 one-time handoff code를 만든다.
5. 신규 사용자이면 `/signup`으로 이어질 pending signup token 또는 handoff code를 만든다.
6. Flutter에는 one-time handoff code만 반환한다.

응답 body:

```json
{
  "handoffCode": "<short-lived opaque code>",
  "returnTo": "/me"
}
```

consume endpoint를 추가한다.

```text
GET /api/auth/native/consume?code=<handoffCode>
```

서버 동작:

1. one-time code를 검증하고 소비한다.
2. 기존 사용자이면 `granite_session` httpOnly cookie를 설정하고, 신규 사용자이면 기존 pending signup cookie를 설정한다.
3. `/me` 또는 `/signup`으로 redirect한다.

handoff code는 반드시 single-use이고 short-lived여야 한다.

## 데이터 흐름

### 일반 웹

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

## 설정

### Kakao

Flutter 앱 설정에 필요한 값:

- Kakao native app key.
- Kakao SDK가 요구하는 iOS URL scheme 및 `LSApplicationQueriesSchemes`.
- Kakao SDK가 요구하는 Android manifest 설정.

Kakao developer console에서 필요한 설정:

- Android package name 및 key hash.
- iOS bundle ID.
- 기존 웹 OAuth를 위한 redirect URI는 계속 필요하다.

### Naver

Flutter 앱 설정에 필요한 값:

- Naver client ID.
- Native SDK 설정에 필요한 Naver client secret 또는 client metadata.
- iOS URL scheme 및 query schemes.
- Android package/application 설정.

Naver developer console에서 필요한 설정:

- Android 앱 설정.
- iOS 앱 설정.
- 일반 웹을 위한 기존 web OAuth 설정은 유지한다.

기존 web OAuth 환경변수는 제거하지 않는다. 일반 웹 로그인과 Apple/Google fallback 동작에 계속 사용된다.

## 에러 처리

Flutter는 native 실패를 예측 가능한 WebView 목적지로 매핑한다.

- 사용자가 provider 로그인을 취소함: `/login?returnTo=/me`에 머물고 무서운 에러를 보여주지 않는다.
- Provider SDK 실패: `/login?error=native_login_failed`로 이동한다.
- Server exchange 실패: `/login?error=native_exchange_failed`로 이동한다.
- Handoff consume 실패: `/login?error=native_handoff_failed`로 이동한다.

서버 로그에는 provider와 stage를 남기되, access token은 절대 기록하지 않는다.

## 테스트

Web repo:

- 웹 로그인 form이 여전히 일반 server action fallback을 가지고 있는지 테스트한다.
- bridge가 있는 환경에서 Kakao/Naver submit이 form submit 대신 native bridge message를 보내는지 테스트한다.
- Apple/Google이 계속 웹 submit을 사용하는지 테스트한다.
- `/api/auth/native/exchange` route test를 추가한다.
- `/api/auth/native/consume` route test를 추가한다.
- 기존 OAuth callback 동작에 대한 regression test를 유지한다.

Flutter repo:

- `auth.native.login.requested` bridge handler test를 추가한다.
- fake Kakao/Naver client를 사용한 provider service test를 추가한다.
- 성공적인 handoff 이후 consume URL을 로드하는 WebView screen test 또는 handler test를 추가한다.
- 수동 simulator/device test:
  - 카카오톡 설치됨.
  - 카카오톡 설치되지 않음.
  - 네이버 앱 설치됨.
  - 네이버 앱 설치되지 않음.

## 롤아웃

Kakao는 공식 Flutter SDK가 있으므로 먼저 구현한다. Naver는 공식 Android/iOS SDK를 platform channel로 연결하는 방식으로 두 번째에 구현한다. 롤아웃 중에도 web OAuth 경로는 계속 사용할 수 있어야 한다.

Apple과 Google은 Kakao/Naver native login이 안정화될 때까지 범위에서 제외한다.
