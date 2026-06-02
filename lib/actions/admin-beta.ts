"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { insertAdminAuditLog } from "@/lib/db/admin-queries";
import { markWebhookRejected, updateBetaStatus } from "@/lib/db/beta-queries";

const betaStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["pending", "approved", "hidden", "removed"]),
});

export async function setBetaStatusAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = betaStatusSchema.parse(Object.fromEntries(formData));
  await updateBetaStatus(parsed.id, parsed.status);
  await insertAdminAuditLog({
    adminId: admin.adminId,
    action: "beta.status",
    targetType: "beta",
    targetId: parsed.id,
    metadata: { status: parsed.status },
  });
  revalidatePath("/admin/betas");
  revalidateTag(`beta:${parsed.id}`);
}

export async function rejectWebhookAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = z.string().min(1).parse(formData.get("id"));
  await markWebhookRejected(id);
  await insertAdminAuditLog({
    adminId: admin.adminId,
    action: "webhook.reject",
    targetType: "webhook_inbox",
    targetId: id,
    metadata: {},
  });
  revalidatePath("/admin/webhooks");
}
