import { getAdminAreas } from "@/lib/db/admin-read-queries";
import {
  saveAreaAction,
  softDeleteAreaAction,
  restoreAreaAction,
  togglePublishAction,
} from "@/lib/actions/admin-content";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminTable, AdminTableRow, AdminTableCell } from "@/components/admin/admin-table";
import { AdminField, inputCls, btnPrimaryCls } from "@/components/admin/admin-field";
import { PublishBadge } from "@/components/admin/publish-badge";
import { DeleteControls, RestoreControls } from "@/components/admin/delete-restore-controls";

export const dynamic = "force-dynamic";

export default async function AdminAreasPage() {
  const areas = await getAdminAreas();

  return (
    <AdminShell>
      <h1 className="mb-6 text-2xl font-bold">Areas</h1>

      {/* Create form */}
      <AdminCard title="Create Area">
        <form action={saveAreaAction} className="space-y-2">
          <AdminField label="Name">
            <input name="name" required className={inputCls} placeholder="수도권" />
          </AdminField>
          <AdminField label="Name (EN)">
            <input name="nameEn" className={inputCls} placeholder="Greater Seoul" />
          </AdminField>
          <AdminField label="Slug">
            <input name="slug" required className={inputCls} placeholder="greater_seoul" />
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
            <button type="submit" className={btnPrimaryCls}>Create Area</button>
          </div>
        </form>
      </AdminCard>

      {/* Areas list */}
      <div className="mt-6">
        <AdminCard title={`All Areas (${areas.length})`}>
          <AdminTable headers={["ID", "Name", "Slug", "Sort", "Status", "Cover", "Actions"]}>
            {areas.map((area) => (
              <AdminTableRow key={area.id} deleted={area.deletedAt !== null}>
                <AdminTableCell className="font-mono text-xs text-[#57606A]">{area.id}</AdminTableCell>
                <AdminTableCell>
                  <div className="font-semibold">{area.name}</div>
                  {area.nameEn && <div className="text-xs text-[#57606A]">{area.nameEn}</div>}
                </AdminTableCell>
                <AdminTableCell className="font-mono text-xs">{area.slug}</AdminTableCell>
                <AdminTableCell>{area.sortOrder}</AdminTableCell>
                <AdminTableCell>
                  <PublishBadge published={area.isPublished} deleted={area.deletedAt !== null} />
                </AdminTableCell>
                <AdminTableCell>
                  {area.coverImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={area.coverImageUrl} alt="" className="h-10 w-14 rounded object-cover" />
                  )}
                </AdminTableCell>
                <AdminTableCell className="min-w-[420px]">
                  <div className="flex flex-col gap-2">
                    {/* Edit form */}
                    <form action={saveAreaAction} className="flex flex-wrap items-center gap-1">
                      <input type="hidden" name="id" value={area.id} />
                      <input name="name" defaultValue={area.name} className={`${inputCls} w-32`} />
                      <input name="nameEn" defaultValue={area.nameEn ?? ""} className={`${inputCls} w-28`} placeholder="nameEn" />
                      <input name="slug" defaultValue={area.slug} className={`${inputCls} w-28`} />
                      <input name="sortOrder" type="number" defaultValue={area.sortOrder} className={`${inputCls} w-14`} />
                      <input name="coverImageUrl" defaultValue={area.coverImageUrl} className={`${inputCls} w-40`} placeholder="coverImageUrl" />
                      <label className="flex items-center gap-1 text-xs">
                        <input name="isPublished" type="checkbox" defaultChecked={area.isPublished} />
                        Pub
                      </label>
                      <button type="submit" className={btnPrimaryCls}>Save</button>
                    </form>

                    {/* Publish toggle */}
                    {area.deletedAt === null && (
                      <form action={togglePublishAction} className="flex items-center gap-1">
                        <input type="hidden" name="table" value="areas" />
                        <input type="hidden" name="id" value={area.id} />
                        <input type="hidden" name="isPublished" value={area.isPublished ? "off" : "on"} />
                        <button type="submit" className={btnPrimaryCls}>
                          {area.isPublished ? "Unpublish" : "Publish"}
                        </button>
                      </form>
                    )}

                    {/* Delete / Restore */}
                    {area.deletedAt === null ? (
                      <DeleteControls
                        action={softDeleteAreaAction}
                        hiddenInputs={{ id: area.id }}
                      />
                    ) : (
                      <RestoreControls
                        action={restoreAreaAction}
                        hiddenInputs={{ id: area.id }}
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
