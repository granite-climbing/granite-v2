import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/location/what3words", async () => {
  const actual = await vi.importActual<typeof import("@/lib/location/what3words")>("@/lib/location/what3words");
  return {
    ...actual,
    convertW3wToCoordinates: vi.fn(),
  };
});

import { requireAdmin } from "@/lib/auth/admin";
import { convertW3wToCoordinates, What3WordsInvalidAddressError } from "@/lib/location/what3words";
import { convertW3wToCoordinatesAction } from "./admin-location";

const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedConvertW3wToCoordinates = vi.mocked(convertW3wToCoordinates);

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequireAdmin.mockResolvedValue({ adminId: "admin_1", email: "admin@granite.kr", displayName: "Admin" });
});

describe("convertW3wToCoordinatesAction", () => {
  it("requires an admin session before converting", async () => {
    mockedConvertW3wToCoordinates.mockResolvedValue({ lat: 37.42, lng: 126.92 });

    await convertW3wToCoordinatesAction({ words: "///filled.count.soap" });

    expect(mockedRequireAdmin).toHaveBeenCalledOnce();
  });

  it("returns converted coordinates on success", async () => {
    mockedConvertW3wToCoordinates.mockResolvedValue({ lat: 37.42, lng: 126.92 });

    await expect(convertW3wToCoordinatesAction({ words: "///filled.count.soap" })).resolves.toEqual({
      ok: true,
      lat: 37.42,
      lng: 126.92,
    });
  });

  it("returns a validation message for empty input", async () => {
    await expect(convertW3wToCoordinatesAction({ words: "" })).resolves.toEqual({
      ok: false,
      message: "Enter a what3words address.",
    });
    expect(mockedConvertW3wToCoordinates).not.toHaveBeenCalled();
  });

  it("returns a stable message when what3words rejects the address", async () => {
    mockedConvertW3wToCoordinates.mockRejectedValue(new What3WordsInvalidAddressError());

    await expect(convertW3wToCoordinatesAction({ words: "no.address.here" })).resolves.toEqual({
      ok: false,
      message: "Invalid what3words address.",
    });
  });
});
