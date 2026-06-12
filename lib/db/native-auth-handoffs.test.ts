import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  consumeNativeAuthHandoffToken,
  storeNativeAuthHandoffToken
} from "./native-auth-handoffs";

const executeD1Mock = vi.hoisted(() => vi.fn());
const executeD1MetaMock = vi.hoisted(() => vi.fn());
const queryD1FirstMock = vi.hoisted(() => vi.fn());
const randomUUIDMock = vi.hoisted(() => vi.fn());

vi.mock("./d1-http", () => ({
  executeD1: executeD1Mock,
  executeD1Meta: executeD1MetaMock,
  queryD1First: queryD1FirstMock
}));

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    randomUUID: randomUUIDMock
  };
});

describe("native auth handoff persistence", () => {
  beforeEach(() => {
    executeD1Mock.mockReset();
    executeD1MetaMock.mockReset();
    queryD1FirstMock.mockReset();
    randomUUIDMock.mockReset();
  });

  it("stores a signed handoff token behind an opaque one-time code", async () => {
    randomUUIDMock.mockReturnValueOnce("row-uuid").mockReturnValueOnce("code-uuid");

    const code = await storeNativeAuthHandoffToken("signed-token", {
      now: () => new Date("2026-06-12T09:00:00.000Z"),
      ttlSeconds: 300
    });

    expect(code).toBe("code-uuid");
    expect(executeD1Mock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO native_auth_handoffs"),
      [
        "native_handoff_row-uuid",
        expect.stringMatching(/^[a-f0-9]{64}$/),
        "signed-token",
        "2026-06-12T09:05:00.000Z"
      ]
    );
  });

  it("consumes an unexpired handoff code exactly once", async () => {
    queryD1FirstMock.mockResolvedValueOnce({
      id: "native_handoff_1",
      token: "signed-token"
    });
    executeD1MetaMock.mockResolvedValueOnce({ changes: 1 });

    const token = await consumeNativeAuthHandoffToken("code-uuid");

    expect(token).toBe("signed-token");
    expect(queryD1FirstMock).toHaveBeenCalledWith(
      expect.stringContaining("FROM native_auth_handoffs"),
      [expect.stringMatching(/^[a-f0-9]{64}$/)]
    );
    expect(executeD1MetaMock).toHaveBeenCalledWith(
      expect.stringContaining("consumed_at IS NULL"),
      ["native_handoff_1"]
    );
  });

  it("returns null when the code is missing or expired", async () => {
    queryD1FirstMock.mockResolvedValueOnce(null);

    const token = await consumeNativeAuthHandoffToken("missing-code");

    expect(token).toBeNull();
    expect(executeD1MetaMock).not.toHaveBeenCalled();
  });

  it("returns null when another request already consumed the row", async () => {
    queryD1FirstMock.mockResolvedValueOnce({
      id: "native_handoff_1",
      token: "signed-token"
    });
    executeD1MetaMock.mockResolvedValueOnce({ changes: 0 });

    const token = await consumeNativeAuthHandoffToken("code-uuid");

    expect(token).toBeNull();
  });
});
