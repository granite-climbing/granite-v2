import { describe, expect, it } from "vitest";
import { USER_SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { POST } from "./route";

describe("logout route", () => {
  it("clears the web session cookie", async () => {
    const response = await POST();
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(setCookie).toContain(`${USER_SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain("Max-Age=0");
  });
});
