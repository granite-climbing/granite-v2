import { SignJWT, jwtVerify } from "jose";
import { getUserSessionSecret } from "./session";

const APP_WEB_SESSION_HANDOFF_PURPOSE = "app-web-session-handoff";

export type AppWebSessionHandoff = {
  userId: string;
  returnTo: string;
};

export async function createAppWebSessionHandoffToken(handoff: AppWebSessionHandoff): Promise<string> {
  return new SignJWT({
    purpose: APP_WEB_SESSION_HANDOFF_PURPOSE,
    user_id: handoff.userId,
    return_to: sanitizeAppWebSessionReturnTo(handoff.returnTo)
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2m")
    .sign(getUserSessionSecret());
}

export async function verifyAppWebSessionHandoffToken(token: string): Promise<AppWebSessionHandoff | null> {
  try {
    const verified = await jwtVerify(token, getUserSessionSecret());
    const purpose = verified.payload.purpose;
    const userId = verified.payload.user_id;
    const returnTo = verified.payload.return_to;

    if (purpose !== APP_WEB_SESSION_HANDOFF_PURPOSE || typeof userId !== "string") {
      return null;
    }

    return {
      userId,
      returnTo: sanitizeAppWebSessionReturnTo(typeof returnTo === "string" ? returnTo : null)
    };
  } catch {
    return null;
  }
}

export function sanitizeAppWebSessionReturnTo(value: string | null | undefined, fallback = "/me"): string {
  const safeFallback = isSafeAppPath(fallback) ? fallback : "/me";
  if (!isSafeAppPath(value)) {
    return safeFallback;
  }

  return value;
}

function isSafeAppPath(value: string | null | undefined): value is string {
  return Boolean(value?.startsWith("/") && !value.startsWith("//"));
}
