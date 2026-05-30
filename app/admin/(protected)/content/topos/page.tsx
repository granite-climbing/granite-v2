import { getAdminTopos, getAdminBoulders } from "@/lib/db/admin-read-queries";
import {
  saveTopoAction,
  softDeleteTopoAction,
  restoreTopoAction,
  togglePublishAction,
} from "@/lib/actions/admin-content";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminTable, AdminTableRow, AdminTableCell } from "@/components/admin/admin-table";
import { AdminField, inputCls, selectCls, btnPrimaryCls } from "@/components/admin/admin-field";
import { PublishBadge } from "@/components/admin/publish-badge";
import { DeleteControls, RestoreControls } from "@/components/admin/delete-restore-controls";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { EditDrawer } from "@/components/admin/edit-drawer";
import { FormSection, FullWidth } from "@/components/admin/form-section";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ boulderId?: string; edit?: string }>;
}

export default async function AdminToposPage({ searchParams }: Props) {
  const { boulderId, edit } = await searchParams;
  const [topos, boulders] = await Promise.all([
    getAdminTopos(boulderId || undefined),
    getAdminBoulders(),
  ]);
  const liveBoulders = boulders.filter((b) => b.deletedAt === null);
  const selectedBoulder = boulderId ? liveBoulders.find((b) => b.id === boulderId) : undefined;
  const editRow = edit ? topos.find((t) => t.id === edit) : undefined;

  // Build base href preserving boulderId filter
  const baseHref = boulderId
    ? `/admin/content/topos?boulderId=${boulderId}`
    : "/admin/content/topos";

  return (
    <AdminShell>
      <h1 className="mb-6 text-2xl font-bold">Topos</h1>

      {/* Filter bar */}
      <form method="get" className="mb-4 flex items-center gap-2">
        <label className="text-sm font-semibold text-[#57606A]">Filter by Boulder:</label>
        <select name="boulderId" defaultValue={boulderId ?? ""} className={`${selectCls} w-64`}>
          <option value="">All boulders</option>
          {liveBoulders.map((b) => (
            <option key={b.id} value={b.id}>{b.cragName} / {b.sectorName} / {b.name}</option>
          ))}
        </select>
        <button type="submit" className={btnPrimaryCls}>Filter</button>
        {boulderId && (
          <a href="/admin/content/topos" className="text-xs text-[#0969DA] hover:underline">Clear</a>
        )}
      </form>

      {/* Create form */}
      <AdminCard title="Create Topo">
        <form action={saveTopoAction} className="space-y-2">
          <FormSection title="Hierarchy" cols={2}>
            <FullWidth>
              <AdminField label="Boulder">
                <select name="boulderId" required defaultValue={boulderId ?? ""} className={selectCls}>
                  <option value="">— select boulder —</option>
                  {liveBoulders.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.cragName} / {b.sectorName} / {b.name}
                    </option>
                  ))}
                </select>
              </AdminField>
            </FullWidth>
          </FormSection>
          <FormSection title="Identity" cols={1}>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Name</label>
              <input name="name" required className={inputCls} placeholder="고물 정면" />
            </div>
          </FormSection>
          <FormSection title="Image" cols={1}>
            <FullWidth>
              <ImageUploadField name="baseImageUrl" defaultValue="" entityType="topos" entityId="new" purpose="base" />
            </FullWidth>
          </FormSection>
          <FormSection title="Publishing" cols={2}>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Sort Order</label>
              <input name="sortOrder" type="number" defaultValue="0" className={inputCls} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm">
                <input name="isPublished" type="checkbox" />
                Published
              </label>
            </div>
          </FormSection>
          {/* Cache revalidation context */}
          <input type="hidden" name="cragSlug" value={selectedBoulder?.cragSlug ?? ""} />
          <div className="pt-2">
            <button type="submit" className={btnPrimaryCls}>Create Topo</button>
          </div>
        </form>
      </AdminCard>

      {/* Topos list */}
      <div className="mt-6">
        <AdminCard title={`Topos (${topos.length})`}>
          <AdminTable headers={["ID", "Boulder", "Name", "Sort", "Status", "Actions"]}>
            {topos.map((topo) => (
              <AdminTableRow key={topo.id} deleted={topo.deletedAt !== null}>
                <AdminTableCell className="font-mono text-xs text-[#57606A]">{topo.id}</AdminTableCell>
                <AdminTableCell className="text-xs text-[#57606A]">{topo.boulderName}</AdminTableCell>
                <AdminTableCell className="font-semibold">{topo.name}</AdminTableCell>
                <AdminTableCell>{topo.sortOrder}</AdminTableCell>
                <AdminTableCell>
                  <PublishBadge published={topo.isPublished} deleted={topo.deletedAt !== null} />
                </AdminTableCell>
                <AdminTableCell>
                  <div className="flex flex-col gap-1">
                    <Link
                      href={boulderId ? `?boulderId=${boulderId}&edit=${topo.id}` : `?edit=${topo.id}`}
                      className={btnPrimaryCls}
                    >
                      Edit
                    </Link>

                    {topo.deletedAt === null && (
                      <form action={togglePublishAction} className="flex items-center gap-1">
                        <input type="hidden" name="table" value="topos" />
                        <input type="hidden" name="id" value={topo.id} />
                        <input type="hidden" name="isPublished" value={topo.isPublished ? "off" : "on"} />
                        <button type="submit" className={btnPrimaryCls}>
                          {topo.isPublished ? "Unpublish" : "Publish"}
                        </button>
                      </form>
                    )}

                    {topo.deletedAt === null ? (
                      <DeleteControls
                        action={softDeleteTopoAction}
                        hiddenInputs={{
                          id: topo.id,
                          boulderId: topo.boulderId,
                          cragSlug: topo.cragSlug,
                        }}
                      />
                    ) : (
                      <RestoreControls
                        action={restoreTopoAction}
                        hiddenInputs={{
                          id: topo.id,
                          boulderId: topo.boulderId,
                          cragSlug: topo.cragSlug,
                        }}
                      />
                    )}
                  </div>
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTable>
        </AdminCard>
      </div>

      {/* Edit drawer */}
      {editRow && (
        <EditDrawer title="Edit Topo" closeHref={baseHref}>
          <form action={saveTopoAction}>
            <input type="hidden" name="id" value={editRow.id} />
            <input type="hidden" name="cragSlug" value={editRow.cragSlug} />
            <FormSection title="Hierarchy" cols={2}>
              <FullWidth>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Boulder</label>
                <select name="boulderId" defaultValue={editRow.boulderId} className={selectCls}>
                  {liveBoulders.map((b) => (
                    <option key={b.id} value={b.id}>{b.cragName} / {b.name}</option>
                  ))}
                </select>
              </FullWidth>
            </FormSection>
            <FormSection title="Identity" cols={1}>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Name</label>
                <input name="name" required defaultValue={editRow.name} className={inputCls} />
              </div>
            </FormSection>
            <FormSection title="Image" cols={1}>
              <FullWidth>
                <ImageUploadField name="baseImageUrl" defaultValue={editRow.baseImageUrl ?? ""} entityType="topos" entityId={editRow.id} purpose="base" />
              </FullWidth>
            </FormSection>
            <FormSection title="Publishing" cols={2}>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Sort Order</label>
                <input name="sortOrder" type="number" defaultValue={editRow.sortOrder} className={inputCls} />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm">
                  <input name="isPublished" type="checkbox" defaultChecked={editRow.isPublished} />
                  Published
                </label>
              </div>
            </FormSection>
            <button type="submit" className={`${btnPrimaryCls} w-full`}>Save changes</button>
          </form>
        </EditDrawer>
      )}
    </AdminShell>
  );
}
