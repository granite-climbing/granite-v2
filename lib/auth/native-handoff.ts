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
    const returnTo =
      typeof verified.payload.return_to === "string"
        ? sanitizeReturnTo(verified.payload.return_to)
        : "/me";

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
