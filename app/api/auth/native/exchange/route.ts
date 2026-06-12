import { NextRequest, NextResponse } from "next/server";
import { fetchOAuthProfile } from "@/lib/auth/oauth/client";
import { createNativeAuthHandoffToken } from "@/lib/auth/native-handoff";
import { storeNativeAuthHandoffToken } from "@/lib/db/native-auth-handoffs";
import { findUserByOAuthIdentity } from "@/lib/db/user-auth-queries";

export const runtime = "nodejs";

type NativeExchangeBody = {
  provider?: unknown;
  accessToken?: unknown;
  idToken?: unknown;
  returnTo?: unknown;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await readBody(request);
  const provider = body?.provider;
  const accessToken = typeof body?.accessToken === "string" ? body.accessToken : "";
  const idToken = typeof body?.idToken === "string" ? body.idToken : null;
  const returnTo = sanitizeReturnTo(typeof body?.returnTo === "string" ? body.returnTo : "/me");

  if (!isNativeExchangeProvider(provider)) {
    return NextResponse.json({ error: "unsupported_provider" }, { status: 400 });
  }

  if (!hasProviderToken(provider, accessToken, idToken)) {
    return NextResponse.json({ error: "missing_provider_token" }, { status: 400 });
  }

  try {
    const profile = await fetchOAuthProfile(provider, {
      accessToken,
      idToken
    });
    const user = await findUserByOAuthIdentity(profile.provider, profile.providerUserId);
    const token = await createNativeAuthHandoffToken(
      user
        ? {
            kind: "session",
            userId: user.id,
            returnTo
          }
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
    const handoffCode = await storeNativeAuthHandoffToken(token);

    return NextResponse.json({
      handoffCode,
      returnTo
    });
  } catch (error) {
    console.error("[auth.native.exchange]", {
      provider,
      stage: "profile_or_handoff_failed",
      message: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: "native_profile_failed" }, { status: 401 });
  }
}

async function readBody(request: NextRequest): Promise<NativeExchangeBody | null> {
  try {
    return (await request.json()) as NativeExchangeBody;
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

function isNativeExchangeProvider(value: unknown): value is "kakao" | "naver" | "google" | "apple" {
  return value === "kakao" || value === "naver" || value === "google" || value === "apple";
}

function hasProviderToken(provider: "kakao" | "naver" | "google" | "apple", accessToken: string, idToken: string | null): boolean {
  if (provider === "apple") {
    return Boolean(idToken);
  }

  if (provider === "google") {
    return Boolean(accessToken || idToken);
  }

  return Boolean(accessToken);
}
