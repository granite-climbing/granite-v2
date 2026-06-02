import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/admin", () => ({ requireAdmin: vi.fn().mockResolvedValue({ adminId: "admin_1" }) }));
vi.mock("@/lib/db/admin-queries", () => ({ insertAdminAuditLog: vi.fn() }));
vi.mock("@/lib/db/beta-queries", () => ({ updateBetaStatus: vi.fn(), markWebhookRejected: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const { updateBetaStatus } = await import("@/lib/db/beta-queries");
const { setBetaStatusAction } = await import("./admin-beta");

describe("admin beta actions", () => {
  beforeEach(() => vi.mocked(updateBetaStatus).mockReset());

  it("updates beta moderation status", async () => {
    const form = new FormData();
    form.set("id", "beta_1");
    form.set("status", "approved");
    await setBetaStatusAction(form);
    expect(updateBetaStatus).toHaveBeenCalledWith("beta_1", "approved");
  });
});
