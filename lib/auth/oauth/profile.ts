import { decodeJwt } from "jose";
import { z } from "zod";
import type { OAuthProfile, OAuthProviderId } from "./types";

const kakaoProfileSchema = z.object({
  id: z.union([z.string(), z.number()]),
  kakao_account: z
    .object({
      email: z.string().email().optional(),
      profile: z
        .object({
          nickname: z.string().optional(),
          profile_image_url: z.string().url().optional()
        })
        .optional()
    })
    .optional()
});

const naverProfileSchema = z.object({
  response: z.object({
    id: z.string(),
    email: z.string().email().optional(),
    nickname: z.string().optional(),
    name: z.string().optional(),
    profile_image: z.string().url().optional()
  })
});

const googleProfileSchema = z.object({
  sub: z.string(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  picture: z.string().url().optional()
});

const appleClaimsSchema = z.object({
  sub: z.string(),
  email: z.string().email().optional(),
  name: z.string().optional()
});

export function normalizeOAuthProfile(provider: OAuthProviderId, payload: unknown): OAuthProfile {
  if (provider === "kakao") {
    const parsed = kakaoProfileSchema.parse(payload);
    return {
      provider,
      providerUserId: String(parsed.id),
      email: parsed.kakao_account?.email ?? null,
      displayName: parsed.kakao_account?.profile?.nickname ?? "Kakao User",
      avatarUrl: parsed.kakao_account?.profile?.profile_image_url ?? null
    };
  }

  if (provider === "naver") {
    const parsed = naverProfileSchema.parse(payload).response;
    return {
      provider,
      providerUserId: parsed.id,
      email: parsed.email ?? null,
      displayName: parsed.nickname ?? parsed.name ?? "Naver User",
      avatarUrl: parsed.profile_image ?? null
    };
  }

  if (provider === "google") {
    const parsed = googleProfileSchema.parse(payload);
    return {
      provider,
      providerUserId: parsed.sub,
      email: parsed.email ?? null,
      displayName: parsed.name ?? parsed.email ?? "Google User",
      avatarUrl: parsed.picture ?? null
    };
  }

  const parsed = appleClaimsSchema.parse(payload);
  return {
    provider,
    providerUserId: parsed.sub,
    email: parsed.email ?? null,
    displayName: parsed.name ?? parsed.email ?? "Apple User",
    avatarUrl: null
  };
}

export function normalizeGoogleProfileFromIdToken(idToken: string): OAuthProfile {
  return normalizeOAuthProfile("google", decodeJwt(idToken));
}
