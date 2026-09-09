# App Kakao Account Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let updated Granite apps open Kakao's official account login screen while released apps keep their existing KakaoTalk-first login.

**Architecture:** The web app adds an optional `loginMode: "account"` hint only to Kakao native bridge requests. Released apps ignore the unknown payload field; updated Flutter apps validate it, default missing or invalid values to `talkPreferred`, and call Kakao account login with forced reauthentication only for the new mode. Both paths keep the existing Kakao app key, access-token exchange endpoint, identity resolution, and web session cookie.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest, Flutter/Dart, `kakao_flutter_sdk_user`, `flutter_test`

---

## File map

### `granite-v2`

- `app/(site)/login/login-provider-form.tsx` — constructs the native bridge login request; adds the Kakao-only mode hint.
- `app/(site)/login/login-provider-form.test.tsx` — proves Kakao advertises account mode while other providers and normal web submit remain unchanged.

### `granite-climbing-app`

- `lib/features/auth/native_social_login_service.dart` — owns the normalized provider-independent login mode carried from the bridge to provider services.
- `lib/data/bridge/handlers/native_auth_bridge_handler.dart` — validates the untrusted bridge payload and defaults old or invalid messages safely.
- `test/data/bridge/handlers/native_auth_bridge_handler_test.dart` — proves account-mode forwarding and backward-compatible defaults.
- `lib/features/auth/kakao_native_login_service.dart` — selects Kakao Account versus KakaoTalk-first login and maps SDK cancellation/errors.
- `test/features/auth/kakao_native_login_service_test.dart` — proves account mode, forced login prompt, legacy behavior, fallback, and cancellation.

## Worktrees

- Web: `/Users/scorchedrice/.config/superpowers/worktrees/granite-v2/kakao-account-login-web`
- App: `/Users/scorchedrice/.config/superpowers/worktrees/granite-climbing-app/kakao-account-login-app`

## Task 1: Advertise Kakao account mode from the web login form

**Files:**
- Modify: `app/(site)/login/login-provider-form.test.tsx:15-38,138-164`
- Modify: `app/(site)/login/login-provider-form.tsx:113-124`

- [ ] **Step 1: Write the failing Kakao bridge payload test**

Change the existing Kakao expectation so the payload requires the new mode:

```tsx
expect(JSON.parse(postMessage.mock.calls[0][0])).toMatchObject({
  version: 1,
  type: "auth.native.login.requested",
  direction: "web-to-native",
  payload: {
    provider: "kakao",
    returnTo: "/me",
    surface: "flutter-webview",
    loginMode: "account"
  }
});
```

Extend the parameterized non-Kakao test after parsing its request:

```tsx
const request = JSON.parse(postMessage.mock.calls[0][0]);

expect(request).toMatchObject({
  type: "auth.native.login.requested",
  direction: "web-to-native",
  payload: {
    provider,
    returnTo: "/me",
    surface: "flutter-webview"
  }
});
expect(request.payload).not.toHaveProperty("loginMode");
```

- [ ] **Step 2: Run the focused web test and verify RED**

Run:

```bash
pnpm vitest run 'app/(site)/login/login-provider-form.test.tsx'
```

Expected: FAIL because the Kakao payload does not contain `loginMode`.

- [ ] **Step 3: Add the minimal Kakao-only bridge hint**

Update the payload construction:

```tsx
payload: {
  provider,
  returnTo,
  surface: "flutter-webview",
  ...(provider === "kakao" ? { loginMode: "account" } : {})
}
```

Do not change the form action or the no-bridge path.

- [ ] **Step 4: Run the focused web test and verify GREEN**

Run:

```bash
pnpm vitest run 'app/(site)/login/login-provider-form.test.tsx'
```

Expected: all `LoginProviderForm` tests PASS.

- [ ] **Step 5: Run web type checking**

Run:

```bash
pnpm typecheck
```

Expected: exit 0 with no TypeScript errors.

- [ ] **Step 6: Commit the web compatibility change**

```bash
git add 'app/(site)/login/login-provider-form.tsx' 'app/(site)/login/login-provider-form.test.tsx'
git commit -m "feat: advertise Kakao account login mode"
```

## Task 2: Normalize the bridge login mode in Flutter

**Files:**
- Modify: `lib/features/auth/native_social_login_service.dart:1-9`
- Modify: `lib/data/bridge/handlers/native_auth_bridge_handler.dart:39-61,156-172`
- Modify: `test/data/bridge/handlers/native_auth_bridge_handler_test.dart:10-56`

- [ ] **Step 1: Write failing bridge normalization tests**

Add a focused test that sends the new web payload and inspects the provider request:

```dart
test('passes Kakao account login mode to the native login service', () async {
  final loginService = FakeNativeSocialLoginService(
    result: const NativeSocialLoginResult(
      provider: 'kakao',
      accessToken: 'kakao-token',
    ),
  );
  final handler = NativeAuthBridgeHandler(
    loginService: loginService,
    loadSessionRequest: RecordingSessionRequestLoader().load,
  );

  await handler.handle(
    const BridgeMessage(
      version: 1,
      type: 'auth.native.login.requested',
      direction: BridgeDirection.webToNative,
      payload: {
        'provider': 'kakao',
        'loginMode': 'account',
      },
    ),
    RecordingBridgeSender(),
  );

  expect(
    loginService.requests.single.loginMode,
    NativeSocialLoginMode.account,
  );
});
```

Add a backward-compatibility test for missing and invalid modes:

```dart
test('defaults missing and invalid Kakao login modes to talk preferred',
    () async {
  for (final value in <Object?>[null, 'unsupported']) {
    final loginService = FakeNativeSocialLoginService(
      result: const NativeSocialLoginResult(
        provider: 'kakao',
        accessToken: 'kakao-token',
      ),
    );
    final handler = NativeAuthBridgeHandler(
      loginService: loginService,
      loadSessionRequest: RecordingSessionRequestLoader().load,
    );

    await handler.handle(
      BridgeMessage(
        version: 1,
        type: 'auth.native.login.requested',
        direction: BridgeDirection.webToNative,
        payload: {
          'provider': 'kakao',
          if (value != null) 'loginMode': value,
        },
      ),
      RecordingBridgeSender(),
    );

    expect(
      loginService.requests.single.loginMode,
      NativeSocialLoginMode.talkPreferred,
    );
  }
});
```

- [ ] **Step 2: Run the focused Flutter bridge test and verify RED**

Run:

```bash
flutter test test/data/bridge/handlers/native_auth_bridge_handler_test.dart
```

Expected: compilation FAIL because `NativeSocialLoginMode` and `loginMode` do not exist.

- [ ] **Step 3: Add the normalized request enum and safe default**

At the top of `native_social_login_service.dart`, define:

```dart
enum NativeSocialLoginMode {
  talkPreferred,
  account,
}
```

Extend `NativeSocialLoginRequest`:

```dart
class NativeSocialLoginRequest {
  const NativeSocialLoginRequest({
    required this.provider,
    this.returnTo,
    this.loginMode = NativeSocialLoginMode.talkPreferred,
  });

  final String provider;
  final String? returnTo;
  final NativeSocialLoginMode loginMode;
}
```

- [ ] **Step 4: Parse only the allowlisted Kakao mode**

Pass the normalized value from `NativeAuthBridgeHandler.handle`:

```dart
final loginMode = _readLoginMode(
  provider,
  message.payload['loginMode'],
);

loginResult = await loginService.login(
  NativeSocialLoginRequest(
    provider: provider,
    returnTo: returnTo,
    loginMode: loginMode,
  ),
);
```

Add the parser below `_readNativeProvider`:

```dart
NativeSocialLoginMode _readLoginMode(String provider, Object? value) {
  if (provider != 'kakao') {
    return NativeSocialLoginMode.talkPreferred;
  }

  if (value == 'account') {
    return NativeSocialLoginMode.account;
  }

  return NativeSocialLoginMode.talkPreferred;
}
```

`talk_preferred`, missing values, and unknown values intentionally share the safe default.

- [ ] **Step 5: Run the focused Flutter bridge test and verify GREEN**

Run:

```bash
flutter test test/data/bridge/handlers/native_auth_bridge_handler_test.dart
```

Expected: all native auth bridge tests PASS.

- [ ] **Step 6: Format and commit the bridge contract change**

```bash
dart format lib/features/auth/native_social_login_service.dart lib/data/bridge/handlers/native_auth_bridge_handler.dart test/data/bridge/handlers/native_auth_bridge_handler_test.dart
git add lib/features/auth/native_social_login_service.dart lib/data/bridge/handlers/native_auth_bridge_handler.dart test/data/bridge/handlers/native_auth_bridge_handler_test.dart
git commit -m "feat: accept Kakao account login mode"
```

## Task 3: Open the Kakao account login screen in account mode

**Files:**
- Modify: `lib/features/auth/kakao_native_login_service.dart:1-69`
- Modify: `test/features/auth/kakao_native_login_service_test.dart:1-109`

- [ ] **Step 1: Write the failing account-mode service test**

Add a test proving that account mode skips KakaoTalk detection and forces the login page:

```dart
test('uses forced Kakao Account login for account mode', () async {
  final client = FakeKakaoLoginClient(
    kakaoTalkInstalled: true,
    talkAccessToken: 'talk-token',
    accountAccessToken: 'account-token',
  );
  final service = KakaoNativeLoginService(client: client);

  final result = await service.login(
    const NativeSocialLoginRequest(
      provider: 'kakao',
      returnTo: '/me',
      loginMode: NativeSocialLoginMode.account,
    ),
  );

  expect(result.accessToken, 'account-token');
  expect(client.installedCheckCount, 0);
  expect(client.talkLoginCount, 0);
  expect(client.accountLoginCount, 1);
  expect(client.forceAccountLoginValues, [true]);
});
```

Add a cancellation mapping test:

```dart
test('maps a cancelled Kakao Account login to cancellation', () async {
  final service = KakaoNativeLoginService(
    client: FakeKakaoLoginClient(
      kakaoTalkInstalled: true,
      talkAccessToken: 'talk-token',
      accountAccessToken: 'account-token',
      accountError: kakao.KakaoClientException(
        kakao.ClientErrorCause.cancelled,
        'cancelled',
      ),
    ),
  );

  await expectLater(
    service.login(
      const NativeSocialLoginRequest(
        provider: 'kakao',
        loginMode: NativeSocialLoginMode.account,
      ),
    ),
    throwsA(isA<NativeSocialLoginCanceledException>()),
  );
});
```

Import the SDK alias in the test:

```dart
import 'package:kakao_flutter_sdk_user/kakao_flutter_sdk_user.dart' as kakao;
```

Replace `FakeKakaoLoginClient` with a recording fake that supports both legacy assertions and the new account-mode assertions:

```dart
class FakeKakaoLoginClient implements KakaoLoginClient {
  FakeKakaoLoginClient({
    required this.kakaoTalkInstalled,
    required this.talkAccessToken,
    required this.accountAccessToken,
    this.throwFromTalk = false,
    this.accountError,
  });

  final bool kakaoTalkInstalled;
  final String talkAccessToken;
  final String accountAccessToken;
  final bool throwFromTalk;
  final Object? accountError;
  var installedCheckCount = 0;
  var talkLoginCount = 0;
  var accountLoginCount = 0;
  final List<bool> forceAccountLoginValues = [];

  @override
  Future<bool> isKakaoTalkInstalled() async {
    installedCheckCount += 1;
    return kakaoTalkInstalled;
  }

  @override
  Future<String> loginWithKakaoTalk() async {
    talkLoginCount += 1;
    if (throwFromTalk) {
      throw Exception('Talk login failed.');
    }

    return talkAccessToken;
  }

  @override
  Future<String> loginWithKakaoAccount({bool forceLogin = false}) async {
    accountLoginCount += 1;
    forceAccountLoginValues.add(forceLogin);
    final error = accountError;
    if (error != null) {
      throw error;
    }

    return accountAccessToken;
  }
}
```

- [ ] **Step 2: Run the focused Kakao service test and verify RED**

Run:

```bash
flutter test test/features/auth/kakao_native_login_service_test.dart
```

Expected: compilation FAIL because the client does not accept `forceLogin` and account mode is not implemented.

- [ ] **Step 3: Extend the Kakao client boundary**

Change the interface:

```dart
abstract interface class KakaoLoginClient {
  Future<bool> isKakaoTalkInstalled();

  Future<String> loginWithKakaoTalk();

  Future<String> loginWithKakaoAccount({bool forceLogin = false});
}
```

Implement the SDK prompt without exposing SDK types outside the adapter:

```dart
@override
Future<String> loginWithKakaoAccount({bool forceLogin = false}) async {
  final token = await kakao.UserApi.instance.loginWithKakaoAccount(
    prompts: forceLogin ? <kakao.Prompt>[kakao.Prompt.login] : null,
  );
  return token.accessToken;
}
```

- [ ] **Step 4: Select the requested mode and normalize SDK errors**

Wrap the provider login in `login`:

```dart
final String accessToken;
try {
  accessToken = await _login(request.loginMode);
} on kakao.KakaoClientException catch (error) {
  if (error.reason == kakao.ClientErrorCause.cancelled) {
    throw const NativeSocialLoginCanceledException();
  }

  throw NativeSocialLoginException(
    'Kakao native login failed.',
    diagnosticCode: 'kakao-${error.reason.name}',
  );
} catch (_) {
  throw const NativeSocialLoginException('Kakao native login failed.');
}
```

Replace `_login()` with:

```dart
Future<String> _login(NativeSocialLoginMode mode) async {
  if (mode == NativeSocialLoginMode.account) {
    return client.loginWithKakaoAccount(forceLogin: true);
  }

  if (!await client.isKakaoTalkInstalled()) {
    return client.loginWithKakaoAccount();
  }

  try {
    return await client.loginWithKakaoTalk();
  } catch (_) {
    return client.loginWithKakaoAccount();
  }
}
```

This preserves every legacy default and changes only explicit account mode.

- [ ] **Step 5: Run the focused Kakao tests and verify GREEN**

Run:

```bash
flutter test test/features/auth/kakao_native_login_service_test.dart test/data/bridge/handlers/native_auth_bridge_handler_test.dart
```

Expected: all focused Kakao and native bridge tests PASS.

- [ ] **Step 6: Format and commit the Kakao implementation**

```bash
dart format lib/features/auth/kakao_native_login_service.dart test/features/auth/kakao_native_login_service_test.dart
git add lib/features/auth/kakao_native_login_service.dart test/features/auth/kakao_native_login_service_test.dart
git commit -m "feat: open Kakao account login screen"
```

## Task 4: Run repository-level verification

**Files:**
- Verify only; no source changes expected.

- [ ] **Step 1: Verify the web repository**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
git diff --check
git status --short --branch
```

Expected: tests, typecheck, and build exit 0; no uncommitted source changes remain.

- [ ] **Step 2: Verify the Flutter repository**

Run:

```bash
dart format --set-exit-if-changed lib test
flutter analyze
flutter test
git diff --check
git status --short --branch
```

Expected: formatter, analyzer, and all Flutter tests exit 0; no uncommitted source changes remain.

- [ ] **Step 3: Confirm the commit split**

Run in the web worktree:

```bash
git log --oneline main..HEAD
```

Expected: the plan commit plus `feat: advertise Kakao account login mode`.

Run in the app worktree:

```bash
git log --oneline version/1.0.0..HEAD
```

Expected: `feat: accept Kakao account login mode` and `feat: open Kakao account login screen`.

## Task 5: Local integration checkpoint before any production deploy

**Files:**
- No committed source changes.

- [ ] **Step 1: Reuse the existing local web environment without copying secrets**

From the web worktree, create an ignored symlink:

```bash
ln -s /Users/scorchedrice/granite/granite-v2/.env.local .env.local
```

Expected: `.env.local` resolves to the existing environment and remains ignored by Git.

- [ ] **Step 2: Start the local web app**

Run in the web worktree:

```bash
pnpm dev
```

Expected: Next.js serves `http://localhost:3000`.

- [ ] **Step 3: Launch the updated app against local web**

Run in the app worktree:

```bash
flutter run \
  --dart-define-from-file=config/prod.json \
  --dart-define=GRANITE_WEB_URL=http://localhost:3000/
```

Expected: the app opens local Granite; tapping Kakao opens the system authentication surface and Kakao Account page instead of immediately switching to KakaoTalk.

- [ ] **Step 4: Exercise local outcomes**

Verify in order:

1. Closing the Kakao authentication surface returns to Granite and shows the cancellation message.
2. Account input completes provider login.
3. The existing `POST /api/auth/native/session` sets the Granite session and returns to `/me` for an existing account.
4. Tokens, email addresses, cookies, and raw provider exceptions do not appear in app diagnostics.

- [ ] **Step 5: Stop before production writes**

Record the automated and device results. Do not deploy the web branch and do not submit an app build until the local checkpoint is reviewed.

## Task 6: Web-first rollout checkpoint

**Files:**
- No new source changes unless local verification finds a defect.

- [ ] **Step 1: Deploy only the verified web commit**

From the verified web worktree, run:

```bash
pnpm vercel:deploy:prod
```

Expected: Vercel reports a successful production deployment for `v2.granite.kr`. Record `git rev-parse HEAD` before deployment and keep it with the returned deployment URL so the deployed source is traceable to the locally verified commit.

- [ ] **Step 2: Verify the released app**

On the currently released, non-updated app:

1. Open the production login page.
2. Tap Kakao.
3. Confirm the app still takes the KakaoTalk-first route.
4. Complete login with an existing Granite account.
5. Confirm `/me` loads with the existing profile and no duplicate signup is created.

- [ ] **Step 3: Gate the app release**

If released-app verification fails, change the web hint to `talk_preferred`, redeploy the web only, and stop. If it passes, build the new app for TestFlight and Android internal testing; do not force an update.
