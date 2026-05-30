import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { verifyAdminCredentials } from "@/lib/auth/admin-credentials";
import { findActiveAdminByEmail } from "@/lib/db/admin-queries";

vi.mock("@/lib/db/admin-queries", () => ({
  findActiveAdminByEmail: vi.fn(),
}));

const mockedFindAdmin = vi.mocked(findActiveAdminByEmail);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin auth", () => {
  it("rejects unknown email", async () => {
    mockedFindAdmin.mockResolvedValue(null);

    await expect(
      verifyAdminCredentials({ email: "missing@granite.kr", password: "secret123" }),
    ).rejects.toThrow("Invalid admin credentials");
  });

  it("rejects invalid password", async () => {
    mockedFindAdmin.mockResolvedValue({
      id: "admin_1",
      email: "ops@granite.kr",
      passwordHash: await bcrypt.hash("correct-password", 4),
      displayName: "Ops",
      isActive: true,
    });

    await expect(
      verifyAdminCredentials({ email: "ops@granite.kr", password: "wrong-password" }),
    ).rejects.toThrow("Invalid admin credentials");
  });

  it("returns token session data for valid credentials", async () => {
    mockedFindAdmin.mockResolvedValue({
      id: "admin_1",
      email: "ops@granite.kr",
      passwordHash: await bcrypt.hash("correct-password", 4),
      displayName: "Ops",
      isActive: true,
    });

    const result = await verifyAdminCredentials({
      email: "ops@granite.kr",
      password: "correct-password",
    });

    expect(result.email).toBe("ops@granite.kr");
    expect(result.displayName).toBe("Ops");
    expect(result.token).toEqual(expect.any(String));
  });
});
