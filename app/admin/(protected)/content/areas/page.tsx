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
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { EditDrawer } from "@/components/admin/edit-drawer";
import { FormSection, FullWidth } from "@/components/admin/form-section";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ edit?: string }>;
}

export default async function AdminAreasPage({ searchParams }: Props) {
  const { edit } = await searchParams;
  const areas = await getAdminAreas();
  const editRow = edit ? areas.find((a) => a.id === edit) : undefined;

  return (
    <AdminShell>
      <h1 className="mb-6 text-2xl font-bold">Areas</h1>

      {/* Create form */}
      <AdminCard title="Create Area">
        <form action={saveAreaAction} className="space-y-2">
          <FormSection title="Identity" cols={2}>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Name</label>
              <input name="name" required className={inputCls} placeholder="수도권" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Name (EN)</label>
              <input name="nameEn" className={inputCls} placeholder="Greater Seoul" />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Slug</label>
              <input name="slug" required className={inputCls} placeholder="greater_seoul" />
            </div>
          </FormSection>
          <FormSection title="Image" cols={1}>
            <AdminField label="Cover Image">
              <ImageUploadField name="coverImageUrl" defaultValue="" entityType="areas" entityId="new" purpose="cover" />
            </AdminField>
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
            <button type="submit" className={btnPrimaryCls}>Create Area</button>
          </div>
        </form>
      </AdminCard>

      {/* Areas list */}
      <div className="mt-6">
        <AdminCard title={`All Areas (${areas.length})`}>
          <AdminTable headers={["ID", "Name", "Slug", "Sort", "Status", "Actions"]}>
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
                  <div className="flex flex-col gap-1">
                    <Link href={`?edit=${area.id}`} className={btnPrimaryCls}>Edit</Link>

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

      {/* Edit drawer */}
      {editRow && (
        <EditDrawer title="Edit Area" closeHref="/admin/content/areas">
          <form action={saveAreaAction}>
            <input type="hidden" name="id" value={editRow.id} />
            <FormSection title="Identity" cols={2}>
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
            <FormSection title="Image" cols={1}>
              <FullWidth>
                <ImageUploadField name="coverImageUrl" defaultValue={editRow.coverImageUrl ?? ""} entityType="areas" entityId={editRow.id} purpose="cover" />
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
