"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  buildAuthorizationUrl,
  getOAuthProvider,
  isOAuthProvider,
  isOAuthProviderConfigured
} from "@/lib/auth/oauth/providers";
import { createOAuthState, OAUTH_STATE_COOKIE_NAME } from "@/lib/auth/oauth/state";
import { getOAuthRedirectUri } from "@/lib/auth/oauth/url";

export async function startOAuthLoginAction(formData: FormData): Promise<void> {
  const providerValue = formData.get("provider");
  const provider = typeof providerValue === "string" && isOAuthProvider(providerValue) ? providerValue : null;
  if (!provider) {
    throw new Error("Unsupported OAuth provider");
  }
  if (!isOAuthProviderConfigured(getOAuthProvider(provider))) {
    redirect("/login?error=provider_unavailable");
  }

  const state = createOAuthState({
    provider,
    returnTo: parseReturnTo(formData.get("returnTo"))
  });
  const cookieStore = await cookies();

  cookieStore.set(OAUTH_STATE_COOKIE_NAME, state.cookieValue, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  revalidatePath("/login");
  redirect(
    buildAuthorizationUrl(provider, {
      redirectUri: getOAuthRedirectUri(provider),
      state: state.state,
      nonce: state.nonce
    }).toString()
  );
}

function parseReturnTo(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/me";
  }

  return value;
}
