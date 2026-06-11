type LogoutOptions = {
  fetch?: typeof fetch;
  navigate?: (url: string) => void;
  returnTo?: string;
};

export type LogoutResult = {
  ok: boolean;
};

export async function logoutFromGranite(options: LogoutOptions = {}): Promise<LogoutResult> {
  const fetchImpl = options.fetch ?? fetch;
  const returnTo = options.returnTo ?? "/me";
  const response = await fetchImpl("/api/auth/logout", {
    method: "POST"
  });
  const result = { ok: response.ok };

  if (result.ok) {
    const navigate = options.navigate ?? navigateInBrowser;
    navigate(returnTo);
  }

  return result;
}

function navigateInBrowser(url: string): void {
  if (typeof window === "undefined") return;

  window.location.assign(url);
}
