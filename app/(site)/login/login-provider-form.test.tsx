// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginProviderForm } from "./login-provider-form";

describe("LoginProviderForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts a native bridge message for Kakao in Flutter WebView", () => {
    const postMessage = vi.fn();
    vi.stubGlobal("FlutterWebView", { postMessage });

    render(
      <LoginProviderForm provider="kakao" displayLabel="카카오" returnTo="/me" enabled action={vi.fn()}>
        icon
      </LoginProviderForm>
    );

    fireEvent.click(screen.getByRole("button", { name: "카카오로 시작하기" }));

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(JSON.parse(postMessage.mock.calls[0][0])).toMatchObject({
      version: 1,
      type: "auth.native.login.requested",
      direction: "web-to-native",
      payload: {
        provider: "kakao",
        returnTo: "/me",
        surface: "flutter-webview"
      }
    });
  });

  it("keeps normal form submit available when no Flutter bridge exists", () => {
    vi.stubGlobal("FlutterWebView", undefined);

    render(
      <LoginProviderForm provider="naver" displayLabel="네이버" returnTo="/me" enabled action={vi.fn()}>
        icon
      </LoginProviderForm>
    );

    expect(screen.getByRole("button", { name: "네이버로 시작하기" })).toHaveAttribute("type", "submit");
    expect(screen.getByDisplayValue("naver")).toHaveAttribute("name", "provider");
    expect(screen.getByDisplayValue("/me")).toHaveAttribute("name", "returnTo");
  });

  it("does not native-bridge Apple and Google", () => {
    const postMessage = vi.fn();
    vi.stubGlobal("FlutterWebView", { postMessage });

    render(
      <LoginProviderForm provider="google" displayLabel="Google" returnTo="/me" enabled action={vi.fn()}>
        icon
      </LoginProviderForm>
    );

    fireEvent.click(screen.getByRole("button", { name: "Google로 시작하기" }));

    expect(postMessage).not.toHaveBeenCalled();
  });
});
