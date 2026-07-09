import { z } from "zod";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { getAppleAllowedClientIds, getOAuthClientId, getOAuthClientSecret, getOAuthProvider } from "./providers";
import { normalizeGoogleProfileFromIdToken, normalizeOAuthProfile } from "./profile";
import type { OAuthProfile, OAuthProviderId, OAuthTokenSet } from "./types";

type FetchImpl = typeof fetch;
type AppleVerifyKey = JWTVerifyGetKey;

export type ExchangeOAuthCodeInput = {
  code: string;
  redirectUri: string;
  state?: string;
  fetchImpl?: FetchImpl;
};

export type FetchOAuthProfileInput = {
  accessToken: string;
  idToken: string | null;
  fetchImpl?: FetchImpl;
  appleVerifyKey?: AppleVerifyKey;
};

const tokenResponseSchema = z.object({
  access_token: z.string().optional(),
  token_type: z.string().optional(),
  expires_in: z.coerce.number().optional(),
  refresh_token: z.string().optional(),
  id_token: z.string().optional(),
  scope: z.string().optional()
});

const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

export async function exchangeOAuthCode(
  providerId: OAuthProviderId,
  input: ExchangeOAuthCodeInput
): Promise<OAuthTokenSet> {
  const provider = getOAuthProvider(providerId);
  const clientId = getOAuthClientId(provider);
  const clientSecret = await getOAuthClientSecret(provider);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    client_id: clientId,
    redirect_uri: input.redirectUri
  });

  if (clientSecret) {
    body.set("client_secret", clientSecret);
  }

  if (provider.provider === "naver" && input.state) {
    body.set("state", input.state);
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(provider.tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    const errorDetail = await readOAuthErrorDetail(response);
    console.error("[auth.oauth.token]", {
      provider: provider.provider,
      status: response.status,
      error: errorDetail.error,
      errorDescription: errorDetail.errorDescription
    });
    throw new Error(formatOAuthTokenError(response.status, errorDetail));
  }

  const parsed = tokenResponseSchema.parse(await response.json());
  if (!parsed.access_token && !parsed.id_token) {
    throw new Error("OAuth token exchange returned no usable token");
  }

  return {
    accessToken: parsed.access_token ?? "",
    tokenType: parsed.token_type ?? null,
    expiresIn: parsed.expires_in ?? null,
    refreshToken: parsed.refresh_token ?? null,
    idToken: parsed.id_token ?? null,
    scope: parsed.scope ?? null
  };
}

export async function fetchOAuthProfile(
  providerId: OAuthProviderId,
  input: FetchOAuthProfileInput
): Promise<OAuthProfile> {
  const provider = getOAuthProvider(providerId);

  if (provider.provider === "apple") {
    if (!input.idToken) {
      throw new Error("Apple OAuth response did not include id_token");
    }
    return fetchAppleProfileFromIdToken(input.idToken, input.appleVerifyKey ?? appleJwks);
  }

  if (!provider.userInfoUrl) {
    throw new Error(`OAuth provider ${provider.provider} has no userinfo endpoint`);
  }

  if (provider.provider === "google" && !input.accessToken && input.idToken) {
    return normalizeGoogleProfileFromIdToken(input.idToken);
  }

  if (!input.accessToken) {
    throw new Error(`OAuth provider ${provider.provider} response did not include access_token`);
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(provider.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${input.accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`OAuth profile fetch failed: ${response.status}`);
  }

  return normalizeOAuthProfile(provider.provider, await response.json());
}

type OAuthErrorDetail = {
  error: string | null;
  errorDescription: string | null;
};

async function readOAuthErrorDetail(response: Response): Promise<OAuthErrorDetail> {
  const text = await response.text();
  if (!text) {
    return { error: null, errorDescription: null };
  }

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return {
      error: typeof parsed.error === "string" ? parsed.error : null,
      errorDescription: typeof parsed.error_description === "string" ? parsed.error_description : null
    };
  } catch {
    return { error: "unparseable_error_response", errorDescription: text.slice(0, 300) };
  }
}

function formatOAuthTokenError(status: number, detail: OAuthErrorDetail): string {
  const parts = [`OAuth token exchange failed: ${status}`];
  if (detail.error) {
    parts.push(detail.error);
  }
  if (detail.errorDescription) {
    parts.push(detail.errorDescription);
  }

  return parts.join(" - ");
}

async function fetchAppleProfileFromIdToken(
  idToken: string,
  verifyKey: AppleVerifyKey
): Promise<OAuthProfile> {
  const allowedAudiences = getAppleAllowedClientIds();
  if (allowedAudiences.length === 0) {
    throw new Error("Apple OAuth audience is not configured");
  }

  const verified = await jwtVerify(idToken, verifyKey, {
    issuer: "https://appleid.apple.com",
    audience: allowedAudiences
  });

  return normalizeOAuthProfile("apple", verified.payload);
}
