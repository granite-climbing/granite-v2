"use client";

import React from "react";
import type { ReactNode } from "react";
import type { OAuthProviderId } from "@/lib/auth/oauth/types";

type LoginProviderFormProps = {
  provider: OAuthProviderId;
  displayLabel: string;
  returnTo: string;
  enabled: boolean;
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
};

declare global {
  interface Window {
    FlutterWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

export function LoginProviderForm({
  provider,
  displayLabel,
  returnTo,
  enabled,
  action,
  children
}: LoginProviderFormProps) {
  const nativeBridgeProvider = provider === "kakao" || provider === "naver" || provider === "google" || provider === "apple";

  return (
    <form
      action={action}
      onSubmit={(event) => {
        const bridge = getFlutterWebViewBridge();

        if (!enabled || !nativeBridgeProvider || !bridge) {
          return;
        }

        event.preventDefault();
        bridge.postMessage(
          JSON.stringify({
            version: 1,
            id: `native-login-${Date.now()}`,
            type: "auth.native.login.requested",
            direction: "web-to-native",
            payload: {
              provider,
              returnTo,
              surface: "flutter-webview"
            }
          })
        );
      }}
    >
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        disabled={!enabled}
        aria-disabled={!enabled}
        className={`flex h-[54px] w-full items-center justify-center gap-3 rounded-[27px] text-[14px] font-bold transition ${
          provider === "kakao"
            ? "bg-[#FFE100] text-black"
            : provider === "naver"
              ? "bg-[#5CC968] text-white"
              : "bg-white text-black"
        } ${enabled ? "" : "cursor-not-allowed"}`}
      >
        <span aria-hidden="true" className="contents">
          {children}
        </span>
        <span>{displayLabel}로 시작하기</span>
      </button>
    </form>
  );
}

function getFlutterWebViewBridge() {
  if (typeof window === "undefined") {
    return null;
  }

  const bridge = window.FlutterWebView;

  if (!bridge || typeof bridge.postMessage !== "function") {
    return null;
  }

  return bridge;
}
