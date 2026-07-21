import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureUserForOAuthProfile,
  findActiveUserById,
  findLoginCandidateByOAuthIdentity,
  findOAuthIdentitiesByUserId,
  findWithdrawnUserById,
  markUserWithdrawn,
  purgeExpiredWithdrawnUser,
  restoreWithdrawnUser
} from "./user-auth-queries";

const queryD1Mock = vi.hoisted(() => vi.fn());
const queryD1FirstMock = vi.hoisted(() => vi.fn());
const executeD1Mock = vi.hoisted(() => vi.fn());
const executeD1MetaMock = vi.hoisted(() => vi.fn());
const randomUUIDMock = vi.hoisted(() => vi.fn());

vi.mock("./d1-http", () => ({
  queryD1: queryD1Mock,
  queryD1First: queryD1FirstMock,
  executeD1: executeD1Mock,
  executeD1Meta: executeD1MetaMock
}));

vi.mock("node:crypto", () => ({
  randomUUID: randomUUIDMock
}));

describe("user auth queries", () => {
  beforeEach(() => {
    queryD1Mock.mockReset();
    queryD1FirstMock.mockReset();
    executeD1Mock.mockReset();
    executeD1MetaMock.mockReset();
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

    const user = await findLoginCandidateByOAuthIdentity("google", "google-user");

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

  it("활성 사용자 조회는 탈퇴 유예 계정을 제외한다", async () => {
    queryD1FirstMock.mockResolvedValueOnce(null);

    await findActiveUserById("user_1");

    expect(queryD1FirstMock).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = ? AND deleted_at IS NULL AND withdraw_at IS NULL"),
      ["user_1"]
    );
  });

  it("로그인 후보 조회는 탈퇴 계정도 찾아낸다", async () => {
    queryD1FirstMock.mockResolvedValueOnce({
      id: "user_1",
      displayName: "granite",
      withdrawAt: "2026-07-01 00:00:00",
      deletedAt: null
    });

    const user = await findLoginCandidateByOAuthIdentity("google", "google-user");

    const [sql] = queryD1FirstMock.mock.calls[0];
    expect(sql).toContain("u.deleted_at IS NULL");
    expect(sql).not.toContain("withdraw_at IS NULL");
    expect(sql).toContain("u.withdraw_at AS withdrawAt");
    expect(user?.withdrawAt).toBe("2026-07-01 00:00:00");
  });

  it("복구 대상 조회는 탈퇴 신청된 계정만 찾는다", async () => {
    queryD1FirstMock.mockResolvedValueOnce(null);

    await findWithdrawnUserById("user_1");

    expect(queryD1FirstMock).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = ? AND deleted_at IS NULL AND withdraw_at IS NOT NULL"),
      ["user_1"]
    );
  });

  it("탈퇴 처리는 정상 계정만 대상으로 하고 변경 여부를 돌려준다", async () => {
    executeD1MetaMock.mockResolvedValueOnce({ changes: 1 });

    await expect(markUserWithdrawn("user_1")).resolves.toBe(true);

    const [sql, params] = executeD1MetaMock.mock.calls[0];
    expect(sql).toContain("SET withdraw_at = CURRENT_TIMESTAMP");
    expect(sql).toContain("WHERE id = ? AND withdraw_at IS NULL AND deleted_at IS NULL");
    expect(params).toEqual(["user_1"]);
  });

  it("이미 탈퇴한 계정을 다시 탈퇴 처리하면 false", async () => {
    executeD1MetaMock.mockResolvedValueOnce({ changes: 0 });

    await expect(markUserWithdrawn("user_1")).resolves.toBe(false);
  });

  it("복구는 탈퇴 유예 계정만 대상으로 한다", async () => {
    executeD1MetaMock.mockResolvedValueOnce({ changes: 1 });

    await expect(restoreWithdrawnUser("user_1")).resolves.toBe(true);

    const [sql, params] = executeD1MetaMock.mock.calls[0];
    expect(sql).toContain("SET withdraw_at = NULL");
    expect(sql).toContain("WHERE id = ? AND withdraw_at IS NOT NULL AND deleted_at IS NULL");
    expect(params).toEqual(["user_1"]);
  });

  it("경합으로 복구 대상이 사라지면 false", async () => {
    executeD1MetaMock.mockResolvedValueOnce({ changes: 0 });

    await expect(restoreWithdrawnUser("user_1")).resolves.toBe(false);
  });

  it("만료 계정은 deleted_at 을 찍고 OAuth identity 를 끊는다", async () => {
    executeD1MetaMock.mockResolvedValueOnce({ changes: 1 });

    await purgeExpiredWithdrawnUser("user_1");

    const [updateSql, updateParams] = executeD1MetaMock.mock.calls[0];
    expect(updateSql).toContain("SET deleted_at = CURRENT_TIMESTAMP");
    expect(updateParams).toEqual(["user_1"]);
    expect(executeD1Mock).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM user_oauth_identities WHERE user_id = ?"),
      ["user_1"]
    );
  });

  it("이미 삭제된 계정이면 identity 삭제를 건너뛴다", async () => {
    executeD1MetaMock.mockResolvedValueOnce({ changes: 0 });

    await purgeExpiredWithdrawnUser("user_1");

    expect(executeD1Mock).not.toHaveBeenCalled();
  });
});
