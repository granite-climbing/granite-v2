import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

describe("native Apple callback route", () => {
  it("redirects Apple form_post values back to the Android app intent", async () => {
    const response = await POST(formRequest({
      code: "apple-code",
      id_token: "apple-id-token",
      state: "apple-state"
    }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "intent://callback?code=apple-code&id_token=apple-id-token&state=apple-state#Intent;package=com.granite.climbing;scheme=signinwithapple;end"
    );
  });

  it("redirects Apple query callback values back to the Android app intent", async () => {
    const response = await GET(
      new NextRequest(
        "https://granite.kr/api/auth/native/apple/callback?code=apple-code&id_token=apple-id-token&state=apple-state"
      )
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "intent://callback?code=apple-code&id_token=apple-id-token&state=apple-state#Intent;package=com.granite.climbing;scheme=signinwithapple;end"
    );
  });
});

function formRequest(values: Record<string, string>): NextRequest {
  return new NextRequest("https://granite.kr/api/auth/native/apple/callback", {
    method: "POST",
    body: new URLSearchParams(values),
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    }
  });
}
