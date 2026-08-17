import { z } from "zod";
import { OAUTH_PROVIDER_IDS, type OAuthProviderId, type OAuthSurface } from "./types";

export const OAUTH_STATE_COOKIE_NAME = "granite_oauth_state";

const oauthStateCookieSchema = z.object({
  provider: z.enum(OAUTH_PROVIDER_IDS),
  nonce: z.string().min(16),
  returnTo: z.string().startsWith("/"),
  state: z.string().min(16),
  surface: z.enum(["web", "flutter-webview", "ios-system-auth"]),
  handoffChallenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
  issuedAt: z.number().int().positive()
});

export type OAuthStateCookie = z.infer<typeof oauthStateCookieSchema>;

export type CreateOAuthStateInput = {
  provider: OAuthProviderId;
  returnTo?: string | null;
  surface?: OAuthSurface | null;
  handoffChallenge?: string | null;
};

export type CreatedOAuthState = OAuthStateCookie & {
  cookieValue: string;
};

export function createOAuthState(input: CreateOAuthStateInput): CreatedOAuthState {
  const payload: OAuthStateCookie = {
    provider: input.provider,
    nonce: crypto.randomUUID(),
    returnTo: sanitizeReturnTo(input.returnTo),
    state: crypto.randomUUID(),
    surface:
      input.surface === "flutter-webview" || input.surface === "ios-system-auth"
        ? input.surface
        : "web",
    ...(input.surface === "ios-system-auth" && input.handoffChallenge
      ? { handoffChallenge: input.handoffChallenge }
      : {}),
    issuedAt: Date.now()
  };

  return {
    ...payload,
    cookieValue: encodeStateCookie(payload)
  };
}

export function parseOAuthStateCookie(cookieValue: string): OAuthStateCookie {
  try {
    const decoded = Buffer.from(cookieValue, "base64url").toString("utf8");
    return oauthStateCookieSchema.parse(JSON.parse(decoded));
  } catch {
    throw new Error("Invalid OAuth state cookie");
  }
}

export function assertOAuthState(callbackState: string | null, cookieValue: string | undefined): OAuthStateCookie {
  if (!callbackState || !cookieValue) {
    throw new Error("Invalid OAuth state");
  }

  const parsed = parseOAuthStateCookie(cookieValue);
  if (parsed.state !== callbackState) {
    throw new Error("Invalid OAuth state");
  }

  return parsed;
}

function encodeStateCookie(payload: OAuthStateCookie): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function sanitizeReturnTo(returnTo: string | null | undefined): string {
  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return "/me";
  }

  return returnTo;
}
