import {
  getAdminBoulders,
  getAdminSectors,
  listAreaOptions,
  listCragOptionsByArea,
  listSectorOptionsByCrag,
} from "@/lib/db/admin-read-queries";
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
import { ParentFilter } from "@/components/admin/parent-filter";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ areaId?: string; cragId?: string; sectorId?: string; edit?: string }>;
}

export default async function AdminBouldersPage({ searchParams }: Props) {
  const { areaId, cragId, sectorId, edit } = await searchParams;
  const [boulders, sectors, areaOptions, cragOptions, sectorOptions] = await Promise.all([
    getAdminBoulders({ areaId, cragId, sectorId }),
    getAdminSectors({ areaId, cragId }),
    listAreaOptions(),
    areaId ? listCragOptionsByArea(areaId) : Promise.resolve([]),
    cragId ? listSectorOptionsByCrag(cragId) : Promise.resolve([]),
  ]);
  const liveSectors = sectors.filter((s) => s.deletedAt === null);
  const selectedSector = sectorId ? liveSectors.find((s) => s.id === sectorId) : undefined;
  const editRow = edit ? boulders.find((b) => b.id === edit) : undefined;

  // Build base href preserving active filters
  const filterParams = new URLSearchParams();
  if (areaId) filterParams.set("areaId", areaId);
  if (cragId) filterParams.set("cragId", cragId);
  if (sectorId) filterParams.set("sectorId", sectorId);
  const filterString = filterParams.toString();
  const baseHref = filterString
    ? `/admin/content/boulders?${filterString}`
    : "/admin/content/boulders";

  return (
    <AdminShell>
      <h1 className="mb-6 text-2xl font-bold">Boulders</h1>

      {/* Cascading parent filter */}
      <ParentFilter
        action="/admin/content/boulders"
        current={{ areaId, cragId, sectorId }}
        areaOptions={areaOptions}
        cragOptions={cragOptions.length > 0 ? cragOptions : undefined}
        sectorOptions={sectorOptions.length > 0 ? sectorOptions : undefined}
      />

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
                      href={filterString ? `?${filterString}&edit=${boulder.id}` : `?edit=${boulder.id}`}
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
