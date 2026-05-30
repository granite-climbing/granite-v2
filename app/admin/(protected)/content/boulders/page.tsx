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
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { EditDrawer } from "@/components/admin/edit-drawer";
import { FormSection, FullWidth } from "@/components/admin/form-section";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ sectorId?: string; edit?: string }>;
}

export default async function AdminBouldersPage({ searchParams }: Props) {
  const { sectorId, edit } = await searchParams;
  const [boulders, sectors] = await Promise.all([
    getAdminBoulders(sectorId || undefined),
    getAdminSectors(),
  ]);
  const liveSectors = sectors.filter((s) => s.deletedAt === null);
  const selectedSector = sectorId ? liveSectors.find((s) => s.id === sectorId) : undefined;
  const editRow = edit ? boulders.find((b) => b.id === edit) : undefined;

  // Build base href preserving sectorId filter
  const baseHref = sectorId
    ? `/admin/content/boulders?sectorId=${sectorId}`
    : "/admin/content/boulders";

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
          <FormSection title="Hierarchy" cols={2}>
            <FullWidth>
              <AdminField label="Sector">
                <select name="sectorId" required defaultValue={sectorId ?? ""} className={selectCls}>
                  <option value="">— select sector —</option>
                  {liveSectors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.cragName} / {s.name}
                    </option>
                  ))}
                </select>
              </AdminField>
            </FullWidth>
          </FormSection>
          <FormSection title="Identity" cols={2}>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Name</label>
              <input name="name" required className={inputCls} placeholder="고물 볼더" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Slug</label>
              <input name="slug" required className={inputCls} placeholder="gomul_boulder" />
            </div>
          </FormSection>
          <FormSection title="Location" cols={2}>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Lat (required)</label>
              <input name="lat" type="number" step="any" required className={inputCls} placeholder="37.42" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Lng (required)</label>
              <input name="lng" type="number" step="any" required className={inputCls} placeholder="126.92" />
            </div>
          </FormSection>
          <FormSection title="Tags" cols={1}>
            <FullWidth>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Hashtags</label>
              <input name="hashtags" className={inputCls} placeholder="#모락산, 슬랩" />
            </FullWidth>
          </FormSection>
          <FormSection title="Image" cols={1}>
            <FullWidth>
              <ImageUploadField name="coverImageUrl" defaultValue="" entityType="boulders" entityId="new" purpose="cover" />
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
          <AdminTable headers={["ID", "Sector", "Name", "Slug", "Sort", "Status", "Actions"]}>
            {boulders.map((boulder) => (
              <AdminTableRow key={boulder.id} deleted={boulder.deletedAt !== null}>
                <AdminTableCell className="font-mono text-xs text-[#57606A]">{boulder.id}</AdminTableCell>
                <AdminTableCell className="text-xs text-[#57606A]">
                  <div>{boulder.cragName}</div>
                  <div>{boulder.sectorName}</div>
                </AdminTableCell>
                <AdminTableCell className="font-semibold">{boulder.name}</AdminTableCell>
                <AdminTableCell className="font-mono text-xs">{boulder.slug}</AdminTableCell>
                <AdminTableCell>{boulder.sortOrder}</AdminTableCell>
                <AdminTableCell>
                  <PublishBadge published={boulder.isPublished} deleted={boulder.deletedAt !== null} />
                </AdminTableCell>
                <AdminTableCell>
                  <div className="flex flex-col gap-1">
                    <Link
                      href={sectorId ? `?sectorId=${sectorId}&edit=${boulder.id}` : `?edit=${boulder.id}`}
                      className={btnPrimaryCls}
                    >
                      Edit
                    </Link>

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

      {/* Edit drawer */}
      {editRow && (
        <EditDrawer title="Edit Boulder" closeHref={baseHref}>
          <form action={saveBoulderAction}>
            <input type="hidden" name="id" value={editRow.id} />
            <input type="hidden" name="cragSlug" value={editRow.cragSlug} />
            <input type="hidden" name="sectorSlug" value={editRow.sectorSlug} />
            <FormSection title="Hierarchy" cols={2}>
              <FullWidth>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Sector</label>
                <select name="sectorId" defaultValue={editRow.sectorId} className={selectCls}>
                  {liveSectors.map((s) => (
                    <option key={s.id} value={s.id}>{s.cragName} / {s.name}</option>
                  ))}
                </select>
              </FullWidth>
            </FormSection>
            <FormSection title="Identity" cols={2}>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Name</label>
                <input name="name" required defaultValue={editRow.name} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Slug</label>
                <input name="slug" required defaultValue={editRow.slug} className={inputCls} />
              </div>
            </FormSection>
            <FormSection title="Location" cols={2}>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Lat (required)</label>
                <input name="lat" type="number" step="any" required defaultValue={editRow.lat} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Lng (required)</label>
                <input name="lng" type="number" step="any" required defaultValue={editRow.lng} className={inputCls} />
              </div>
            </FormSection>
            <FormSection title="Tags" cols={1}>
              <FullWidth>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Hashtags</label>
                <input
                  name="hashtags"
                  defaultValue={(() => {
                    try {
                      const parsed = JSON.parse(editRow.hashtags) as string[];
                      return parsed.map((t) => `#${t}`).join(", ");
                    } catch {
                      return editRow.hashtags;
                    }
                  })()}
                  className={inputCls}
                  placeholder="#모락산, 슬랩"
                />
              </FullWidth>
            </FormSection>
            <FormSection title="Image" cols={1}>
              <FullWidth>
                <ImageUploadField name="coverImageUrl" defaultValue={editRow.coverImageUrl ?? ""} entityType="boulders" entityId={editRow.id} purpose="cover" />
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
