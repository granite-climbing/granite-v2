"use client";

import React, { useEffect, useRef, useState } from "react";
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
    GraniteBridge?: {
      receive?: (message: NativeBridgeMessage) => void;
    };
  }
}

type NativeBridgeMessage = {
  version?: number;
  id?: string;
  type?: string;
  direction?: string;
  payload?: { reason?: string };
};

const nativeLoginListeners = new Set<(message: NativeBridgeMessage) => void>();
let nativeBridgeInstalled = false;

function subscribeToNativeLogin(listener: (message: NativeBridgeMessage) => void) {
  nativeLoginListeners.add(listener);

  if (!nativeBridgeInstalled) {
    nativeBridgeInstalled = true;
    window.GraniteBridge ??= {};
    const previousReceive = window.GraniteBridge.receive;
    window.GraniteBridge.receive = (message) => {
      previousReceive?.(message);
      nativeLoginListeners.forEach((registeredListener) => registeredListener(message));
    };
  }

  return () => {
    nativeLoginListeners.delete(listener);
  };
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
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const pendingRequestIdRef = useRef<string | null>(null);

  useEffect(() => {
    return subscribeToNativeLogin((message) => {
      if (message.type !== "auth.native.login.failed" || message.id !== pendingRequestIdRef.current) {
        return;
      }

      pendingRequestIdRef.current = null;
      setPendingRequestId(null);
      setStatusMessage(
        message.payload?.reason === "cancelled"
          ? "로그인이 취소되었습니다."
          : "로그인에 실패했습니다. 다시 시도해주세요."
      );
    });
  }, []);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        const bridge = getFlutterWebViewBridge();

        if (!enabled || !nativeBridgeProvider || !bridge) {
          return;
        }

        event.preventDefault();
        const id = `native-login-${Date.now()}`;
        pendingRequestIdRef.current = id;
        setPendingRequestId(id);
        setStatusMessage(null);
        bridge.postMessage(
          JSON.stringify({
            version: 1,
            id,
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
        disabled={!enabled || pendingRequestId !== null}
        aria-disabled={!enabled || pendingRequestId !== null}
        className={`flex h-[54px] w-full items-center justify-center gap-3 rounded-[27px] text-[14px] font-bold transition ${
          provider === "kakao"
            ? "bg-[#FFE100] text-black"
            : provider === "naver"
              ? "bg-[#5CC968] text-white"
              : "bg-white text-black"
        } ${enabled ? "" : "cursor-not-allowed"}`}
      >
        <span aria-hidden="true" className="contents">
          {pendingRequestId ? <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : children}
        </span>
        <span>{pendingRequestId ? "로그인 중..." : `${displayLabel}로 시작하기`}</span>
      </button>
      {statusMessage ? <p role="alert" className="mt-2 text-center text-[12px] font-semibold text-[#FF6868]">{statusMessage}</p> : null}
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
