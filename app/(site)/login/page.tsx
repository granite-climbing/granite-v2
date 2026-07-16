import { startOAuthLoginAction } from "@/lib/actions/oauth-login";
import Link from "next/link";
import {
  getOAuthProvider,
  isOAuthProviderConfigured
} from "@/lib/auth/oauth/providers";
import type { OAuthProviderId } from "@/lib/auth/oauth/types";
import { LoginOAuthDebugConsole } from "./login-oauth-debug-console";
import { LoginProviderForm } from "./login-provider-form";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const returnTo = sanitizeReturnTo(getParam(params.returnTo));
  const error = getParam(params.error);
  const oauthDiagnostic = {
    provider: getParam(params.oauth_provider),
    stage: getParam(params.oauth_stage),
    message: getParam(params.oauth_message)
  };
  const providers = (["apple", "google", "kakao", "naver"] as OAuthProviderId[]).map((id) => {
    const provider = getOAuthProvider(id);
    return {
      ...provider,
      displayLabel: getProviderDisplayLabel(id),
      enabled: isOAuthProviderConfigured(provider)
    };
  });

  return (
    <main data-hide-site-footer className="relative min-h-screen bg-black px-5 text-white">
      <LoginOAuthDebugConsole {...oauthDiagnostic} />
      <Link
        href="/"
        aria-label="로그인 닫기"
        className="absolute left-5 top-5 grid size-10 place-items-center rounded-full text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </svg>
      </Link>
      <section className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col justify-end pb-11 pt-16">
        <div className="flex flex-1 items-center justify-center pb-14">
          <img src="/images/figma/granite-logo.svg" alt="Granite" className="h-auto w-[150px]" />
        </div>

        <div className="space-y-3">
          {providers.map((provider) => (
            <LoginProviderForm
              key={provider.provider}
              provider={provider.provider}
              displayLabel={provider.displayLabel}
              returnTo={returnTo}
              enabled={provider.enabled}
              action={startOAuthLoginAction}
            >
              <ProviderMark provider={provider.provider} />
            </LoginProviderForm>
          ))}
        </div>

        {error ? (
          <p className="mt-4 text-center text-[12px] font-semibold text-[#FF6868]">로그인에 실패했습니다: {error}</p>
        ) : null}
      </section>
    </main>
  );
}

function ProviderMark({ provider }: { provider: OAuthProviderId }) {
  return (
    <img
      src={`/images/figma/icons/icon_${provider}.svg`}
      alt=""
      aria-hidden="true"
      className="h-6 w-6 shrink-0 object-contain"
    />
  );
}

function getProviderDisplayLabel(provider: OAuthProviderId): string {
  if (provider === "kakao") {
    return "카카오";
  }
  if (provider === "naver") {
    return "네이버";
  }
  return getOAuthProvider(provider).label;
}

function getParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function sanitizeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/me";
  }

  return value;
}
