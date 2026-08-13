import { getAdminAnnouncements } from "@/lib/db/admin-read-queries";
import {
  saveAnnouncementAction,
  softDeleteAnnouncementAction,
  restoreAnnouncementAction,
} from "@/lib/actions/admin-announcements";
import { togglePublishAction } from "@/lib/actions/admin-content";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminTable, AdminTableRow, AdminTableCell } from "@/components/admin/admin-table";
import { inputCls, textareaCls, btnPrimaryCls } from "@/components/admin/admin-field";
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

export default async function AdminAnnouncementsPage({ searchParams }: Props) {
  const { edit } = await searchParams;
  const announcements = await getAdminAnnouncements();
  const editRow = edit ? announcements.find((a) => a.id === edit) : undefined;

  return (
    <AdminShell>
      <h1 className="mb-6 text-2xl font-bold">Announcements</h1>

      {/* Create form */}
      <AdminCard title="Create Announcement">
        <form action={saveAnnouncementAction} className="space-y-2">
          <FormSection title="Identity" cols={1}>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Title</label>
              <input name="title" required className={inputCls} placeholder="이번 주 이벤트" />
            </div>
          </FormSection>
          <FormSection title="Body" cols={1}>
            <FullWidth>
              <textarea name="body" rows={4} className={textareaCls} placeholder="공지 내용을 입력하세요." />
            </FullWidth>
          </FormSection>
          <FormSection title="Image" cols={1}>
            <FullWidth>
              <ImageUploadField name="coverImageUrl" defaultValue="" entityType="announcements" entityId="new" purpose="cover" />
            </FullWidth>
          </FormSection>
          <FormSection title="Targeting" cols={2}>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Crag ID (optional)</label>
              <input name="cragId" className={inputCls} placeholder="crag_anyang" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Link URL</label>
              <input name="linkUrl" className={inputCls} placeholder="https://instagram.com/..." />
            </div>
          </FormSection>
          <FormSection title="Publishing" cols={2}>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Published At</label>
              <input name="publishedAt" className={inputCls} placeholder="2026-05-30T09:00:00Z" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Sort Order</label>
              <input name="sortOrder" type="number" defaultValue="0" className={inputCls} />
            </div>
            <div className="col-span-2 flex items-center">
              <label className="flex items-center gap-2 text-sm">
                <input name="isPublished" type="checkbox" />
                Published
              </label>
            </div>
          </FormSection>
          <div className="pt-2">
            <button type="submit" className={btnPrimaryCls}>Create Announcement</button>
          </div>
        </form>
      </AdminCard>

      {/* Announcements list */}
      <div className="mt-6">
        <AdminCard title={`All Announcements (${announcements.length})`}>
          <AdminTable headers={["ID", "Title", "Body", "Sort", "Status", "Actions"]}>
            {announcements.map((ann) => (
              <AdminTableRow key={ann.id} deleted={ann.deletedAt !== null}>
                <AdminTableCell className="font-mono text-xs text-[#57606A]">{ann.id}</AdminTableCell>
                <AdminTableCell>
                  <div className="font-semibold">{ann.title}</div>
                  {ann.coverImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ann.coverImageUrl} alt="" className="mt-1 h-10 w-14 rounded object-cover" />
                  )}
                </AdminTableCell>
                <AdminTableCell className="max-w-xs text-xs text-[#57606A]">
                  {ann.body ? ann.body.slice(0, 80) : <span className="text-[#AAB0B7]">(empty)</span>}
                </AdminTableCell>
                <AdminTableCell>{ann.sortOrder}</AdminTableCell>
                <AdminTableCell>
                  <PublishBadge published={ann.isPublished} deleted={ann.deletedAt !== null} />
                </AdminTableCell>
                <AdminTableCell>
                  <div className="flex flex-col gap-1">
                    <Link href={`?edit=${ann.id}`} className={btnPrimaryCls}>Edit</Link>

                    {ann.deletedAt === null && (
                      <form action={togglePublishAction} className="flex items-center gap-1">
                        <input type="hidden" name="table" value="announcements" />
                        <input type="hidden" name="id" value={ann.id} />
                        <input type="hidden" name="name" value={ann.title} />
                        <input type="hidden" name="isPublished" value={ann.isPublished ? "off" : "on"} />
                        <button type="submit" className={btnPrimaryCls}>
                          {ann.isPublished ? "Unpublish" : "Publish"}
                        </button>
                      </form>
                    )}

                    {ann.deletedAt === null ? (
                      <DeleteControls
                        action={softDeleteAnnouncementAction}
                        hiddenInputs={{ id: ann.id, title: ann.title }}
                      />
                    ) : (
                      <RestoreControls
                        action={restoreAnnouncementAction}
                        hiddenInputs={{ id: ann.id, title: ann.title }}
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
        <EditDrawer title="Edit Announcement" closeHref="/admin/announcements">
          <form action={saveAnnouncementAction}>
            <input type="hidden" name="id" value={editRow.id} />
            <FormSection title="Identity" cols={1}>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Title</label>
                <input name="title" required defaultValue={editRow.title} className={inputCls} />
              </div>
            </FormSection>
            <FormSection title="Body" cols={1}>
              <FullWidth>
                <textarea name="body" defaultValue={editRow.body} rows={5} className={textareaCls} />
              </FullWidth>
            </FormSection>
            <FormSection title="Image" cols={1}>
              <FullWidth>
                <ImageUploadField name="coverImageUrl" defaultValue={editRow.coverImageUrl ?? ""} entityType="announcements" entityId={editRow.id} purpose="cover" />
              </FullWidth>
            </FormSection>
            <FormSection title="Targeting" cols={2}>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Crag ID (optional)</label>
                <input name="cragId" defaultValue={editRow.cragId ?? ""} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Link URL</label>
                <input name="linkUrl" defaultValue={editRow.linkUrl} className={inputCls} />
              </div>
            </FormSection>
            <FormSection title="Publishing" cols={2}>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Published At</label>
                <input name="publishedAt" defaultValue={editRow.publishedAt} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Sort Order</label>
                <input name="sortOrder" type="number" defaultValue={editRow.sortOrder} className={inputCls} />
              </div>
              <div className="col-span-2 flex items-center">
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
