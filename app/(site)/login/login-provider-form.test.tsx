// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginProviderForm } from "./login-provider-form";

describe("LoginProviderForm", () => {
  afterEach(() => {
    vi.useRealTimers();
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
        surface: "flutter-webview",
        loginMode: "account"
      }
    });
  });

  it("logs that Naver takes the native SDK route in Flutter WebView", () => {
    const postMessage = vi.fn();
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.stubGlobal("FlutterWebView", { postMessage });

    render(
      <LoginProviderForm provider="naver" displayLabel="네이버" returnTo="/me" enabled action={vi.fn()}>
        icon
      </LoginProviderForm>
    );

    fireEvent.click(screen.getByRole("button", { name: "네이버로 시작하기" }));

    expect(info).toHaveBeenCalledWith(
      "[granite login] provider=naver route=native-sdk bridge_request"
    );
  });

  it("shows a failure message when native login reports an error", () => {
    const postMessage = vi.fn();
    vi.stubGlobal("FlutterWebView", { postMessage });

    render(
      <LoginProviderForm provider="naver" displayLabel="네이버" returnTo="/me" enabled action={vi.fn()}>
        icon
      </LoginProviderForm>
    );

    fireEvent.click(screen.getByRole("button", { name: "네이버로 시작하기" }));
    const request = JSON.parse(postMessage.mock.calls[0][0]);

    expect(screen.getByRole("button", { name: "로그인 중..." })).toBeDisabled();
    act(() => {
      const receive = window.GraniteBridge?.receive;
      if (!receive) throw new Error("GraniteBridge receiver was not installed");
      receive({
        version: 1,
        id: request.id,
        type: "auth.native.login.failed",
        direction: "native-to-web",
        payload: { reason: "failed" }
      });
    });

    expect(screen.getByRole("alert")).toHaveTextContent("로그인에 실패했습니다");
  });

  it("keeps native login pending while the provider login screen is open", () => {
    vi.useFakeTimers();
    const postMessage = vi.fn();
    vi.stubGlobal("FlutterWebView", { postMessage });

    render(
      <LoginProviderForm provider="naver" displayLabel="네이버" returnTo="/me" enabled action={vi.fn()}>
        icon
      </LoginProviderForm>
    );

    fireEvent.click(screen.getByRole("button", { name: "네이버로 시작하기" }));
    act(() => vi.advanceTimersByTime(12000));

    expect(screen.getByRole("button", { name: "로그인 중..." })).toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("logs a web OAuth fallback when Naver has no Flutter bridge", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.stubGlobal("FlutterWebView", undefined);

    render(
      <LoginProviderForm provider="naver" displayLabel="네이버" returnTo="/me" enabled action={vi.fn()}>
        icon
      </LoginProviderForm>
    );

    const form = screen.getByRole("button", { name: "네이버로 시작하기" }).closest("form");
    if (!form) throw new Error("Naver login form was not rendered");
    fireEvent.submit(form);

    expect(info).toHaveBeenCalledWith(
      "[granite login] provider=naver route=web-oauth-fallback reason=flutter_bridge_unavailable"
    );
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

  it.each([
    ["apple", "Apple"],
    ["google", "Google"],
    ["naver", "네이버"]
  ] as const)("posts a native bridge message for %s in Flutter WebView", (provider, displayLabel) => {
    const postMessage = vi.fn();
    vi.stubGlobal("FlutterWebView", { postMessage });

    render(
      <LoginProviderForm provider={provider} displayLabel={displayLabel} returnTo="/me" enabled action={vi.fn()}>
        icon
      </LoginProviderForm>
    );

    fireEvent.click(screen.getByRole("button", { name: `${displayLabel}로 시작하기` }));

    expect(postMessage).toHaveBeenCalledTimes(1);
    const request = JSON.parse(postMessage.mock.calls[0][0]);

    expect(request).toMatchObject({
      type: "auth.native.login.requested",
      direction: "web-to-native",
      payload: {
        provider,
        returnTo: "/me",
        surface: "flutter-webview"
      }
    });
    expect(request.payload).not.toHaveProperty("loginMode");
  });
});
