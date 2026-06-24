import type { OAuthProviderId } from "./types";

export function getAppBaseUrl(): string {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) {
    return stripTrailingSlash(configured);
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${stripTrailingSlash(vercelUrl)}`;
  }

  return "http://localhost:3000";
}

export function getOAuthRedirectUri(provider: OAuthProviderId, origin = getAppBaseUrl()): string {
  return `${stripTrailingSlash(origin)}/api/auth/callback/${provider}`;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
