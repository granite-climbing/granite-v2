# 앱 전용 카카오 계정 로그인 전환 설계

**상태:** 서면 검토 대기  
**작성일:** 2026-08-17  
**대상 저장소:** `granite-v2`, `granite-climbing-app`

## 목표

업데이트된 Granite 앱에서 카카오 로그인 버튼을 누르면 카카오톡 앱으로 즉시 이동하지 않고, iOS 시스템 인증 세션 또는 Android 브라우저 인증 화면에 카카오 공식 계정 로그인 페이지를 연다. 사용자는 해당 페이지에서 카카오톡 로그인 또는 카카오계정 직접 입력을 선택할 수 있어야 한다.

앱을 업데이트하지 않은 사용자는 현재의 카카오톡 우선 로그인 방식을 계속 사용할 수 있어야 한다. 강제 업데이트, 계정 마이그레이션, 재가입은 요구하지 않는다.

## 범위 밖

- 일반 모바일·데스크톱 브라우저에서의 Granite 웹 로그인 동작 변경
- Google 및 Apple 로그인 변경
- 카카오 개발자 애플리케이션, 앱 키 또는 사용자 식별 체계 변경
- Granite 사용자·OAuth identity·세션 스키마 변경
- 구버전 앱에 새 카카오 계정 로그인 화면을 강제로 표시

## 현재 동작

1. 앱 WebView의 `LoginProviderForm`이 카카오 버튼 제출을 가로챈다.
2. 웹은 `auth.native.login.requested` 브리지 메시지를 Flutter에 전송한다.
3. Flutter의 `KakaoNativeLoginService`는 카카오톡 설치 여부를 확인한다.
4. 카카오톡이 설치되어 있으면 `loginWithKakaoTalk()`을 먼저 호출하고, 미설치 또는 실패 시에만 `loginWithKakaoAccount()`를 호출한다.
5. 발급된 액세스 토큰은 기존 `POST /api/auth/native/session`으로 전달되고 Granite 웹 세션으로 교환된다.

## 검토한 접근안

### 1. 웹이 선택 모드를 광고하고 새 앱이 해석한다 — 선택

웹의 앱 브리지 요청에 선택적 `loginMode` 필드를 추가한다. 카카오 요청에는 `account`를 전송한다. 현재 배포된 앱은 알지 못하는 payload 필드를 무시하므로 기존 카카오톡 우선 동작을 유지한다. 업데이트된 앱은 이 필드를 읽고 카카오계정 로그인을 호출한다.

이 방식은 웹을 먼저 배포해 구버전 호환성을 검증할 수 있고, 앱 배포 후에도 웹에서 모드를 `talk_preferred`로 되돌려 새 앱의 로그인 방식을 원격으로 롤백할 수 있다.

### 2. 새 앱에 계정 로그인 방식을 고정한다

Flutter 코드만 변경하고 웹 브리지 계약은 그대로 유지한다. 변경 범위는 가장 작지만 웹 선배포 검증 단계가 의미가 없고, 앱 배포 후 로그인 방식에 문제가 생기면 스토어 업데이트 없이는 되돌릴 수 없다.

### 3. 앱 WebView에서 웹 OAuth를 사용한다

구버전 앱에도 원격 적용할 수 있지만 첨부 예시와 같은 시스템 인증 세션을 보장하지 못하고, 현재 정상 동작하는 네이티브 토큰 교환 경계를 변경한다. 이번 범위에서는 사용하지 않는다.

## 선택한 아키텍처

### 브리지 계약

`auth.native.login.requested`의 기존 필드를 유지하고 다음 선택 필드를 추가한다.

```json
{
  "version": 1,
  "type": "auth.native.login.requested",
  "direction": "web-to-native",
  "payload": {
    "provider": "kakao",
    "returnTo": "/me",
    "surface": "flutter-webview",
    "loginMode": "account"
  }
}
```

지원 값은 다음 두 가지다.

- `account`: 카카오 공식 계정 로그인 페이지를 연다.
- `talk_preferred`: 현재와 같이 카카오톡을 먼저 시도하고 계정 로그인으로 fallback한다.

구버전 앱은 `loginMode`를 무시한다. 업데이트된 앱은 필드가 없거나 값이 유효하지 않으면 `talk_preferred`를 기본값으로 사용한다. 카카오 이외 provider에서는 `loginMode`를 무시한다.

### 업데이트된 앱의 데이터 흐름

```text
앱 WebView 카카오 버튼
  -> auth.native.login.requested(loginMode=account)
  -> Flutter bridge가 provider, returnTo, loginMode 검증
  -> KakaoNativeLoginService가 loginWithKakaoAccount(prompts: [Prompt.login]) 호출
  -> 카카오 공식 인증 화면에서 사용자 인증
  -> 기존 카카오 access token 발급
  -> POST /api/auth/native/session
  -> 기존 resolveOAuthLogin으로 동일한 provider user ID 조회
  -> 기존 Granite 세션 cookie 설정
  -> /me 또는 기존 returnTo 이동
```

`Prompt.login`은 브라우저의 기존 카카오 인증 상태와 관계없이 계정 로그인 화면을 요청하기 위해 사용한다. 카카오가 제공하는 페이지의 세부 UI와 iOS 최초 시스템 안내 문구는 앱이 직접 제어하지 않는다.

### 미업데이트 앱의 데이터 흐름

```text
앱 WebView 카카오 버튼
  -> auth.native.login.requested(loginMode=account)
  -> 구버전 Flutter가 알 수 없는 loginMode 필드를 무시
  -> 기존 카카오톡 우선 로그인
  -> 기존 POST /api/auth/native/session
  -> 정상 로그인
```

웹 브라우저에는 `FlutterWebView` 브리지가 없으므로 기존 Server Action 기반 웹 OAuth 제출 경로를 그대로 사용한다.

## 컴포넌트 변경

### `granite-v2`

- `LoginProviderForm`이 앱 브리지의 카카오 요청에만 `loginMode: "account"`를 추가한다.
- 기존 브리지 메시지 버전, provider, `returnTo`, `surface`는 유지한다.
- 테스트에서 카카오 요청의 새 필드와 다른 provider의 미포함을 검증한다.
- 일반 웹 form submit이 변하지 않았음을 회귀 테스트한다.

### `granite-climbing-app`

- `NativeSocialLoginRequest`에 검증된 선택적 로그인 모드를 전달한다.
- `NativeAuthBridgeHandler`는 카카오 요청에서만 `account`와 `talk_preferred`를 허용하고, 누락·알 수 없는 값은 `talk_preferred`로 정규화한다.
- `KakaoNativeLoginService`는 `account`에서 `loginWithKakaoAccount(prompts: [Prompt.login])`을 호출한다.
- `talk_preferred`에서는 기존 카카오톡 우선 및 계정 fallback 로직을 그대로 유지한다.
- 카카오 SDK 취소 오류는 `NativeSocialLoginCanceledException`으로 정규화하고, 그 외 오류는 민감 정보를 노출하지 않는 진단 코드로 변환한다.

## 기존 사용자 및 데이터 안전성

- 카카오 Native App Key를 변경하지 않는다.
- 두 로그인 방식 모두 같은 카카오 개발자 애플리케이션의 access token을 발급한다.
- 서버는 지금과 동일하게 카카오 프로필의 provider user ID로 기존 OAuth identity를 찾는다.
- 사용자 테이블, OAuth identity 테이블, 세션 쿠키 형식 및 만료 정책을 변경하지 않는다.
- 구버전·신버전 앱이 동시에 로그인해도 동일한 서버 계약을 사용한다.
- 앱 업데이트를 강제하지 않는다.

## 오류 및 취소 처리

- 사용자가 시스템 인증 창을 닫으면 로그인 화면으로 돌아가고 “로그인이 취소되었습니다.”를 표시한다.
- 카카오 인증 실패는 기존 `auth.native.login.failed` 메시지로 전달하고 토큰·이메일·raw provider 오류를 로그에 남기지 않는다.
- 카카오 로그인 성공 후 세션 교환이 실패하면 기존 session-sync 실패 경로를 사용한다.
- `loginMode`가 누락되거나 잘못된 경우 로그인 자체를 막지 않고 `talk_preferred`로 안전하게 fallback한다.
- 웹에서 `talk_preferred`를 다시 광고하면 업데이트된 앱도 기존 카카오톡 우선 흐름으로 즉시 롤백한다.

## 테스트 및 로컬 검증

### 웹

- 카카오 앱 브리지 요청에 `loginMode: "account"`가 포함된다.
- Apple·Google 요청에는 카카오 전용 모드가 포함되지 않는다.
- 브리지가 없는 일반 웹은 기존 form submit을 유지한다.
- 관련 Vitest, typecheck 및 build가 통과한다.

### 앱

- `account` 모드가 카카오톡 설치 여부를 확인하거나 카카오톡 로그인을 호출하지 않고 계정 로그인을 한 번 호출한다.
- 계정 로그인 호출에 `Prompt.login`이 전달된다.
- 모드 누락·알 수 없는 값·`talk_preferred`는 기존 카카오톡 우선 동작을 유지한다.
- 카카오톡 미설치 및 카카오톡 로그인 실패 시 기존 계정 fallback을 유지한다.
- 취소와 일반 오류가 서로 다른 웹 메시지로 처리된다.
- `flutter analyze`, `flutter test`, `git diff --check`가 통과한다.
- iOS·Android 실기기에서 provider login과 session sync 완료를 각각 확인한다.

## 배포 순서 및 중단 지점

1. **로컬 구현·자동 테스트:** 웹과 앱을 각각 별도 커밋으로 작성하고 전체 관련 테스트를 통과시킨다.
2. **로컬 통합 확인:** 로컬 `granite-v2`를 앱 WebView에 연결해 새 앱의 계정 로그인 화면, 취소, 성공, 세션 반영을 확인한다.
3. **웹만 운영 배포:** 앱 전용 브리지 payload의 `loginMode` 추가만 먼저 배포한다.
4. **구버전 앱 확인:** 현재 스토어 또는 보관된 운영 앱으로 카카오톡 직행 로그인과 Granite 세션 생성이 계속 정상인지 확인한다. 실패하면 웹 payload 변경을 되돌리고 앱 배포를 중단한다.
5. **새 앱 사전 배포:** TestFlight 및 Android 내부 테스트에서 카카오 공식 계정 로그인 화면과 기존 계정 로그인을 확인한다.
6. **앱 업데이트:** 강제 업데이트 없이 새 버전을 스토어에 배포한다.
7. **점진 관찰:** provider login과 session sync의 성공·취소·실패 상태만 관찰한다. 문제가 있으면 웹의 `loginMode`를 `talk_preferred`로 바꿔 즉시 완화한다.

프로덕션 웹 배포와 앱스토어 제출은 각 직전 검증 결과를 확인한 후 별도 중단 지점으로 진행한다.

## 완료 조건

- 미업데이트 앱의 카카오톡 우선 로그인이 웹 선배포 전후 동일하게 성공한다.
- 업데이트된 앱의 카카오 버튼이 카카오톡 앱으로 즉시 이동하지 않고 공식 계정 로그인 화면을 연다.
- 계정 직접 입력과 화면 내 카카오톡 로그인 선택이 가능하다.
- 기존 카카오 사용자가 신규 Granite 계정으로 중복 생성되지 않고 기존 계정으로 로그인한다.
- 일반 웹, Google, Apple 로그인에 동작 변화가 없다.
- 웹 모드 변경만으로 업데이트된 앱을 기존 카카오톡 우선 흐름으로 되돌릴 수 있다.
