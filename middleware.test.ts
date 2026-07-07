import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

describe("middleware", () => {
  it("redirects local loopback requests to localhost so OAuth cookies and callbacks share one origin", () => {
    const request = {
      url: "http://localhost:3000/login?returnTo=/me",
      headers: new Headers({ host: "127.0.0.1:3000" })
    } as NextRequest;

    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?returnTo=/me");
  });

  it("does not redirect localhost requests", () => {
    const request = {
      url: "http://localhost:3000/login?returnTo=/me",
      headers: new Headers({ host: "localhost:3000" })
    } as NextRequest;

    const response = middleware(request);

    expect(response.headers.get("location")).toBeNull();
  });
});
