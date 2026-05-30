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
import { EditDrawer } from "@/components/admin/edit-drawer";
import { FormSection, FullWidth } from "@/components/admin/form-section";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ edit?: string }>;
}

export default async function AdminCragsPage({ searchParams }: Props) {
  const { edit } = await searchParams;
  const [crags, areas] = await Promise.all([getAdminCrags(), getAdminAreas()]);
  const liveAreas = areas.filter((a) => a.deletedAt === null);
  const editRow = edit ? crags.find((c) => c.id === edit) : undefined;

  return (
    <AdminShell>
      <h1 className="mb-6 text-2xl font-bold">Crags</h1>

      {/* Create form */}
      <AdminCard title="Create Crag">
        <form action={saveCragAction} className="space-y-2">
          <FormSection title="Identity" cols={2}>
            <FullWidth>
              <AdminField label="Area">
                <select name="areaId" required className={selectCls}>
                  <option value="">— select area —</option>
                  {liveAreas.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </AdminField>
            </FullWidth>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Name</label>
              <input name="name" required className={inputCls} placeholder="안양" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Name (EN)</label>
              <input name="nameEn" className={inputCls} placeholder="Anyang" />
            </div>
            <FullWidth>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Slug</label>
              <input name="slug" required className={inputCls} placeholder="anyang" />
            </FullWidth>
          </FormSection>
          <FormSection title="Location" cols={2}>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Lat</label>
              <input name="lat" type="number" step="any" className={inputCls} placeholder="37.42" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Lng</label>
              <input name="lng" type="number" step="any" className={inputCls} placeholder="126.92" />
            </div>
          </FormSection>
          <FormSection title="Content" cols={1}>
            <FullWidth>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Description</label>
              <textarea name="description" className={textareaCls} rows={2} placeholder="설명..." />
            </FullWidth>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Season</label>
              <input name="season" className={inputCls} placeholder="2월 말 ~ 5월 말" />
            </div>
          </FormSection>
          <FormSection title="Image" cols={1}>
            <FullWidth>
              <ImageUploadField name="coverImageUrl" defaultValue="" entityType="crags" entityId="new" purpose="cover" />
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
          <div className="pt-2">
            <button type="submit" className={btnPrimaryCls}>Create Crag</button>
          </div>
        </form>
      </AdminCard>

      {/* Crags list */}
      <div className="mt-6">
        <AdminCard title={`All Crags (${crags.length})`}>
          <AdminTable headers={["ID", "Area", "Name", "Slug", "Sort", "Status", "Actions"]}>
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
                  <div className="flex flex-col gap-1">
                    <Link href={`?edit=${crag.id}`} className={btnPrimaryCls}>Edit</Link>

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

      {/* Edit drawer */}
      {editRow && (
        <EditDrawer title="Edit Crag" closeHref="/admin/content/crags">
          <form action={saveCragAction}>
            <input type="hidden" name="id" value={editRow.id} />
            <FormSection title="Identity" cols={2}>
              <FullWidth>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Area</label>
                <select name="areaId" defaultValue={editRow.areaId} className={selectCls}>
                  {liveAreas.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </FullWidth>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Name</label>
                <input name="name" required defaultValue={editRow.name} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Name (EN)</label>
                <input name="nameEn" defaultValue={editRow.nameEn ?? ""} className={inputCls} />
              </div>
              <FullWidth>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Slug</label>
                <input name="slug" required defaultValue={editRow.slug} className={inputCls} />
              </FullWidth>
            </FormSection>
            <FormSection title="Location" cols={2}>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Lat</label>
                <input name="lat" type="number" step="any" defaultValue={editRow.lat ?? ""} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Lng</label>
                <input name="lng" type="number" step="any" defaultValue={editRow.lng ?? ""} className={inputCls} />
              </div>
            </FormSection>
            <FormSection title="Content" cols={1}>
              <FullWidth>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Description</label>
                <textarea name="description" defaultValue={editRow.description} className={textareaCls} rows={3} />
              </FullWidth>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Season</label>
                <input name="season" defaultValue={editRow.season} className={inputCls} />
              </div>
            </FormSection>
            <FormSection title="Image" cols={1}>
              <FullWidth>
                <ImageUploadField name="coverImageUrl" defaultValue={editRow.coverImageUrl ?? ""} entityType="crags" entityId={editRow.id} purpose="cover" />
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
