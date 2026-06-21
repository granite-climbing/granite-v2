import type { OAuthProviderId } from "./types";

type HeaderReader = {
  get(name: string): string | null;
};

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

export function getOAuthRequestOrigin(headers: HeaderReader): string | null {
  const forwardedHost = getFirstHeaderValue(headers.get("x-forwarded-host"));
  const host = forwardedHost ?? headers.get("host");
  if (!host) {
    return null;
  }

  const hostName = getFirstHeaderValue(host);
  if (!hostName) {
    return null;
  }

  const forwardedProto = getFirstHeaderValue(headers.get("x-forwarded-proto"));
  const protocol = forwardedProto ?? getDefaultProtocol(hostName);
  return normalizeOrigin(`${protocol}://${hostName}`);
}

export function resolveAllowedOAuthOrigin(origin: string | null): string | null {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    return null;
  }

  return getAllowedOAuthOrigins().has(normalizedOrigin) ? normalizedOrigin : null;
}

function getAllowedOAuthOrigins(): Set<string> {
  const origins = new Set<string>();
  addOriginList(origins, process.env.OAUTH_ALLOWED_ORIGINS);
  addOrigin(origins, process.env.APP_BASE_URL);

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    addOrigin(origins, `https://${vercelUrl}`);
  }

  addOrigin(origins, "http://localhost:3000");
  return origins;
}

function addOriginList(origins: Set<string>, value: string | undefined): void {
  value
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .forEach((origin) => addOrigin(origins, origin));
}

function addOrigin(origins: Set<string>, value: string | undefined): void {
  const normalized = normalizeOrigin(value ?? null);
  if (normalized) {
    origins.add(normalized);
  }
}

function normalizeOrigin(value: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(stripTrailingSlash(trimmed)).origin;
  } catch {
    return null;
  }
}

function getDefaultProtocol(host: string): "http" | "https" {
  return host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
}

function getFirstHeaderValue(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
