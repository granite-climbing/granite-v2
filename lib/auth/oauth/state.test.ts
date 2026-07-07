import { describe, expect, it } from "vitest";
import { createOAuthState, parseOAuthStateCookie } from "./state";

describe("OAuth state cookie", () => {
  it("serializes the provider, nonce, return path, and surface", () => {
    const state = createOAuthState({
      provider: "kakao",
      returnTo: "/me",
      surface: "flutter-webview"
    });

    const parsed = parseOAuthStateCookie(state.cookieValue);

    expect(parsed).toMatchObject({
      provider: "kakao",
      nonce: state.nonce,
      returnTo: "/me",
      state: state.state,
      surface: "flutter-webview"
    });
  });

  it("rejects malformed cookie values", () => {
    expect(() => parseOAuthStateCookie("not-json")).toThrow("Invalid OAuth state cookie");
  });
});
