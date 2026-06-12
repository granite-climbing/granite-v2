# Native Social Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flutter WebView에서 Kakao/Naver 버튼은 네이티브 로그인으로 처리하고, 일반 웹에서는 기존 OAuth form submit을 유지한다.

**Architecture:** 웹 로그인 페이지는 bridge가 있을 때만 Kakao/Naver submit을 가로챈다. Flutter는 native provider SDK로 access token을 받고, 서버의 native exchange endpoint에서 provider profile을 검증한 뒤 one-time handoff code로 `granite_session` 또는 pending signup cookie를 설정한다.

**Tech Stack:** Next.js App Router, Server Actions, Vitest, jose JWT, D1 HTTP helpers, Flutter WebView bridge, Dart tests, Kakao Flutter SDK, Naver Android/iOS SDK via platform channels.

---

## File Structure

Web repo: `/Users/scorchedrice/granite/granite-v2`

- Create `lib/auth/native-handoff.ts`: one-time handoff JWT 생성/검증. returning user와 pending signup 두 결과를 표현한다.
- Create `lib/auth/native-handoff.test.ts`: handoff token round-trip, tamper, expiry-ish invalid handling.
- Modify `lib/auth/oauth/client.ts`: native access token으로 profile을 조회할 수 있게 기존 `fetchOAuthProfile`을 그대로 재사용한다.
- Create `app/api/auth/native/exchange/route.ts`: Flutter가 provider access token을 보내면 profile 검증 후 handoff code를 반환한다.
- Create `app/api/auth/native/exchange/route.test.ts`: returning user, new user, unsupported provider, profile fetch failure.
- Create `app/api/auth/native/consume/route.ts`: handoff code를 소비하고 httpOnly cookie 설정 후 `/me` 또는 `/signup` redirect.
- Create `app/api/auth/native/consume/route.test.ts`: session cookie, pending signup cookie, invalid code redirect.
- Create `app/(site)/login/login-provider-form.tsx`: client component. Flutter bridge가 있으면 Kakao/Naver만 native message를 보내고, 아니면 기존 server action form을 유지한다.
- Create `app/(site)/login/login-provider-form.test.tsx`: bridge/no-bridge submit 동작.
- Modify `app/(site)/login/page.tsx`: provider button form을 client component로 위임한다.
- Modify `app/(site)/login/page.test.ts`: fallback form/action/hidden input 보존 확인.

Flutter repo: `/Users/scorchedrice/granite/granite-climbing-app`

- Create `lib/features/auth/native_social_login_service.dart`: provider-agnostic native login interface와 result 모델.
- Create `lib/features/auth/native_auth_exchange_service.dart`: server exchange 요청과 handoff consume URL 생성.
- Create `lib/data/bridge/handlers/native_auth_bridge_handler.dart`: `auth.native.login.requested` 처리.
- Modify `lib/features/webview/webview_screen.dart`: native auth bridge handler를 기본 handler 목록에 추가하고 WebView consume URL 로딩을 주입한다.
- Create tests under `test/features/auth/` and `test/data/bridge/handlers/`.
- Add Kakao SDK dependency and native config wiring.
- Add Naver platform-channel interface and native stubs with explicit `not_configured` behavior.

---

### Task 1: Web Native Handoff Token

**Files:**
- Create: `lib/auth/native-handoff.ts`
- Create: `lib/auth/native-handoff.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/auth/native-handoff.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  createNativeAuthHandoffToken,
  verifyNativeAuthHandoffToken
} from "./native-handoff";

describe("native auth handoff token", () => {
  it("round-trips a returning user handoff", async () => {
    process.env.JWT_SECRET = "native-handoff-test-secret";

    const token = await createNativeAuthHandoffToken({
      kind: "session",
      userId: "user_1",
      returnTo: "/me"
    });

    await expect(verifyNativeAuthHandoffToken(token)).resolves.toEqual({
      kind: "session",
      userId: "user_1",
      returnTo: "/me"
    });
  });

  it("round-trips a pending signup handoff", async () => {
    process.env.JWT_SECRET = "native-handoff-test-secret";

    const token = await createNativeAuthHandoffToken({
      kind: "signup",
      provider: "kakao",
      providerUserId: "kakao-user",
      email: null,
      displayName: "Kakao User",
      avatarUrl: null,
      returnTo: "/me"
    });

    await expect(verifyNativeAuthHandoffToken(token)).resolves.toEqual({
      kind: "signup",
      provider: "kakao",
      providerUserId: "kakao-user",
      email: null,
      displayName: "Kakao User",
      avatarUrl: null,
      returnTo: "/me"
    });
  });

  it("returns null for invalid handoff tokens", async () => {
    process.env.JWT_SECRET = "native-handoff-test-secret";

    await expect(verifyNativeAuthHandoffToken("not-a-token")).resolves.toBeNull();
  });

  it("sanitizes unsafe return targets", async () => {
    process.env.JWT_SECRET = "native-handoff-test-secret";

    const token = await createNativeAuthHandoffToken({
      kind: "session",
      userId: "user_1",
      returnTo: "https://evil.example"
    });

    await expect(verifyNativeAuthHandoffToken(token)).resolves.toMatchObject({
      returnTo: "/me"
    });
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

```bash
cd /Users/scorchedrice/granite/granite-v2
pnpm vitest run lib/auth/native-handoff.test.ts
```

Expected: FAIL because `./native-handoff` does not exist.

- [ ] **Step 3: Implement handoff token helper**

Create `lib/auth/native-handoff.ts`:

```ts
import { SignJWT, jwtVerify } from "jose";
import type { OAuthProviderId } from "./oauth/types";
import { getUserSessionSecret } from "./session";

export type NativeAuthHandoff =
  | {
      kind: "session";
      userId: string;
      returnTo: string;
    }
  | {
      kind: "signup";
      provider: OAuthProviderId;
      providerUserId: string;
      email: string | null;
      displayName: string;
      avatarUrl: string | null;
      returnTo: string;
    };

export async function createNativeAuthHandoffToken(handoff: NativeAuthHandoff): Promise<string> {
  const payload =
    handoff.kind === "session"
      ? {
          kind: handoff.kind,
          user_id: handoff.userId,
          return_to: sanitizeReturnTo(handoff.returnTo)
        }
      : {
          kind: handoff.kind,
          provider: handoff.provider,
          provider_user_id: handoff.providerUserId,
          email: handoff.email,
          display_name: handoff.displayName,
          avatar_url: handoff.avatarUrl,
          return_to: sanitizeReturnTo(handoff.returnTo)
        };

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(getUserSessionSecret());
}

export async function verifyNativeAuthHandoffToken(token: string): Promise<NativeAuthHandoff | null> {
  try {
    const verified = await jwtVerify(token, getUserSessionSecret());
    const kind = verified.payload.kind;
    const returnTo = typeof verified.payload.return_to === "string" ? sanitizeReturnTo(verified.payload.return_to) : "/me";

    if (kind === "session" && typeof verified.payload.user_id === "string") {
      return {
        kind,
        userId: verified.payload.user_id,
        returnTo
      };
    }

    if (
      kind === "signup" &&
      isProvider(verified.payload.provider) &&
      typeof verified.payload.provider_user_id === "string" &&
      typeof verified.payload.display_name === "string"
    ) {
      return {
        kind,
        provider: verified.payload.provider,
        providerUserId: verified.payload.provider_user_id,
        email: typeof verified.payload.email === "string" ? verified.payload.email : null,
        displayName: verified.payload.display_name,
        avatarUrl: typeof verified.payload.avatar_url === "string" ? verified.payload.avatar_url : null,
        returnTo
      };
    }

    return null;
  } catch {
    return null;
  }
}

function sanitizeReturnTo(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/me";
  }

  return value;
}

function isProvider(value: unknown): value is OAuthProviderId {
  return value === "kakao" || value === "naver" || value === "google" || value === "apple";
}
```

- [ ] **Step 4: Run tests and verify GREEN**

```bash
pnpm vitest run lib/auth/native-handoff.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/native-handoff.ts lib/auth/native-handoff.test.ts
git commit -m "feat(auth): add native auth handoff tokens"
```

---

### Task 2: Web Native Exchange and Consume Routes

**Files:**
- Create: `app/api/auth/native/exchange/route.ts`
- Create: `app/api/auth/native/exchange/route.test.ts`
- Create: `app/api/auth/native/consume/route.ts`
- Create: `app/api/auth/native/consume/route.test.ts`

- [ ] **Step 1: Write failing exchange route tests**

Create tests proving:

```ts
// app/api/auth/native/exchange/route.test.ts
// Required assertions:
// 1. POST kakao + accessToken for existing user returns { handoffCode, returnTo }
// 2. POST naver for unknown user returns a signup handoff
// 3. POST google returns 400 unsupported_provider
// 4. profile fetch failure returns 401 native_profile_failed
```

Mock:

```ts
vi.mock("@/lib/auth/oauth/client", () => ({ fetchOAuthProfile: fetchOAuthProfileMock }));
vi.mock("@/lib/db/user-auth-queries", () => ({ findUserByOAuthIdentity: findUserByOAuthIdentityMock }));
```

- [ ] **Step 2: Implement exchange route**

Implementation shape:

```ts
import { NextRequest, NextResponse } from "next/server";
import { fetchOAuthProfile } from "@/lib/auth/oauth/client";
import { createNativeAuthHandoffToken } from "@/lib/auth/native-handoff";
import { findUserByOAuthIdentity } from "@/lib/db/user-auth-queries";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const provider = body?.provider;
  const accessToken = body?.accessToken;
  const returnTo = sanitizeReturnTo(typeof body?.returnTo === "string" ? body.returnTo : "/me");

  if (provider !== "kakao" && provider !== "naver") {
    return NextResponse.json({ error: "unsupported_provider" }, { status: 400 });
  }

  if (typeof accessToken !== "string" || !accessToken) {
    return NextResponse.json({ error: "missing_access_token" }, { status: 400 });
  }

  try {
    const profile = await fetchOAuthProfile(provider, { accessToken, idToken: null });
    const user = await findUserByOAuthIdentity(profile.provider, profile.providerUserId);
    const handoffCode = await createNativeAuthHandoffToken(
      user
        ? { kind: "session", userId: user.id, returnTo }
        : {
            kind: "signup",
            provider: profile.provider,
            providerUserId: profile.providerUserId,
            email: profile.email,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            returnTo
          }
    );

    return NextResponse.json({ handoffCode, returnTo });
  } catch (error) {
    console.error("[auth.native.exchange]", {
      provider,
      stage: "profile_or_handoff_failed",
      message: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: "native_profile_failed" }, { status: 401 });
  }
}

function sanitizeReturnTo(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/me";
  return value;
}
```

- [ ] **Step 3: Write failing consume route tests**

Create tests proving:

```ts
// app/api/auth/native/consume/route.test.ts
// Required assertions:
// 1. session handoff sets granite_session and redirects to returnTo
// 2. signup handoff sets granite_pending_signup and redirects to /signup
// 3. invalid code redirects to /login?error=native_handoff_failed
```

- [ ] **Step 4: Implement consume route**

Implementation shape:

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyNativeAuthHandoffToken } from "@/lib/auth/native-handoff";
import { createUserSessionToken, getUserSessionCookieOptions, USER_SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { createPendingSignupToken, getPendingSignupCookieOptions, PENDING_SIGNUP_COOKIE_NAME } from "@/lib/auth/signup";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = new URL(request.url).searchParams.get("code");
  const handoff = code ? await verifyNativeAuthHandoffToken(code) : null;

  if (!handoff) {
    return NextResponse.redirect(new URL("/login?error=native_handoff_failed", request.url));
  }

  if (handoff.kind === "session") {
    const sessionToken = await createUserSessionToken({ userId: handoff.userId });
    const response = NextResponse.redirect(new URL(handoff.returnTo, request.url));
    response.cookies.set(USER_SESSION_COOKIE_NAME, sessionToken, getUserSessionCookieOptions());
    return response;
  }

  const pendingSignupToken = await createPendingSignupToken({
    provider: handoff.provider,
    providerUserId: handoff.providerUserId,
    email: handoff.email,
    displayName: handoff.displayName,
    avatarUrl: handoff.avatarUrl,
    returnTo: handoff.returnTo
  });
  const response = NextResponse.redirect(new URL("/signup", request.url));
  response.cookies.set(PENDING_SIGNUP_COOKIE_NAME, pendingSignupToken, getPendingSignupCookieOptions());
  return response;
}
```

- [ ] **Step 5: Run focused web tests**

```bash
pnpm vitest run \
  lib/auth/native-handoff.test.ts \
  app/api/auth/native/exchange/route.test.ts \
  app/api/auth/native/consume/route.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/auth/native lib/auth/native-handoff.ts lib/auth/native-handoff.test.ts
git commit -m "feat(auth): exchange native provider tokens"
```

---

### Task 3: Login Page Native Bridge Fallback

**Files:**
- Create: `app/(site)/login/login-provider-form.tsx`
- Create: `app/(site)/login/login-provider-form.test.tsx`
- Modify: `app/(site)/login/page.tsx`
- Modify: `app/(site)/login/page.test.ts`

- [ ] **Step 1: Write failing client tests**

Create `login-provider-form.test.tsx` with React Testing Library:

```tsx
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginProviderForm } from "./login-provider-form";

describe("LoginProviderForm", () => {
  it("posts a native bridge message for Kakao in Flutter WebView", () => {
    const postMessage = vi.fn();
    vi.stubGlobal("FlutterWebView", { postMessage });

    render(
      <LoginProviderForm provider="kakao" displayLabel="카카오" returnTo="/me" enabled>
        icon
      </LoginProviderForm>
    );

    fireEvent.click(screen.getByRole("button", { name: "카카오로 시작하기" }));

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(JSON.parse(postMessage.mock.calls[0][0])).toMatchObject({
      version: 1,
      type: "auth.native.login.requested",
      direction: "web-to-native",
      payload: {
        provider: "kakao",
        returnTo: "/me",
        surface: "flutter-webview"
      }
    });
  });

  it("keeps normal form submit available when no Flutter bridge exists", () => {
    vi.stubGlobal("FlutterWebView", undefined);

    render(
      <LoginProviderForm provider="naver" displayLabel="네이버" returnTo="/me" enabled>
        icon
      </LoginProviderForm>
    );

    expect(screen.getByRole("button", { name: "네이버로 시작하기" })).toHaveAttribute("type", "submit");
    expect(screen.getByDisplayValue("naver")).toHaveAttribute("name", "provider");
    expect(screen.getByDisplayValue("/me")).toHaveAttribute("name", "returnTo");
  });

  it("does not native-bridge Apple and Google", () => {
    const postMessage = vi.fn();
    vi.stubGlobal("FlutterWebView", { postMessage });

    render(
      <LoginProviderForm provider="google" displayLabel="Google" returnTo="/me" enabled>
        icon
      </LoginProviderForm>
    );

    fireEvent.click(screen.getByRole("button", { name: "Google로 시작하기" }));

    expect(postMessage).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement `LoginProviderForm`**

Use `"use client"` and preserve the existing `action={startOAuthLoginAction}` form. In `onSubmit`, only `preventDefault()` when bridge exists and provider is `kakao` or `naver`.

- [ ] **Step 3: Replace inline form in `page.tsx`**

Keep `ProviderMark`, labels, classes, and hidden inputs through `LoginProviderForm`.

- [ ] **Step 4: Run focused tests**

```bash
pnpm vitest run 'app/(site)/login/page.test.ts' 'app/(site)/login/login-provider-form.test.tsx'
```

Expected: PASS.

- [ ] **Step 5: Browser smoke check**

Open `/login?returnTo=/me`:

- With no Flutter bridge, form submit still navigates to provider web OAuth.
- With an injected fake `window.FlutterWebView`, Kakao/Naver emit native message.

- [ ] **Step 6: Commit**

```bash
git add 'app/(site)/login'
git commit -m "feat(auth): bridge native social login from webview"
```

---

### Task 4: Flutter Native Auth Exchange and Bridge Handler

**Files:**
- Create: `/Users/scorchedrice/granite/granite-climbing-app/lib/features/auth/native_social_login_service.dart`
- Create: `/Users/scorchedrice/granite/granite-climbing-app/lib/features/auth/native_auth_exchange_service.dart`
- Create: `/Users/scorchedrice/granite/granite-climbing-app/lib/data/bridge/handlers/native_auth_bridge_handler.dart`
- Modify: `/Users/scorchedrice/granite/granite-climbing-app/lib/features/webview/webview_screen.dart`
- Test: `/Users/scorchedrice/granite/granite-climbing-app/test/data/bridge/handlers/native_auth_bridge_handler_test.dart`
- Test: `/Users/scorchedrice/granite/granite-climbing-app/test/features/auth/native_auth_exchange_service_test.dart`

- [ ] **Step 1: Write failing Dart tests**

Tests must prove:

```dart
test('native auth bridge exchanges token and loads consume URL', () async {
  final loginService = FakeNativeSocialLoginService(
    result: const NativeSocialLoginResult(provider: 'kakao', accessToken: 'token-1'),
  );
  final exchangeService = FakeNativeAuthExchangeService(
    consumeUrl: Uri.parse('https://granite.kr/api/auth/native/consume?code=handoff-1'),
  );
  final loader = RecordingUrlLoader();
  final handler = NativeAuthBridgeHandler(
    loginService: loginService,
    exchangeService: exchangeService,
    loadUrl: loader.load,
  );

  await handler.handle(
    const BridgeMessage(
      version: 1,
      id: 'native-login-1',
      type: 'auth.native.login.requested',
      direction: BridgeDirection.webToNative,
      payload: {'provider': 'kakao', 'returnTo': '/me'},
    ),
    RecordingBridgeSender(),
  );

  expect(loginService.requests.single.provider, 'kakao');
  expect(exchangeService.requests.single.accessToken, 'token-1');
  expect(loader.urls.single.toString(), 'https://granite.kr/api/auth/native/consume?code=handoff-1');
});
```

- [ ] **Step 2: Implement provider-agnostic Dart interfaces**

Create:

```dart
class NativeSocialLoginRequest {
  const NativeSocialLoginRequest({required this.provider, this.returnTo});
  final String provider;
  final String? returnTo;
}

class NativeSocialLoginResult {
  const NativeSocialLoginResult({required this.provider, required this.accessToken});
  final String provider;
  final String accessToken;
}

abstract interface class NativeSocialLoginService {
  Future<NativeSocialLoginResult> login(NativeSocialLoginRequest request);
}
```

- [ ] **Step 3: Implement exchange service**

Use `dart:convert` and `package:http/http.dart` only if adding `http` dependency, or use `dart:io` `HttpClient` to avoid dependency. Prefer adding `http` for testability:

```bash
flutter pub add http
```

`NativeAuthExchangeService.exchange` posts to `<web base>/api/auth/native/exchange` and returns consume URL.

- [ ] **Step 4: Implement bridge handler**

Handle only `auth.native.login.requested`, require provider `kakao` or `naver`, call login, call exchange, then `loadUrl(consumeUrl)`. On cancellation do nothing. On failure load `/login?error=native_login_failed` or `/login?error=native_exchange_failed`.

- [ ] **Step 5: Wire handler into WebViewScreen**

Pass a `loadUrl` closure that calls `_controller?.loadRequest(uri)`.

- [ ] **Step 6: Run Flutter focused tests**

```bash
cd /Users/scorchedrice/granite/granite-climbing-app
flutter test test/data/bridge/handlers/native_auth_bridge_handler_test.dart test/features/auth/native_auth_exchange_service_test.dart
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib test pubspec.yaml pubspec.lock
git commit -m "feat(auth): handle native social login bridge"
```

---

### Task 5: Kakao Native SDK Integration

**Files:**
- Modify: `/Users/scorchedrice/granite/granite-climbing-app/pubspec.yaml`
- Modify: `/Users/scorchedrice/granite/granite-climbing-app/lib/main.dart`
- Create: `/Users/scorchedrice/granite/granite-climbing-app/lib/features/auth/kakao_native_login_service.dart`
- Modify: `/Users/scorchedrice/granite/granite-climbing-app/ios/Runner/Info.plist`
- Modify: `/Users/scorchedrice/granite/granite-climbing-app/android/app/src/main/AndroidManifest.xml`
- Test: `/Users/scorchedrice/granite/granite-climbing-app/test/features/auth/kakao_native_login_service_test.dart`

- [ ] **Step 1: Add Kakao dependency**

```bash
cd /Users/scorchedrice/granite/granite-climbing-app
flutter pub add kakao_flutter_sdk_user
```

- [ ] **Step 2: Add app constants**

Add `KAKAO_NATIVE_APP_KEY` as a dart-define backed constant. Do not commit secrets.

- [ ] **Step 3: Initialize Kakao SDK**

In `main.dart`, initialize Kakao SDK before `runApp` when key exists.

- [ ] **Step 4: Implement Kakao login service**

Behavior:

```dart
if (await isKakaoTalkInstalled()) {
  try {
    token = await UserApi.instance.loginWithKakaoTalk();
  } catch (_) {
    token = await UserApi.instance.loginWithKakaoAccount();
  }
} else {
  token = await UserApi.instance.loginWithKakaoAccount();
}
return NativeSocialLoginResult(provider: 'kakao', accessToken: token.accessToken);
```

- [ ] **Step 5: Add native platform config entries**

Use dart-define/env-driven app key in docs and keep Info.plist/Android manifest changes generic. Add required URL query schemes without secrets.

- [ ] **Step 6: Run Flutter verification**

```bash
dart format --set-exit-if-changed lib test
flutter analyze
flutter test
```

- [ ] **Step 7: Commit**

```bash
git add lib test ios android pubspec.yaml pubspec.lock
git commit -m "feat(auth): add kakao native login"
```

---

### Task 6: Naver Platform Channel Skeleton

**Files:**
- Create: `/Users/scorchedrice/granite/granite-climbing-app/lib/features/auth/naver_native_login_service.dart`
- Create: `/Users/scorchedrice/granite/granite-climbing-app/lib/features/auth/native_social_login_channel.dart`
- Modify: `/Users/scorchedrice/granite/granite-climbing-app/ios/Runner/AppDelegate.swift`
- Modify: `/Users/scorchedrice/granite/granite-climbing-app/android/app/src/main/kotlin/com/granite/climbing/MainActivity.kt`
- Test: `/Users/scorchedrice/granite/granite-climbing-app/test/features/auth/naver_native_login_service_test.dart`

- [ ] **Step 1: Add Dart channel tests**

Test that provider `naver` invokes method channel method `loginWithNaver` and returns `NativeSocialLoginResult(provider: 'naver', accessToken: ...)`.

- [ ] **Step 2: Implement Dart MethodChannel wrapper**

Use channel name `com.granite.climbing/native_social_login`.

- [ ] **Step 3: Add native stubs**

Android/iOS native methods should return a structured `not_configured` error until official SDK credentials are configured. This keeps build/test green while making the integration point explicit.

- [ ] **Step 4: Document required Naver console values**

Add a short note to the design doc or app README with:

- Android package/app settings.
- iOS URL scheme.
- Client ID/metadata source.

- [ ] **Step 5: Run app verification**

```bash
dart format --set-exit-if-changed lib test
flutter analyze
flutter test
```

- [ ] **Step 6: Commit**

```bash
git add lib test ios android docs
git commit -m "feat(auth): add naver native login channel"
```

---

### Task 7: End-to-End Verification

**Files:**
- No source changes expected.

- [ ] **Step 1: Run web verification**

```bash
cd /Users/scorchedrice/granite/granite-v2
pnpm typecheck && pnpm test
```

Expected: PASS.

- [ ] **Step 2: Run app verification**

```bash
cd /Users/scorchedrice/granite/granite-climbing-app
dart format --set-exit-if-changed lib test
flutter analyze
flutter test
```

Expected: PASS.

- [ ] **Step 3: Manual simulator check**

Run web on `localhost:3000`, app against `http://localhost:3000/app`, and verify:

- Web browser Kakao/Naver still use web OAuth submit.
- Flutter WebView Kakao emits `auth.native.login.requested`.
- Successful fake/native handoff loads `/api/auth/native/consume`.
- App ends at `/me` for existing user or `/signup` for new user.

- [ ] **Step 4: Final commit if needed**

Only commit verification-related docs or config changes if any were made.

---

## Self-Review

- Spec coverage: web fallback, Flutter-only Kakao/Naver native bridge, server-side token verification, one-time handoff, Apple/Google out of scope, and error handling are mapped to tasks.
- Placeholder scan: Naver full SDK credential wiring depends on external console values, so the plan scopes Task 6 to a buildable platform-channel skeleton with explicit `not_configured` behavior. This is intentional and testable.
- Type consistency: bridge message type is consistently `auth.native.login.requested`; server endpoints are consistently `/api/auth/native/exchange` and `/api/auth/native/consume`.
