import {
  getAdminRoutes,
  getAdminTopos,
  listAreaOptions,
  listCragOptionsByArea,
  listSectorOptionsByCrag,
  listBoulderOptionsBySector,
  listTopoOptionsByBoulder,
} from "@/lib/db/admin-read-queries";
import {
  saveRouteAction,
  softDeleteRouteAction,
  restoreRouteAction,
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
import Link from "next/link";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    areaId?: string;
    cragId?: string;
    sectorId?: string;
    boulderId?: string;
    topoId?: string;
    edit?: string;
  }>;
}

export default async function AdminRoutesPage({ searchParams }: Props) {
  const { areaId, cragId, sectorId, boulderId, topoId, edit } = await searchParams;
  const [routes, topos, areaOptions, cragOptions, sectorOptions, boulderOptions, topoOptions] =
    await Promise.all([
      getAdminRoutes({ areaId, cragId, sectorId, boulderId, topoId }),
      getAdminTopos({ areaId, cragId, sectorId, boulderId }),
      listAreaOptions(),
      areaId ? listCragOptionsByArea(areaId) : Promise.resolve([]),
      cragId ? listSectorOptionsByCrag(cragId) : Promise.resolve([]),
      sectorId ? listBoulderOptionsBySector(sectorId) : Promise.resolve([]),
      boulderId ? listTopoOptionsByBoulder(boulderId) : Promise.resolve([]),
    ]);
  const liveTopos = topos.filter((t) => t.deletedAt === null);
  const selectedTopo = topoId ? liveTopos.find((t) => t.id === topoId) : undefined;
  const editRow = edit ? routes.find((r) => r.id === edit) : undefined;

  // Build base href preserving active filters
  const filterParams = new URLSearchParams();
  if (areaId) filterParams.set("areaId", areaId);
  if (cragId) filterParams.set("cragId", cragId);
  if (sectorId) filterParams.set("sectorId", sectorId);
  if (boulderId) filterParams.set("boulderId", boulderId);
  if (topoId) filterParams.set("topoId", topoId);
  const filterString = filterParams.toString();
  const baseHref = filterString
    ? `/admin/content/routes?${filterString}`
    : "/admin/content/routes";

  return (
    <AdminShell>
      <h1 className="mb-6 text-2xl font-bold">Routes</h1>

      {/* Cascading parent filter */}
      <ParentFilter
        action="/admin/content/routes"
        current={{ areaId, cragId, sectorId, boulderId, topoId }}
        areaOptions={areaOptions}
        cragOptions={cragOptions.length > 0 ? cragOptions : undefined}
        sectorOptions={sectorOptions.length > 0 ? sectorOptions : undefined}
        boulderOptions={boulderOptions.length > 0 ? boulderOptions : undefined}
        topoOptions={topoOptions.length > 0 ? topoOptions : undefined}
      />

      {/* Create form */}
      <AdminCard title="Create Route">
        <form action={saveRouteAction} className="space-y-2">
          <FormSection title="Hierarchy" cols={2}>
            <FullWidth>
              <AdminField label="Topo">
                <select name="topoId" required defaultValue={topoId ?? ""} className={selectCls}>
                  <option value="">— select topo —</option>
                  {liveTopos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.boulderName} / {t.name}
                    </option>
                  ))}
                </select>
              </AdminField>
            </FullWidth>
          </FormSection>
          <FormSection title="Identity" cols={2}>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Name</label>
              <input name="name" required className={inputCls} placeholder="아나콘다" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Slug</label>
              <input name="slug" required className={inputCls} placeholder="anaconda" />
            </div>
          </FormSection>
          <FormSection title="Grade" cols={2}>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Grade</label>
              <input name="grade" required className={inputCls} placeholder="V5" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">Grade Num</label>
              <input name="gradeNum" type="number" className={inputCls} placeholder="auto-derived" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">FA</label>
              <input name="fa" className={inputCls} placeholder="홍길동" />
            </div>
          </FormSection>
          <FormSection title="Description" cols={1}>
            <FullWidth>
              <textarea name="description" className={textareaCls} rows={2} />
            </FullWidth>
          </FormSection>
          <FormSection title="Image" cols={1}>
            <FullWidth>
              <ImageUploadField name="lineImageUrl" defaultValue="" entityType="routes" entityId="new" purpose="line" />
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
          <input type="hidden" name="cragSlug" value={selectedTopo?.cragSlug ?? ""} />
          <input type="hidden" name="boulderId" value={selectedTopo?.boulderId ?? ""} />
          <div className="pt-2">
            <button type="submit" className={btnPrimaryCls}>Create Route</button>
          </div>
        </form>
      </AdminCard>

      {/* Routes list */}
      <div className="mt-6">
        <AdminCard title={`Routes (${routes.length})`}>
          <AdminTable headers={["ID", "Topo / Boulder", "Name", "Slug", "Grade", "Sort", "Status", "Actions"]}>
            {routes.map((route) => (
              <AdminTableRow key={route.id} deleted={route.deletedAt !== null}>
                <AdminTableCell className="font-mono text-xs text-[#57606A]">{route.id}</AdminTableCell>
                <AdminTableCell className="text-xs text-[#57606A]">
                  <div>{route.boulderName}</div>
                  <div className="text-[#0969DA]">{route.topoName}</div>
                </AdminTableCell>
                <AdminTableCell className="font-semibold">{route.name}</AdminTableCell>
                <AdminTableCell className="font-mono text-xs">{route.slug}</AdminTableCell>
                <AdminTableCell className="font-bold">{route.grade}</AdminTableCell>
                <AdminTableCell>{route.sortOrder}</AdminTableCell>
                <AdminTableCell>
                  <PublishBadge published={route.isPublished} deleted={route.deletedAt !== null} />
                </AdminTableCell>
                <AdminTableCell>
                  <div className="flex flex-col gap-1">
                    <Link
                      href={filterString ? `?${filterString}&edit=${route.id}` : `?edit=${route.id}`}
                      className={btnPrimaryCls}
                    >
                      Edit
                    </Link>

                    {route.deletedAt === null && (
                      <form action={togglePublishAction} className="flex items-center gap-1">
                        <input type="hidden" name="table" value="routes" />
                        <input type="hidden" name="id" value={route.id} />
                        <input type="hidden" name="isPublished" value={route.isPublished ? "off" : "on"} />
                        <button type="submit" className={btnPrimaryCls}>
                          {route.isPublished ? "Unpublish" : "Publish"}
                        </button>
                      </form>
                    )}

                    {route.deletedAt === null ? (
                      <DeleteControls
                        action={softDeleteRouteAction}
                        hiddenInputs={{
                          id: route.id,
                          cragSlug: route.cragSlug,
                          boulderId: route.boulderId,
                          topoId: route.topoId,
                        }}
                      />
                    ) : (
                      <RestoreControls
                        action={restoreRouteAction}
                        hiddenInputs={{
                          id: route.id,
                          cragSlug: route.cragSlug,
                          boulderId: route.boulderId,
                          topoId: route.topoId,
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
        <EditDrawer title="Edit Route" closeHref={baseHref}>
          <form action={saveRouteAction}>
            <input type="hidden" name="id" value={editRow.id} />
            <input type="hidden" name="cragSlug" value={editRow.cragSlug} />
            <input type="hidden" name="boulderId" value={editRow.boulderId} />
            <FormSection title="Hierarchy" cols={2}>
              <FullWidth>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Topo</label>
                <select name="topoId" defaultValue={editRow.topoId} className={selectCls}>
                  {liveTopos.map((t) => (
                    <option key={t.id} value={t.id}>{t.boulderName} / {t.name}</option>
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
            <FormSection title="Grade" cols={2}>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Grade</label>
                <input name="grade" required defaultValue={editRow.grade} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">Grade Num</label>
                <input name="gradeNum" type="number" defaultValue={editRow.gradeNum} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">FA</label>
                <input name="fa" defaultValue={editRow.fa} className={inputCls} />
              </div>
            </FormSection>
            <FormSection title="Description" cols={1}>
              <FullWidth>
                <textarea name="description" defaultValue={editRow.description} className={textareaCls} rows={3} />
              </FullWidth>
            </FormSection>
            <FormSection title="Image" cols={1}>
              <FullWidth>
                <ImageUploadField name="lineImageUrl" defaultValue={editRow.lineImageUrl ?? ""} entityType="routes" entityId={editRow.id} purpose="line" />
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
