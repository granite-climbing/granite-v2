import { getAdminBoulders, getAdminSectors } from "@/lib/db/admin-read-queries";
import {
  saveBoulderAction,
  softDeleteBoulderAction,
  restoreBoulderAction,
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
  searchParams: Promise<{ sectorId?: string }>;
}

export default async function AdminBouldersPage({ searchParams }: Props) {
  const { sectorId } = await searchParams;
  const [boulders, sectors] = await Promise.all([
    getAdminBoulders(sectorId || undefined),
    getAdminSectors(),
  ]);
  const liveSectors = sectors.filter((s) => s.deletedAt === null);
  const selectedSector = sectorId ? liveSectors.find((s) => s.id === sectorId) : undefined;

  return (
    <AdminShell>
      <h1 className="mb-6 text-2xl font-bold">Boulders</h1>

      {/* Filter bar */}
      <form method="get" className="mb-4 flex items-center gap-2">
        <label className="text-sm font-semibold text-[#57606A]">Filter by Sector:</label>
        <select name="sectorId" defaultValue={sectorId ?? ""} className={`${selectCls} w-56`}>
          <option value="">All sectors</option>
          {liveSectors.map((s) => (
            <option key={s.id} value={s.id}>{s.cragName} / {s.name}</option>
          ))}
        </select>
        <button type="submit" className={btnPrimaryCls}>Filter</button>
        {sectorId && (
          <a href="/admin/content/boulders" className="text-xs text-[#0969DA] hover:underline">Clear</a>
        )}
      </form>

      {/* Create form */}
      <AdminCard title="Create Boulder">
        <form action={saveBoulderAction} className="space-y-2">
          <AdminField label="Sector">
            <select name="sectorId" required className={selectCls}>
              <option value="">— select sector —</option>
              {liveSectors.map((s) => (
                <option key={s.id} value={s.id} selected={s.id === sectorId}>
                  {s.cragName} / {s.name}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField label="Name">
            <input name="name" required className={inputCls} placeholder="고물 볼더" />
          </AdminField>
          <AdminField label="Slug">
            <input name="slug" required className={inputCls} placeholder="gomul_boulder" />
          </AdminField>
          <AdminField label="Lat">
            <input name="lat" type="number" step="any" required className={inputCls} placeholder="37.42" />
          </AdminField>
          <AdminField label="Lng">
            <input name="lng" type="number" step="any" required className={inputCls} placeholder="126.92" />
          </AdminField>
          <AdminField label="Hashtags">
            <input name="hashtags" className={inputCls} placeholder="#모락산, 슬랩" />
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
          {/* Cache revalidation context */}
          <input type="hidden" name="cragSlug" value={selectedSector?.cragSlug ?? ""} />
          <input type="hidden" name="sectorSlug" value={selectedSector?.slug ?? ""} />
          <div className="pt-2">
            <button type="submit" className={btnPrimaryCls}>Create Boulder</button>
          </div>
        </form>
      </AdminCard>

      {/* Boulders list */}
      <div className="mt-6">
        <AdminCard title={`Boulders (${boulders.length})`}>
          <AdminTable headers={["ID", "Sector", "Name", "Slug", "Lat/Lng", "Sort", "Status", "Cover", "Actions"]}>
            {boulders.map((boulder) => (
              <AdminTableRow key={boulder.id} deleted={boulder.deletedAt !== null}>
                <AdminTableCell className="font-mono text-xs text-[#57606A]">{boulder.id}</AdminTableCell>
                <AdminTableCell className="text-xs text-[#57606A]">
                  <div>{boulder.cragName}</div>
                  <div>{boulder.sectorName}</div>
                </AdminTableCell>
                <AdminTableCell className="font-semibold">{boulder.name}</AdminTableCell>
                <AdminTableCell className="font-mono text-xs">{boulder.slug}</AdminTableCell>
                <AdminTableCell className="text-xs">
                  {boulder.lat.toFixed(5)}, {boulder.lng.toFixed(5)}
                </AdminTableCell>
                <AdminTableCell>{boulder.sortOrder}</AdminTableCell>
                <AdminTableCell>
                  <PublishBadge published={boulder.isPublished} deleted={boulder.deletedAt !== null} />
                </AdminTableCell>
                <AdminTableCell>
                  {boulder.coverImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={boulder.coverImageUrl} alt="" className="h-10 w-14 rounded object-cover" />
                  )}
                </AdminTableCell>
                <AdminTableCell className="min-w-[500px]">
                  <div className="flex flex-col gap-2">
                    {/* Edit form */}
                    <form action={saveBoulderAction} className="flex flex-wrap items-center gap-1">
                      <input type="hidden" name="id" value={boulder.id} />
                      <input type="hidden" name="cragSlug" value={boulder.cragSlug} />
                      <input type="hidden" name="sectorSlug" value={boulder.sectorSlug} />
                      <select name="sectorId" defaultValue={boulder.sectorId} className={`${selectCls} w-32`}>
                        {liveSectors.map((s) => (
                          <option key={s.id} value={s.id}>{s.cragName}/{s.name}</option>
                        ))}
                      </select>
                      <input name="name" defaultValue={boulder.name} className={`${inputCls} w-24`} />
                      <input name="slug" defaultValue={boulder.slug} className={`${inputCls} w-24`} />
                      <input name="lat" type="number" step="any" defaultValue={boulder.lat} className={`${inputCls} w-20`} />
                      <input name="lng" type="number" step="any" defaultValue={boulder.lng} className={`${inputCls} w-20`} />
                      <input name="hashtags" defaultValue={
                        (() => {
                          try {
                            const parsed = JSON.parse(boulder.hashtags) as string[];
                            return parsed.map((t) => `#${t}`).join(", ");
                          } catch {
                            return boulder.hashtags;
                          }
                        })()
                      } className={`${inputCls} w-32`} placeholder="hashtags" />
                      <input name="coverImageUrl" defaultValue={boulder.coverImageUrl} className={`${inputCls} w-36`} placeholder="coverImageUrl" />
                      <input name="sortOrder" type="number" defaultValue={boulder.sortOrder} className={`${inputCls} w-14`} />
                      <label className="flex items-center gap-1 text-xs">
                        <input name="isPublished" type="checkbox" defaultChecked={boulder.isPublished} />
                        Pub
                      </label>
                      <button type="submit" className={btnPrimaryCls}>Save</button>
                    </form>

                    {/* Publish toggle */}
                    {boulder.deletedAt === null && (
                      <form action={togglePublishAction} className="flex items-center gap-1">
                        <input type="hidden" name="table" value="boulders" />
                        <input type="hidden" name="id" value={boulder.id} />
                        <input type="hidden" name="isPublished" value={boulder.isPublished ? "off" : "on"} />
                        <button type="submit" className={btnPrimaryCls}>
                          {boulder.isPublished ? "Unpublish" : "Publish"}
                        </button>
                      </form>
                    )}

                    {/* Delete / Restore */}
                    {boulder.deletedAt === null ? (
                      <DeleteControls
                        action={softDeleteBoulderAction}
                        hiddenInputs={{
                          id: boulder.id,
                          cragSlug: boulder.cragSlug,
                          sectorSlug: boulder.sectorSlug,
                        }}
                      />
                    ) : (
                      <RestoreControls
                        action={restoreBoulderAction}
                        hiddenInputs={{
                          id: boulder.id,
                          cragSlug: boulder.cragSlug,
                          sectorSlug: boulder.sectorSlug,
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
