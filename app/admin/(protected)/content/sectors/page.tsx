import { getAdminSectors, getAdminCrags } from "@/lib/db/admin-read-queries";
import {
  saveSectorAction,
  softDeleteSectorAction,
  restoreSectorAction,
  togglePublishAction,
} from "@/lib/actions/admin-content";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminTable, AdminTableRow, AdminTableCell } from "@/components/admin/admin-table";
import { AdminField, inputCls, selectCls, textareaCls, btnPrimaryCls } from "@/components/admin/admin-field";
import { PublishBadge } from "@/components/admin/publish-badge";
import { DeleteControls, RestoreControls } from "@/components/admin/delete-restore-controls";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ cragId?: string }>;
}

export default async function AdminSectorsPage({ searchParams }: Props) {
  const { cragId } = await searchParams;
  const [sectors, crags] = await Promise.all([
    getAdminSectors(cragId || undefined),
    getAdminCrags(),
  ]);
  const liveCrags = crags.filter((c) => c.deletedAt === null);
  const selectedCrag = cragId ? liveCrags.find((c) => c.id === cragId) : undefined;

  return (
    <AdminShell>
      <h1 className="mb-6 text-2xl font-bold">Sectors</h1>

      {/* Filter bar */}
      <form method="get" className="mb-4 flex items-center gap-2">
        <label className="text-sm font-semibold text-[#57606A]">Filter by Crag:</label>
        <select name="cragId" defaultValue={cragId ?? ""} className={`${selectCls} w-48`}>
          <option value="">All crags</option>
          {liveCrags.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button type="submit" className={btnPrimaryCls}>Filter</button>
        {cragId && (
          <a href="/admin/content/sectors" className="text-xs text-[#0969DA] hover:underline">Clear</a>
        )}
      </form>

      {/* Create form */}
      <AdminCard title="Create Sector">
        <form action={saveSectorAction} className="space-y-2">
          <AdminField label="Crag">
            <select name="cragId" required className={selectCls}>
              <option value="">— select crag —</option>
              {liveCrags.map((c) => (
                <option key={c.id} value={c.id} selected={c.id === cragId}>{c.name}</option>
              ))}
            </select>
          </AdminField>
          {/* cragSlug hidden: populated dynamically — leave blank for create (action reads from sector's crag) */}
          <AdminField label="Name">
            <input name="name" required className={inputCls} placeholder="앤틱 구역" />
          </AdminField>
          <AdminField label="Name (EN)">
            <input name="nameEn" className={inputCls} placeholder="Antique Zone" />
          </AdminField>
          <AdminField label="Slug">
            <input name="slug" required className={inputCls} placeholder="anyang_antique" />
          </AdminField>
          <AdminField label="Lat">
            <input name="lat" type="number" step="any" className={inputCls} />
          </AdminField>
          <AdminField label="Lng">
            <input name="lng" type="number" step="any" className={inputCls} />
          </AdminField>
          <AdminField label="Description">
            <textarea name="description" className={textareaCls} rows={2} />
          </AdminField>
          <AdminField label="Season">
            <input name="season" className={inputCls} />
          </AdminField>
          <AdminField label="Cover Image URL">
            <input name="coverImageUrl" className={inputCls} />
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
          {/* cragSlug for revalidation — empty on create since we don't know slug yet */}
          <input type="hidden" name="cragSlug" value={selectedCrag?.slug ?? ""} />
          <div className="pt-2">
            <button type="submit" className={btnPrimaryCls}>Create Sector</button>
          </div>
        </form>
      </AdminCard>

      {/* Sectors list */}
      <div className="mt-6">
        <AdminCard title={`Sectors (${sectors.length})`}>
          <AdminTable headers={["ID", "Crag", "Name", "Slug", "Sort", "Status", "Actions"]}>
            {sectors.map((sector) => (
              <AdminTableRow key={sector.id} deleted={sector.deletedAt !== null}>
                <AdminTableCell className="font-mono text-xs text-[#57606A]">{sector.id}</AdminTableCell>
                <AdminTableCell className="text-xs text-[#57606A]">{sector.cragName}</AdminTableCell>
                <AdminTableCell>
                  <div className="font-semibold">{sector.name}</div>
                  {sector.nameEn && <div className="text-xs text-[#57606A]">{sector.nameEn}</div>}
                </AdminTableCell>
                <AdminTableCell className="font-mono text-xs">{sector.slug}</AdminTableCell>
                <AdminTableCell>{sector.sortOrder}</AdminTableCell>
                <AdminTableCell>
                  <PublishBadge published={sector.isPublished} deleted={sector.deletedAt !== null} />
                </AdminTableCell>
                <AdminTableCell className="min-w-[520px]">
                  <div className="flex flex-col gap-2">
                    {/* Edit form */}
                    <form action={saveSectorAction} className="flex flex-wrap items-center gap-1">
                      <input type="hidden" name="id" value={sector.id} />
                      <input type="hidden" name="cragSlug" value={sector.cragSlug} />
                      <select name="cragId" defaultValue={sector.cragId} className={`${selectCls} w-28`}>
                        {liveCrags.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <input name="name" defaultValue={sector.name} className={`${inputCls} w-24`} />
                      <input name="nameEn" defaultValue={sector.nameEn ?? ""} className={`${inputCls} w-24`} placeholder="nameEn" />
                      <input name="slug" defaultValue={sector.slug} className={`${inputCls} w-28`} />
                      <input name="lat" type="number" step="any" defaultValue={sector.lat ?? ""} className={`${inputCls} w-20`} placeholder="lat" />
                      <input name="lng" type="number" step="any" defaultValue={sector.lng ?? ""} className={`${inputCls} w-20`} placeholder="lng" />
                      <input name="season" defaultValue={sector.season} className={`${inputCls} w-24`} placeholder="season" />
                      <input name="description" defaultValue={sector.description} className={`${inputCls} w-36`} placeholder="desc" />
                      <input name="coverImageUrl" defaultValue={sector.coverImageUrl} className={`${inputCls} w-36`} placeholder="coverImageUrl" />
                      <input name="sortOrder" type="number" defaultValue={sector.sortOrder} className={`${inputCls} w-14`} />
                      <label className="flex items-center gap-1 text-xs">
                        <input name="isPublished" type="checkbox" defaultChecked={sector.isPublished} />
                        Pub
                      </label>
                      <button type="submit" className={btnPrimaryCls}>Save</button>
                    </form>

                    {/* Publish toggle */}
                    {sector.deletedAt === null && (
                      <form action={togglePublishAction} className="flex items-center gap-1">
                        <input type="hidden" name="table" value="sectors" />
                        <input type="hidden" name="id" value={sector.id} />
                        <input type="hidden" name="isPublished" value={sector.isPublished ? "off" : "on"} />
                        <button type="submit" className={btnPrimaryCls}>
                          {sector.isPublished ? "Unpublish" : "Publish"}
                        </button>
                      </form>
                    )}

                    {/* Delete / Restore */}
                    {sector.deletedAt === null ? (
                      <DeleteControls
                        action={softDeleteSectorAction}
                        hiddenInputs={{
                          id: sector.id,
                          slug: sector.slug,
                          cragSlug: sector.cragSlug,
                        }}
                      />
                    ) : (
                      <RestoreControls
                        action={restoreSectorAction}
                        hiddenInputs={{
                          id: sector.id,
                          slug: sector.slug,
                          cragSlug: sector.cragSlug,
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
