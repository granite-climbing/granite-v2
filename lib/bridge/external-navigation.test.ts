import { describe, expect, it } from "vitest";
import { createExternalNavigationMessage } from "./external-navigation";

describe("createExternalNavigationMessage", () => {
  it("creates the native external-navigation bridge message", () => {
    expect(createExternalNavigationMessage("https://m.smartstore.naver.com/granite_kr")).toEqual({
      version: 1,
      type: "navigation.open.external.requested",
      direction: "web-to-native",
      payload: { url: "https://m.smartstore.naver.com/granite_kr" }
    });
  });
});
