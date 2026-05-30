import { getAdminCrags, getAdminAreas } from "@/lib/db/admin-read-queries";
import {
  saveCragAction,
  softDeleteCragAction,
  restoreCragAction,
  togglePublishAction,
} from "@/lib/actions/admin-content";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminTable, AdminTableRow, AdminTableCell } from "@/components/admin/admin-table";
import { AdminField, inputCls, selectCls, textareaCls, btnPrimaryCls } from "@/components/admin/admin-field";
import { PublishBadge } from "@/components/admin/publish-badge";
import { DeleteControls, RestoreControls } from "@/components/admin/delete-restore-controls";
import { ImageUploadField } from "@/components/admin/image-upload-field";

export const dynamic = "force-dynamic";

export default async function AdminCragsPage() {
  const [crags, areas] = await Promise.all([getAdminCrags(), getAdminAreas()]);
  const liveAreas = areas.filter((a) => a.deletedAt === null);

  return (
    <AdminShell>
      <h1 className="mb-6 text-2xl font-bold">Crags</h1>

      {/* Create form */}
      <AdminCard title="Create Crag">
        <form action={saveCragAction} className="space-y-2">
          <AdminField label="Area">
            <select name="areaId" required className={selectCls}>
              <option value="">— select area —</option>
              {liveAreas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </AdminField>
          <AdminField label="Name">
            <input name="name" required className={inputCls} placeholder="안양" />
          </AdminField>
          <AdminField label="Name (EN)">
            <input name="nameEn" className={inputCls} placeholder="Anyang" />
          </AdminField>
          <AdminField label="Slug">
            <input name="slug" required className={inputCls} placeholder="anyang" />
          </AdminField>
          <AdminField label="Lat">
            <input name="lat" type="number" step="any" className={inputCls} placeholder="37.42" />
          </AdminField>
          <AdminField label="Lng">
            <input name="lng" type="number" step="any" className={inputCls} placeholder="126.92" />
          </AdminField>
          <AdminField label="Description">
            <textarea name="description" className={textareaCls} rows={2} placeholder="설명..." />
          </AdminField>
          <AdminField label="Season">
            <input name="season" className={inputCls} placeholder="2월 말 ~ 5월 말" />
          </AdminField>
          <AdminField label="Cover Image URL">
            <input name="coverImageUrl" className={inputCls} placeholder="https://cdn.granite.kr/..." />
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
          <div className="pt-2">
            <button type="submit" className={btnPrimaryCls}>Create Crag</button>
          </div>
        </form>
      </AdminCard>

      {/* Crags list */}
      <div className="mt-6">
        <AdminCard title={`All Crags (${crags.length})`}>
          <AdminTable headers={["ID", "Area", "Name", "Slug", "Sort", "Status", "Cover", "Actions"]}>
            {crags.map((crag) => (
              <AdminTableRow key={crag.id} deleted={crag.deletedAt !== null}>
                <AdminTableCell className="font-mono text-xs text-[#57606A]">{crag.id}</AdminTableCell>
                <AdminTableCell className="text-xs text-[#57606A]">{crag.areaName}</AdminTableCell>
                <AdminTableCell>
                  <div className="font-semibold">{crag.name}</div>
                  {crag.nameEn && <div className="text-xs text-[#57606A]">{crag.nameEn}</div>}
                </AdminTableCell>
                <AdminTableCell className="font-mono text-xs">{crag.slug}</AdminTableCell>
                <AdminTableCell>{crag.sortOrder}</AdminTableCell>
                <AdminTableCell>
                  <PublishBadge published={crag.isPublished} deleted={crag.deletedAt !== null} />
                </AdminTableCell>
                <AdminTableCell>
                  {crag.coverImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={crag.coverImageUrl} alt="" className="h-10 w-14 rounded object-cover" />
                  )}
                </AdminTableCell>
                <AdminTableCell className="min-w-[520px]">
                  <div className="flex flex-col gap-2">
                    {/* Edit form */}
                    <form action={saveCragAction} className="flex flex-wrap items-center gap-1">
                      <input type="hidden" name="id" value={crag.id} />
                      <select name="areaId" defaultValue={crag.areaId} className={`${selectCls} w-28`}>
                        {liveAreas.map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                      <input name="name" defaultValue={crag.name} className={`${inputCls} w-24`} />
                      <input name="nameEn" defaultValue={crag.nameEn ?? ""} className={`${inputCls} w-24`} placeholder="nameEn" />
                      <input name="slug" defaultValue={crag.slug} className={`${inputCls} w-24`} />
                      <input name="lat" type="number" step="any" defaultValue={crag.lat ?? ""} className={`${inputCls} w-20`} placeholder="lat" />
                      <input name="lng" type="number" step="any" defaultValue={crag.lng ?? ""} className={`${inputCls} w-20`} placeholder="lng" />
                      <input name="season" defaultValue={crag.season} className={`${inputCls} w-28`} placeholder="season" />
                      <input name="description" defaultValue={crag.description} className={`${inputCls} w-40`} placeholder="description" />
                      <ImageUploadField name="coverImageUrl" defaultValue={crag.coverImageUrl ?? ""} entityType="crags" entityId={crag.id} purpose="cover" />
                      <input name="sortOrder" type="number" defaultValue={crag.sortOrder} className={`${inputCls} w-14`} />
                      <label className="flex items-center gap-1 text-xs">
                        <input name="isPublished" type="checkbox" defaultChecked={crag.isPublished} />
                        Pub
                      </label>
                      <button type="submit" className={btnPrimaryCls}>Save</button>
                    </form>

                    {/* Publish toggle */}
                    {crag.deletedAt === null && (
                      <form action={togglePublishAction} className="flex items-center gap-1">
                        <input type="hidden" name="table" value="crags" />
                        <input type="hidden" name="id" value={crag.id} />
                        <input type="hidden" name="isPublished" value={crag.isPublished ? "off" : "on"} />
                        <button type="submit" className={btnPrimaryCls}>
                          {crag.isPublished ? "Unpublish" : "Publish"}
                        </button>
                      </form>
                    )}

                    {/* Delete / Restore */}
                    {crag.deletedAt === null ? (
                      <DeleteControls
                        action={softDeleteCragAction}
                        hiddenInputs={{ id: crag.id, slug: crag.slug }}
                      />
                    ) : (
                      <RestoreControls
                        action={restoreCragAction}
                        hiddenInputs={{ id: crag.id, slug: crag.slug }}
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
