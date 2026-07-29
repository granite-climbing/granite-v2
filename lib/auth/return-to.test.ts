import { describe, expect, it } from "vitest";
import { sanitizeReturnTo } from "./return-to";

describe("sanitizeReturnTo", () => {
  it("앱 내부 절대 경로는 그대로 통과시킨다", () => {
    expect(sanitizeReturnTo("/me/records")).toBe("/me/records");
    expect(sanitizeReturnTo("/")).toBe("/");
  });

  it("프로토콜 상대 URL 은 외부 호스트로 읽히므로 막는다", () => {
    expect(sanitizeReturnTo("//evil.example.com")).toBe("/me");
    expect(sanitizeReturnTo("//evil.example.com/me")).toBe("/me");
  });

  it("절대 URL 과 상대 경로는 막는다", () => {
    expect(sanitizeReturnTo("https://evil.example.com")).toBe("/me");
    expect(sanitizeReturnTo("me/records")).toBe("/me");
    expect(sanitizeReturnTo("")).toBe("/me");
  });
});
