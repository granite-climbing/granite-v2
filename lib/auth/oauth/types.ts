export const OAUTH_PROVIDER_IDS = ["kakao", "naver", "google", "apple"] as const;

export type OAuthProviderId = (typeof OAUTH_PROVIDER_IDS)[number];

export type OAuthSurface = "web" | "flutter-webview";

export type OAuthProfile = {
  provider: OAuthProviderId;
  providerUserId: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
};

export type OAuthTokenSet = {
  accessToken: string;
  tokenType: string | null;
  expiresIn: number | null;
  refreshToken: string | null;
  idToken: string | null;
  scope: string | null;
};
