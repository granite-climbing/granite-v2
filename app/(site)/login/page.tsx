import { startOAuthLoginAction } from "@/lib/actions/oauth-login";
import {
  getOAuthProvider,
  isOAuthProviderConfigured
} from "@/lib/auth/oauth/providers";
import type { OAuthProviderId } from "@/lib/auth/oauth/types";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const returnTo = sanitizeReturnTo(getParam(params.returnTo));
  const error = getParam(params.error);
  const providers = (["apple", "google", "kakao", "naver"] as OAuthProviderId[]).map((id) => {
    const provider = getOAuthProvider(id);
    return {
      ...provider,
      displayLabel: getProviderDisplayLabel(id),
      enabled: isOAuthProviderConfigured(provider)
    };
  });

  return (
    <main className="min-h-screen bg-black px-5 text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col justify-end pb-11 pt-16">
        <div className="flex flex-1 items-center justify-center pb-14">
          <img src="/images/figma/granite-logo.svg" alt="Granite" className="h-auto w-[150px]" />
        </div>

        <div className="space-y-3">
          {providers.map((provider) => (
            <form key={provider.provider} action={startOAuthLoginAction}>
              <input type="hidden" name="provider" value={provider.provider} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button
                type="submit"
                disabled={!provider.enabled}
                aria-disabled={!provider.enabled}
                className={`flex h-[54px] w-full items-center justify-center gap-3 rounded-[27px] text-[14px] font-bold transition ${
                  provider.provider === "kakao"
                    ? "bg-[#FFE100] text-black"
                    : provider.provider === "naver"
                      ? "bg-[#5CC968] text-white"
                      : "bg-white text-black"
                } ${provider.enabled ? "" : "cursor-not-allowed opacity-45"}`}
              >
                <ProviderMark provider={provider.provider} />
                <span>{provider.displayLabel}로 시작하기</span>
              </button>
            </form>
          ))}
        </div>

        {error ? (
          <p className="mt-4 text-center text-[12px] font-semibold text-[#FF6868]">로그인에 실패했습니다: {error}</p>
        ) : null}

        <button type="button" disabled className="mx-auto mt-6 block text-[14px] font-semibold text-[#A7A7A7]">
          이메일로 시작하기
        </button>

        <p className="mt-8 text-center text-[11px] font-medium leading-5 text-[#666]">
          <a href="/terms" className="underline underline-offset-2">이용약관</a>
          <span className="px-1">·</span>
          <a href="/privacy" className="underline underline-offset-2">개인정보처리방침</a>
        </p>
      </section>
    </main>
  );
}

function ProviderMark({ provider }: { provider: OAuthProviderId }) {
  if (provider === "apple") {
    return <span className="text-[24px] leading-none"></span>;
  }
  if (provider === "google") {
    return <span className="text-[26px] font-black leading-none">G</span>;
  }
  if (provider === "kakao") {
    return (
      <span className="rounded-full bg-[#181600] px-[5px] py-[2px] text-[8px] font-black leading-none text-[#FFE100]">
        TALK
      </span>
    );
  }
  return <span className="text-[28px] font-black leading-none">N</span>;
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
