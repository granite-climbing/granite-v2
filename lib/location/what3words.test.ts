import { describe, expect, it, vi } from "vitest";
import {
  convertW3wToCoordinates,
  normalizeW3wAddress,
  What3WordsConfigError,
  What3WordsInvalidAddressError,
} from "./what3words";

describe("normalizeW3wAddress", () => {
  it("trims whitespace and removes the leading triple slash", () => {
    expect(normalizeW3wAddress("  ///filled.count.soap  ")).toBe("filled.count.soap");
  });

  it("leaves a plain three word address unchanged after trimming", () => {
    expect(normalizeW3wAddress("filled.count.soap")).toBe("filled.count.soap");
  });
});

describe("convertW3wToCoordinates", () => {
  it("throws a config error when the API key is missing", async () => {
    await expect(convertW3wToCoordinates("filled.count.soap", { apiKey: "" })).rejects.toBeInstanceOf(
      What3WordsConfigError,
    );
  });

  it("returns WGS84 coordinates from a successful API response", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          coordinates: { lat: 51.520847, lng: -0.195521 },
          words: "filled.count.soap",
        }),
        { status: 200 },
      );
    });

    await expect(convertW3wToCoordinates("///filled.count.soap", { apiKey: "test-key", fetchImpl })).resolves.toEqual({
      lat: 51.520847,
      lng: -0.195521,
    });

    const url = new URL(fetchImpl.mock.calls[0][0] as string);
    expect(url.origin).toBe("https://api.what3words.com");
    expect(url.pathname).toBe("/v3/convert-to-coordinates");
    expect(url.searchParams.get("words")).toBe("filled.count.soap");
    expect(url.searchParams.get("format")).toBe("json");
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      headers: { "X-Api-Key": "test-key" },
    });
  });

  it("maps BadWords API responses to an invalid address error", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: { code: "BadWords", message: "Invalid or non-existent 3 word address" },
        }),
        { status: 400 },
      );
    });

    await expect(convertW3wToCoordinates("no.address.here", { apiKey: "test-key", fetchImpl })).rejects.toBeInstanceOf(
      What3WordsInvalidAddressError,
    );
  });
});
