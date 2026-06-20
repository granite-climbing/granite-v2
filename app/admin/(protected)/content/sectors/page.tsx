import {
  getAdminSectors,
  getAdminCrags,
  listAreaOptions,
  listCragOptionsByArea,
} from "@/lib/db/admin-read-queries";
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
import { ParentFilter } from "@/components/admin/parent-filter";
import { LocationCoordinateField } from "@/components/admin/location-coordinate-field";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ areaId?: string; cragId?: string; edit?: string; new?: string }>;
}

export default async function AdminSectorsPage({ searchParams }: Props) {
  const { areaId, cragId, edit, new: isNew } = await searchParams;
  const showCreate = isNew === "true";
  const [sectors, crags, areaOptions, cragOptions] = await Promise.all([
    getAdminSectors({ areaId, cragId }),
    getAdminCrags(areaId ? { areaId } : undefined),
    listAreaOptions(),
    listCragOptionsByArea(areaId),
  ]);
  const liveCrags = crags.filter((c) => c.deletedAt === null);
  const selectedCrag = cragId ? liveCrags.find((c) => c.id === cragId) : undefined;

  const editRow = edit ? sectors.find((s) => s.id === edit) : undefined;

  // Build base href preserving active filters
  const filterParams = new URLSearchParams();
  if (areaId) filterParams.set("areaId", areaId);
  if (cragId) filterParams.set("cragId", cragId);
  const filterString = filterParams.toString();
  const baseHref = filterString
    ? `/admin/content/sectors?${filterString}`
    : "/admin/content/sectors";

  // Build create href preserving filter + new=true
  const createParams = new URLSearchParams();
  if (areaId) createParams.set("areaId", areaId);
  if (cragId) createParams.set("cragId", cragId);
  createParams.set("new", "true");
  const createHref = `?${createParams.toString()}`;

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sectors</h1>
        <Link href={createHref} className={btnPrimaryCls}>+ New Sector</Link>
      </div>

      {/* Cascading parent filter */}
      <ParentFilter
        action="/admin/content/sectors"
        current={{ areaId, cragId }}
        areaOptions={areaOptions}
        cragOptions={cragOptions}
      />

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
                      href={filterString ? `?${filterString}&edit=${sector.id}` : `?edit=${sector.id}`}
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

      {/* Create drawer */}
      {showCreate ? (
        <EditDrawer title="Create Sector" closeHref={baseHref}>
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
              <LocationCoordinateField previewName="Sector location preview" />
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
        </EditDrawer>
      ) : null}

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
              <LocationCoordinateField
                latDefaultValue={editRow.lat ?? ""}
                lngDefaultValue={editRow.lng ?? ""}
                previewName={editRow.name}
              />
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
