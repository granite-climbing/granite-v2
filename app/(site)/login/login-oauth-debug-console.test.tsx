// @vitest-environment jsdom

import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginOAuthDebugConsole } from "./login-oauth-debug-console";

describe("LoginOAuthDebugConsole", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs OAuth diagnostics to the browser console", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <LoginOAuthDebugConsole
        provider="apple"
        stage="token_exchange_failed"
        message="OAuth token exchange failed: 400 - invalid_client"
      />
    );

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith("[auth.oauth.browser]", {
        provider: "apple",
        stage: "token_exchange_failed",
        message: "OAuth token exchange failed: 400 - invalid_client"
      });
    });
  });

  it("stays quiet when no diagnostic message is present", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<LoginOAuthDebugConsole provider={null} stage={null} message={null} />);

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
