import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureUserForOAuthProfile,
  findActiveUserById,
  findOAuthIdentitiesByUserId,
  findUserByOAuthIdentity
} from "./user-auth-queries";

const queryD1Mock = vi.hoisted(() => vi.fn());
const queryD1FirstMock = vi.hoisted(() => vi.fn());
const executeD1Mock = vi.hoisted(() => vi.fn());
const randomUUIDMock = vi.hoisted(() => vi.fn());

vi.mock("./d1-http", () => ({
  queryD1: queryD1Mock,
  queryD1First: queryD1FirstMock,
  executeD1: executeD1Mock
}));

vi.mock("node:crypto", () => ({
  randomUUID: randomUUIDMock
}));

describe("user auth queries", () => {
  beforeEach(() => {
    queryD1Mock.mockReset();
    queryD1FirstMock.mockReset();
    executeD1Mock.mockReset();
    randomUUIDMock.mockReset();
    randomUUIDMock.mockReturnValue("uuid-1");
  });

  it("finds OAuth identities linked to a user", async () => {
    queryD1Mock.mockResolvedValueOnce([
      {
        id: "oauth_1",
        userId: "user_1",
        provider: "google",
        providerUid: "google-user",
        emailAtLink: "climber@example.com",
        createdAt: "2026-06-04 00:00:00",
        updatedAt: "2026-06-04 00:00:00"
      }
    ]);

    const identities = await findOAuthIdentitiesByUserId("user_1");

    expect(queryD1Mock).toHaveBeenCalledWith(
      expect.stringContaining("FROM user_oauth_identities"),
      ["user_1"]
    );
    expect(identities).toEqual([
      expect.objectContaining({
        provider: "google",
        providerUid: "google-user",
        emailAtLink: "climber@example.com"
      })
    ]);
  });

  it("finds an active user by provider identity", async () => {
    queryD1FirstMock.mockResolvedValueOnce({
      id: "user_1",
      displayName: "Granite Climber",
      email: "climber@example.com",
      avatarUrl: null,
      instagramId: null,
      youtubeId: null,
      deletedAt: null,
      createdAt: "2026-06-04 00:00:00",
      updatedAt: "2026-06-04 00:00:00"
    });

    const user = await findUserByOAuthIdentity("google", "google-user");

    expect(queryD1FirstMock).toHaveBeenCalledWith(expect.stringContaining("JOIN user_oauth_identities"), [
      "google",
      "google-user"
    ]);
    expect(user).toMatchObject({
      id: "user_1",
      displayName: "Granite Climber",
      email: "climber@example.com"
    });
  });

  it("finds an active user by id", async () => {
    queryD1FirstMock.mockResolvedValueOnce({
      id: "user_1",
      displayName: "Granite Climber",
      email: "climber@example.com",
      avatarUrl: null,
      instagramId: null,
      youtubeId: null,
      deletedAt: null,
      createdAt: "2026-06-04 00:00:00",
      updatedAt: "2026-06-04 00:00:00"
    });

    const user = await findActiveUserById("user_1");

    expect(queryD1FirstMock).toHaveBeenCalledWith(expect.stringContaining("WHERE id = ? AND deleted_at IS NULL"), [
      "user_1"
    ]);
    expect(user).toMatchObject({
      id: "user_1",
      displayName: "Granite Climber",
      email: "climber@example.com"
    });
  });

  it("returns the existing user without inserting when identity already exists", async () => {
    queryD1FirstMock.mockResolvedValueOnce({
      id: "user_existing",
      displayName: "Existing Climber",
      email: "existing@example.com",
      avatarUrl: null,
      instagramId: null,
      youtubeId: null,
      deletedAt: null,
      createdAt: "2026-06-04 00:00:00",
      updatedAt: "2026-06-04 00:00:00"
    });

    const user = await ensureUserForOAuthProfile({
      provider: "google",
      providerUserId: "google-user",
      email: "existing@example.com",
      displayName: "Existing Climber",
      avatarUrl: null
    });

    expect(user.id).toBe("user_existing");
    expect(executeD1Mock).not.toHaveBeenCalled();
  });

  it("creates a user and provider identity when no identity exists", async () => {
    queryD1FirstMock.mockResolvedValueOnce(null);
    randomUUIDMock.mockReturnValueOnce("user-uuid").mockReturnValueOnce("identity-uuid");

    const user = await ensureUserForOAuthProfile({
      provider: "kakao",
      providerUserId: "12345",
      email: "kakao@example.com",
      displayName: "Kakao Climber",
      avatarUrl: "https://img.example/kakao.jpg"
    });

    expect(executeD1Mock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("INSERT INTO users"),
      [
        "user_user-uuid",
        "Kakao Climber",
        "kakao@example.com",
        "https://img.example/kakao.jpg"
      ]
    );
    expect(executeD1Mock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO user_oauth_identities"),
      ["oauth_identity-uuid", "user_user-uuid", "kakao", "12345", "kakao@example.com"]
    );
    expect(user).toMatchObject({
      id: "user_user-uuid",
      displayName: "Kakao Climber",
      email: "kakao@example.com"
    });
  });

  it("cleans up a just-created user and returns the linked user when identity creation races", async () => {
    queryD1FirstMock.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "user_existing",
      displayName: "Existing Kakao Climber",
      email: "existing@example.com",
      avatarUrl: null,
      instagramId: null,
      youtubeId: null,
      deletedAt: null,
      createdAt: "2026-06-04 00:00:00",
      updatedAt: "2026-06-04 00:00:00"
    });
    executeD1Mock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("UNIQUE constraint failed"))
      .mockResolvedValueOnce(undefined);
    randomUUIDMock.mockReturnValueOnce("user-uuid").mockReturnValueOnce("identity-uuid");

    const user = await ensureUserForOAuthProfile({
      provider: "kakao",
      providerUserId: "12345",
      email: "kakao@example.com",
      displayName: "Kakao Climber",
      avatarUrl: null
    });

    expect(executeD1Mock).toHaveBeenNthCalledWith(3, expect.stringContaining("DELETE FROM users"), [
      "user_user-uuid"
    ]);
    expect(queryD1FirstMock).toHaveBeenCalledTimes(2);
    expect(user).toMatchObject({
      id: "user_existing",
      displayName: "Existing Kakao Climber"
    });
  });
});
