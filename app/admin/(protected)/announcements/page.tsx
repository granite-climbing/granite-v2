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
import { AdminField, inputCls, textareaCls, btnPrimaryCls } from "@/components/admin/admin-field";
import { PublishBadge } from "@/components/admin/publish-badge";
import { DeleteControls, RestoreControls } from "@/components/admin/delete-restore-controls";
import { ImageUploadField } from "@/components/admin/image-upload-field";

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
  const announcements = await getAdminAnnouncements();

  return (
    <AdminShell>
      <h1 className="mb-6 text-2xl font-bold">Announcements</h1>

      {/* Create form */}
      <AdminCard title="Create Announcement">
        <form action={saveAnnouncementAction} className="space-y-2">
          <AdminField label="Title">
            <input name="title" required className={inputCls} placeholder="이번 주 이벤트" />
          </AdminField>
          <AdminField label="Body">
            <textarea name="body" rows={4} className={textareaCls} placeholder="공지 내용을 입력하세요." />
          </AdminField>
          <AdminField label="Cover Image URL">
            <input name="coverImageUrl" className={inputCls} placeholder="https://cdn.granite.kr/..." />
          </AdminField>
          <AdminField label="Crag ID">
            <input name="cragId" className={inputCls} placeholder="crag_anyang (optional)" />
          </AdminField>
          <AdminField label="Link URL">
            <input name="linkUrl" className={inputCls} placeholder="https://instagram.com/..." />
          </AdminField>
          <AdminField label="Published At">
            <input name="publishedAt" className={inputCls} placeholder="2026-05-30T09:00:00Z" />
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
                <AdminTableCell className="min-w-[480px]">
                  <div className="flex flex-col gap-2">
                    {/* Edit form */}
                    <form action={saveAnnouncementAction} className="flex flex-wrap items-start gap-1">
                      <input type="hidden" name="id" value={ann.id} />
                      <input
                        name="title"
                        defaultValue={ann.title}
                        required
                        className={`${inputCls} w-40`}
                        placeholder="title"
                      />
                      <textarea
                        name="body"
                        defaultValue={ann.body}
                        rows={2}
                        className={`${textareaCls} w-48`}
                        placeholder="body"
                      />
                      <ImageUploadField name="coverImageUrl" defaultValue={ann.coverImageUrl ?? ""} entityType="announcements" entityId={ann.id} purpose="cover" />
                      <input
                        name="cragId"
                        defaultValue={ann.cragId ?? ""}
                        className={`${inputCls} w-28`}
                        placeholder="cragId"
                      />
                      <input
                        name="linkUrl"
                        defaultValue={ann.linkUrl}
                        className={`${inputCls} w-40`}
                        placeholder="linkUrl"
                      />
                      <input
                        name="publishedAt"
                        defaultValue={ann.publishedAt}
                        className={`${inputCls} w-36`}
                        placeholder="publishedAt"
                      />
                      <input
                        name="sortOrder"
                        type="number"
                        defaultValue={ann.sortOrder}
                        className={`${inputCls} w-14`}
                      />
                      <label className="flex items-center gap-1 text-xs">
                        <input name="isPublished" type="checkbox" defaultChecked={ann.isPublished} />
                        Pub
                      </label>
                      <button type="submit" className={btnPrimaryCls}>Save</button>
                    </form>

                    {/* Publish toggle */}
                    {ann.deletedAt === null && (
                      <form action={togglePublishAction} className="flex items-center gap-1">
                        <input type="hidden" name="table" value="announcements" />
                        <input type="hidden" name="id" value={ann.id} />
                        <input type="hidden" name="isPublished" value={ann.isPublished ? "off" : "on"} />
                        <button type="submit" className={btnPrimaryCls}>
                          {ann.isPublished ? "Unpublish" : "Publish"}
                        </button>
                      </form>
                    )}

                    {/* Delete / Restore */}
                    {ann.deletedAt === null ? (
                      <DeleteControls
                        action={softDeleteAnnouncementAction}
                        hiddenInputs={{ id: ann.id }}
                      />
                    ) : (
                      <RestoreControls
                        action={restoreAnnouncementAction}
                        hiddenInputs={{ id: ann.id }}
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
