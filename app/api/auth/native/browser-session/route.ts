import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  createNativeBrowserChallenge,
  verifyNativeBrowserHandoff
} from "@/lib/auth/native-browser-handoff";
import {
  createPendingRecoveryToken,
  getPendingRecoveryCookieOptions,
  PENDING_RECOVERY_COOKIE_NAME
} from "@/lib/auth/recovery";
import {
  createPendingSignupToken,
  getPendingSignupCookieOptions,
  PENDING_SIGNUP_COOKIE_NAME
} from "@/lib/auth/signup";
import {
  createUserSessionToken,
  getUserSessionCookieOptions,
  USER_SESSION_COOKIE_NAME
} from "@/lib/auth/session";

export const runtime = "nodejs";

type NativeBrowserSessionBody = {
  handoff?: unknown;
  verifier?: unknown;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await readBody(request);
  const token = typeof body?.handoff === "string" ? body.handoff : "";
  const verifier = typeof body?.verifier === "string" ? body.verifier : "";

  try {
    if (!token || !verifier) {
      throw new Error("Native browser handoff and verifier are required");
    }

    const handoff = await verifyNativeBrowserHandoff(token);
    const actualChallenge = createNativeBrowserChallenge(verifier);
    if (!challengesMatch(handoff.challenge, actualChallenge)) {
      throw new Error("Native browser handoff verifier mismatch");
    }

    if (handoff.kind === "signup") {
      const pendingSignupToken = await createPendingSignupToken({
        provider: handoff.provider,
        providerUserId: handoff.providerUserId,
        email: handoff.email,
        displayName: handoff.displayName,
        avatarUrl: handoff.avatarUrl,
        returnTo: handoff.returnTo
      });
      const response = createNavigationResponse("/signup");
      response.cookies.set(
        PENDING_SIGNUP_COOKIE_NAME,
        pendingSignupToken,
        getPendingSignupCookieOptions()
      );
      return response;
    }

    if (handoff.kind === "recover") {
      const pendingRecoveryToken = await createPendingRecoveryToken({
        userId: handoff.userId,
        returnTo: handoff.returnTo
      });
      const response = createNavigationResponse("/recover");
      response.cookies.set(
        PENDING_RECOVERY_COOKIE_NAME,
        pendingRecoveryToken,
        getPendingRecoveryCookieOptions()
      );
      return response;
    }

    const sessionToken = await createUserSessionToken({ userId: handoff.userId });
    const response = createNavigationResponse(handoff.returnTo);
    response.cookies.set(USER_SESSION_COOKIE_NAME, sessionToken, getUserSessionCookieOptions());
    return response;
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=native_browser_session_failed", request.url),
      303
    );
  }
}

async function readBody(request: NextRequest): Promise<NativeBrowserSessionBody | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return (await request.json()) as NativeBrowserSessionBody;
    } catch {
      return null;
    }
  }

  try {
    const formData = await request.formData();
    return {
      handoff: getFormValue(formData, "handoff"),
      verifier: getFormValue(formData, "verifier")
    };
  } catch {
    return null;
  }
}

function challengesMatch(expected: string, actual: string): boolean {
  const expectedBytes = Buffer.from(expected, "utf8");
  const actualBytes = Buffer.from(actual, "utf8");
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

function createNavigationResponse(path: string): NextResponse {
  const pathJson = JSON.stringify(path);
  return new NextResponse(
    `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex" />
    <script>window.location.replace(${pathJson});</script>
  </head>
  <body></body>
</html>`,
    {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "content-type": "text/html; charset=utf-8"
      }
    }
  );
}

function getFormValue(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}
