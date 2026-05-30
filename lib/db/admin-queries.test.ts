import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findActiveAdminByEmail,
  findActiveAdminById,
  insertAdminAuditLog,
} from "./admin-queries";
import { executeD1, queryD1First } from "./d1-http";

vi.mock("./d1-http", () => ({
  queryD1First: vi.fn(),
  executeD1: vi.fn(),
}));

const mockedQueryFirst = vi.mocked(queryD1First);
const mockedExecute = vi.mocked(executeD1);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin queries", () => {
  it("finds an active admin by lowercased email", async () => {
    mockedQueryFirst.mockResolvedValue({
      id: "admin_1",
      email: "ops@granite.kr",
      passwordHash: "$2a$hash",
      displayName: "Ops",
      isActive: 1,
    });

    const result = await findActiveAdminByEmail(" Ops@Granite.kr ");

    expect(result).toEqual({
      id: "admin_1",
      email: "ops@granite.kr",
      passwordHash: "$2a$hash",
      displayName: "Ops",
      isActive: true,
    });
    expect(mockedQueryFirst).toHaveBeenCalledWith(
      expect.stringContaining("WHERE lower(email) = lower(?)"),
      ["ops@granite.kr"],
    );
  });

  it("returns null for inactive admin rows", async () => {
    mockedQueryFirst.mockResolvedValue(null);
    await expect(findActiveAdminById("admin_1")).resolves.toBeNull();
  });

  it("inserts audit logs as JSON metadata", async () => {
    await insertAdminAuditLog({
      adminId: "admin_1",
      action: "content.update",
      targetType: "crag",
      targetId: "crag_anyang",
      metadata: { fields: ["name"] },
    });

    expect(mockedExecute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO admin_audit_logs"),
      expect.arrayContaining([
        "admin_1",
        "content.update",
        "crag",
        "crag_anyang",
        JSON.stringify({ fields: ["name"] }),
      ]),
    );
  });
});
