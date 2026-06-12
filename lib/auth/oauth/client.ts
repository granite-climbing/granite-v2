import { z } from "zod";
import { getOAuthClientId, getOAuthClientSecret, getOAuthProvider } from "./providers";
import { normalizeAppleProfileFromIdToken, normalizeOAuthProfile } from "./profile";
import type { OAuthProfile, OAuthProviderId, OAuthTokenSet } from "./types";

type FetchImpl = typeof fetch;

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
};

const tokenResponseSchema = z.object({
  access_token: z.string().optional(),
  token_type: z.string().optional(),
  expires_in: z.coerce.number().optional(),
  refresh_token: z.string().optional(),
  id_token: z.string().optional(),
  scope: z.string().optional()
});

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
    throw new Error(`OAuth token exchange failed: ${response.status}`);
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
    return normalizeAppleProfileFromIdToken(input.idToken);
  }

  if (!provider.userInfoUrl) {
    throw new Error(`OAuth provider ${provider.provider} has no userinfo endpoint`);
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
