"use client";

import { useEffect } from "react";

type LoginOAuthDebugConsoleProps = {
  provider: string | null;
  stage: string | null;
  message: string | null;
};

export function LoginOAuthDebugConsole({ provider, stage, message }: LoginOAuthDebugConsoleProps) {
  useEffect(() => {
    if (!message) {
      return;
    }

    console.error("[auth.oauth.browser]", {
      provider,
      stage,
      message
    });
  }, [provider, stage, message]);

  return null;
}
