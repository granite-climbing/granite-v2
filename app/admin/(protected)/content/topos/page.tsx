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

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ boulderId?: string }>;
}

export default async function AdminToposPage({ searchParams }: Props) {
  const { boulderId } = await searchParams;
  const [topos, boulders] = await Promise.all([
    getAdminTopos(boulderId || undefined),
    getAdminBoulders(),
  ]);
  const liveBoulders = boulders.filter((b) => b.deletedAt === null);
  const selectedBoulder = boulderId ? liveBoulders.find((b) => b.id === boulderId) : undefined;

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
          <AdminField label="Name">
            <input name="name" required className={inputCls} placeholder="고물 정면" />
          </AdminField>
          <AdminField label="Base Image URL">
            <input name="baseImageUrl" className={inputCls} placeholder="https://cdn.granite.kr/..." />
          </AdminField>
          <AdminField label="Sort Order">
            <input name="sortOrder" type="number" defaultValue="0" className={inputCls} />
          </AdminField>
          <AdminField label="Published">
            <label className="flex items-center gap-2 text-sm">
              <input name="isPublished" type="checkbox" />
              Published
            </label>
          </AdminField>
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
          <AdminTable headers={["ID", "Boulder", "Name", "Sort", "Status", "Base Image", "Actions"]}>
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
                  {topo.baseImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={topo.baseImageUrl} alt="" className="h-10 w-14 rounded object-cover" />
                  )}
                </AdminTableCell>
                <AdminTableCell className="min-w-[440px]">
                  <div className="flex flex-col gap-2">
                    {/* Edit form */}
                    <form action={saveTopoAction} className="flex flex-wrap items-center gap-1">
                      <input type="hidden" name="id" value={topo.id} />
                      <input type="hidden" name="cragSlug" value={topo.cragSlug} />
                      <select name="boulderId" defaultValue={topo.boulderId} className={`${selectCls} w-40`}>
                        {liveBoulders.map((b) => (
                          <option key={b.id} value={b.id}>{b.cragName}/{b.name}</option>
                        ))}
                      </select>
                      <input name="name" defaultValue={topo.name} className={`${inputCls} w-28`} />
                      <input name="baseImageUrl" defaultValue={topo.baseImageUrl} className={`${inputCls} w-40`} placeholder="baseImageUrl" />
                      <input name="sortOrder" type="number" defaultValue={topo.sortOrder} className={`${inputCls} w-14`} />
                      <label className="flex items-center gap-1 text-xs">
                        <input name="isPublished" type="checkbox" defaultChecked={topo.isPublished} />
                        Pub
                      </label>
                      <button type="submit" className={btnPrimaryCls}>Save</button>
                    </form>

                    {/* Publish toggle */}
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

                    {/* Delete / Restore */}
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
    </AdminShell>
  );
}
