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
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { EditDrawer } from "@/components/admin/edit-drawer";
import { FormSection, FullWidth } from "@/components/admin/form-section";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ cragId?: string; edit?: string }>;
}

export default async function AdminSectorsPage({ searchParams }: Props) {
  const { cragId, edit } = await searchParams;
  const [sectors, crags] = await Promise.all([
    getAdminSectors(cragId || undefined),
    getAdminCrags(),
  ]);
  const liveCrags = crags.filter((c) => c.deletedAt === null);
  const selectedCrag = cragId ? liveCrags.find((c) => c.id === cragId) : undefined;

  // For drawer we need all sectors (not filtered) so we can find by id across all crags
  // If edit id isn't in the filtered list, we still have it from the full fetch when no cragId filter.
  // The sectors list may be filtered; look for editRow in it first, otherwise it won't render.
  const editRow = edit ? sectors.find((s) => s.id === edit) : undefined;

  // Build base href preserving cragId filter
  const baseHref = cragId
    ? `/admin/content/sectors?cragId=${cragId}`
    : "/admin/content/sectors";

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
          <FormSection title="Hierarchy" cols={2}>
            <FullWidth>
              <AdminField label="Crag">
                <select name="cragId" required defaultValue={cragId ?? ""} className={selectCls}>
                  <option value="">— select crag —</option>
                  {liveCrags.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </AdminField>
            </FullWidth>
          </FormSection>
          <FormSection title="Identity" cols={2}>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Name</label>
              <input name="name" required className={inputCls} placeholder="앤틱 구역" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Name (EN)</label>
              <input name="nameEn" className={inputCls} placeholder="Antique Zone" />
            </div>
            <FullWidth>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Slug</label>
              <input name="slug" required className={inputCls} placeholder="anyang_antique" />
            </FullWidth>
          </FormSection>
          <FormSection title="Location" cols={2}>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Lat</label>
              <input name="lat" type="number" step="any" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Lng</label>
              <input name="lng" type="number" step="any" className={inputCls} />
            </div>
          </FormSection>
          <FormSection title="Content" cols={1}>
            <FullWidth>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Description</label>
              <textarea name="description" className={textareaCls} rows={2} />
            </FullWidth>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Season</label>
              <input name="season" className={inputCls} />
            </div>
          </FormSection>
          <FormSection title="Image" cols={1}>
            <FullWidth>
              <ImageUploadField name="coverImageUrl" defaultValue="" entityType="sectors" entityId="new" purpose="cover" />
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
                <AdminTableCell>
                  <div className="flex flex-col gap-1">
                    <Link
                      href={cragId ? `?cragId=${cragId}&edit=${sector.id}` : `?edit=${sector.id}`}
                      className={btnPrimaryCls}
                    >
                      Edit
                    </Link>

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

      {/* Edit drawer */}
      {editRow && (
        <EditDrawer title="Edit Sector" closeHref={baseHref}>
          <form action={saveSectorAction}>
            <input type="hidden" name="id" value={editRow.id} />
            <input type="hidden" name="cragSlug" value={editRow.cragSlug} />
            <FormSection title="Hierarchy" cols={2}>
              <FullWidth>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Crag</label>
                <select name="cragId" defaultValue={editRow.cragId} className={selectCls}>
                  {liveCrags.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
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
                <ImageUploadField name="coverImageUrl" defaultValue={editRow.coverImageUrl ?? ""} entityType="sectors" entityId={editRow.id} purpose="cover" />
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
