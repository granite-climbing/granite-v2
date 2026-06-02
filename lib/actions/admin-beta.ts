"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { insertAdminAuditLog } from "@/lib/db/admin-queries";
import { randomUUID } from "node:crypto";
import { manualMatchWebhookToRoute, markWebhookRejected, updateBetaStatus } from "@/lib/db/beta-queries";

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

const manualMatchSchema = z.object({
  webhookId: z.string().min(1),
  routeId: z.string().min(1),
});

export async function manualMatchWebhookAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = manualMatchSchema.parse(Object.fromEntries(formData));
  const result = await manualMatchWebhookToRoute({
    webhookId: parsed.webhookId,
    routeId: parsed.routeId,
    betaId: `beta_${randomUUID()}`,
  });

  if (result.ok) {
    await insertAdminAuditLog({
      adminId: admin.adminId,
      action: "webhook.manual_match",
      targetType: "webhook_inbox",
      targetId: parsed.webhookId,
      metadata: { routeId: parsed.routeId, betaId: result.betaId },
    });
    revalidatePath("/admin/webhooks");
    revalidatePath("/admin/betas");
    return;
  }

  await insertAdminAuditLog({
    adminId: admin.adminId,
    action: "webhook.manual_match_skipped",
    targetType: "webhook_inbox",
    targetId: parsed.webhookId,
    metadata:
      result.reason === "duplicate"
        ? { routeId: parsed.routeId, reason: "duplicate", existingBetaId: result.existingBetaId }
        : { routeId: parsed.routeId, reason: result.reason },
  });
  revalidatePath("/admin/webhooks");
}
