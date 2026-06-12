import { NextRequest, NextResponse } from "next/server";
import { fetchOAuthProfile } from "@/lib/auth/oauth/client";
import { createNativeAuthHandoffToken } from "@/lib/auth/native-handoff";
import { storeNativeAuthHandoffToken } from "@/lib/db/native-auth-handoffs";
import { findUserByOAuthIdentity } from "@/lib/db/user-auth-queries";

export const runtime = "nodejs";

type NativeExchangeBody = {
  provider?: unknown;
  accessToken?: unknown;
  returnTo?: unknown;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await readBody(request);
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
    const profile = await fetchOAuthProfile(provider, {
      accessToken,
      idToken: null
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
