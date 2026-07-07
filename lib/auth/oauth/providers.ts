import { SignJWT, importPKCS8 } from "jose";
import { OAUTH_PROVIDER_IDS, type OAuthProviderId } from "./types";

export type OAuthProviderConfig = {
  provider: OAuthProviderId;
  label: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string | null;
  clientIdEnv: string;
  clientIdFallbackEnv?: string;
  clientSecretEnv: string | null;
  scopes: string[];
  responseMode?: "query" | "form_post";
};

export type BuildAuthorizationUrlInput = {
  redirectUri: string;
  state: string;
  nonce: string;
};

const PROVIDERS: Record<OAuthProviderId, OAuthProviderConfig> = {
  kakao: {
    provider: "kakao",
    label: "Kakao",
    authorizationUrl: "https://kauth.kakao.com/oauth/authorize",
    tokenUrl: "https://kauth.kakao.com/oauth/token",
    userInfoUrl: "https://kapi.kakao.com/v2/user/me",
    clientIdEnv: "KAKAO_OAUTH_CLIENT_ID",
    clientSecretEnv: "KAKAO_OAUTH_CLIENT_SECRET",
    scopes: []
  },
  naver: {
    provider: "naver",
    label: "Naver",
    authorizationUrl: "https://nid.naver.com/oauth2.0/authorize",
    tokenUrl: "https://nid.naver.com/oauth2.0/token",
    userInfoUrl: "https://openapi.naver.com/v1/nid/me",
    clientIdEnv: "NAVER_OAUTH_CLIENT_ID",
    clientSecretEnv: "NAVER_OAUTH_CLIENT_SECRET",
    scopes: []
  },
  google: {
    provider: "google",
    label: "Google",
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID",
    clientSecretEnv: "GOOGLE_OAUTH_CLIENT_SECRET",
    scopes: ["openid"]
  },
  apple: {
    provider: "apple",
    label: "Apple",
    authorizationUrl: "https://appleid.apple.com/auth/authorize",
    tokenUrl: "https://appleid.apple.com/auth/token",
    userInfoUrl: null,
    clientIdEnv: "APPLE_WEB_CLIENT_ID",
    clientIdFallbackEnv: "APPLE_CLIENT_ID",
    clientSecretEnv: "APPLE_CLIENT_SECRET",
    scopes: [],
    responseMode: "form_post"
  }
};

export function isOAuthProvider(value: string): value is OAuthProviderId {
  return OAUTH_PROVIDER_IDS.includes(value as OAuthProviderId);
}

export function listOAuthProviders(): OAuthProviderConfig[] {
  return OAUTH_PROVIDER_IDS.map((provider) => PROVIDERS[provider]);
}

export function getOAuthProvider(provider: OAuthProviderId): OAuthProviderConfig {
  return PROVIDERS[provider];
}

export function getOAuthClientId(provider: OAuthProviderConfig): string {
  const clientId = process.env[provider.clientIdEnv] ?? "";
  if (clientId || !provider.clientIdFallbackEnv) {
    return clientId;
  }

  return process.env[provider.clientIdFallbackEnv] ?? "";
}

export function getAppleAllowedClientIds(): string[] {
  return Array.from(
    new Set([
      getOAuthClientId(PROVIDERS.apple),
      process.env.APPLE_IOS_CLIENT_ID ?? "",
      process.env.APPLE_CLIENT_ID ?? ""
    ].filter(Boolean))
  );
}

export function isOAuthProviderConfigured(provider: OAuthProviderConfig): boolean {
  if (!getOAuthClientId(provider)) {
    return false;
  }

  if (!provider.clientSecretEnv) {
    return true;
  }

  if (process.env[provider.clientSecretEnv]) {
    return true;
  }

  if (provider.provider !== "apple") {
    return false;
  }

  return Boolean(process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY);
}

export async function getOAuthClientSecret(provider: OAuthProviderConfig): Promise<string> {
  const configuredSecret = provider.clientSecretEnv ? process.env[provider.clientSecretEnv] ?? "" : "";
  if (configuredSecret) {
    return configuredSecret;
  }

  if (provider.provider !== "apple") {
    return "";
  }

  const clientId = getOAuthClientId(provider);
  const keyId = process.env.APPLE_KEY_ID ?? "";
  const privateKey = process.env.APPLE_PRIVATE_KEY?.replaceAll("\\n", "\n") ?? "";
  const teamId = process.env.APPLE_TEAM_ID ?? "";
  if (!clientId || !keyId || !privateKey || !teamId) {
    return "";
  }

  const signingKey = await importPKCS8(privateKey, "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuedAt()
    .setExpirationTime("180d")
    .setIssuer(teamId)
    .setAudience("https://appleid.apple.com")
    .setSubject(clientId)
    .sign(signingKey);
}

export function buildAuthorizationUrl(providerId: OAuthProviderId, input: BuildAuthorizationUrlInput): URL {
  const provider = getOAuthProvider(providerId);
  const url = new URL(provider.authorizationUrl);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", getOAuthClientId(provider));
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);

  if (provider.scopes.length > 0) {
    url.searchParams.set("scope", provider.scopes.join(" "));
  }

  if (provider.provider === "google" || provider.provider === "apple") {
    url.searchParams.set("nonce", input.nonce);
  }

  if (provider.responseMode) {
    url.searchParams.set("response_mode", provider.responseMode);
  }

  return url;
}
