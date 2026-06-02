/**
 * ParentFilter — server component (no "use client").
 *
 * Renders cascading <select> elements inside a <form method="get"> so that
 * submitting the form updates URL search params without JavaScript.
 *
 * Only the option arrays that are passed as props are rendered. Pages pass
 * only the levels relevant to that entity:
 *   - Crag list: areaOptions
 *   - Sector list: areaOptions, cragOptions (filtered by current areaId if any)
 *   - Boulder list: areaOptions, cragOptions, sectorOptions
 *   - Topo list: areaOptions, cragOptions, sectorOptions, boulderOptions
 *   - Route list: areaOptions, cragOptions, sectorOptions, boulderOptions, topoOptions
 */

import { selectCls, btnPrimaryCls } from "./admin-field";

export type ParentOption = { id: string; name: string };

export type ParentFilterCurrent = {
  areaId?: string;
  cragId?: string;
  sectorId?: string;
  boulderId?: string;
  topoId?: string;
};

type ParentFilterProps = {
  /** Form action — the page URL without search params, e.g. "/admin/content/sectors" */
  action: string;
  /** Currently active filter values (from searchParams) */
  current: ParentFilterCurrent;
  areaOptions?: ParentOption[];
  cragOptions?: ParentOption[];
  sectorOptions?: ParentOption[];
  boulderOptions?: ParentOption[];
  topoOptions?: ParentOption[];
};

export function ParentFilter({
  action,
  current,
  areaOptions,
  cragOptions,
  sectorOptions,
  boulderOptions,
  topoOptions,
}: ParentFilterProps) {
  const hasAny =
    current.areaId ||
    current.cragId ||
    current.sectorId ||
    current.boulderId ||
    current.topoId;

  return (
    <form
      method="get"
      action={action}
      className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[#D0D7DE] bg-[#F6F8FA] px-3 py-2"
    >
      {areaOptions && (
        <div className="flex items-center gap-1">
          <label className="text-xs font-semibold text-[#57606A]" htmlFor="pf-area">
            Area
          </label>
          <select
            id="pf-area"
            name="areaId"
            defaultValue={current.areaId ?? ""}
            className={`${selectCls} w-40`}
          >
            <option value="">전체</option>
            {areaOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {cragOptions && cragOptions.length > 0 && (
        <div className="flex items-center gap-1">
          <label className="text-xs font-semibold text-[#57606A]" htmlFor="pf-crag">
            Crag
          </label>
          <select
            id="pf-crag"
            name="cragId"
            defaultValue={current.cragId ?? ""}
            className={`${selectCls} w-40`}
          >
            <option value="">전체</option>
            {cragOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {sectorOptions && sectorOptions.length > 0 && (
        <div className="flex items-center gap-1">
          <label className="text-xs font-semibold text-[#57606A]" htmlFor="pf-sector">
            Sector
          </label>
          <select
            id="pf-sector"
            name="sectorId"
            defaultValue={current.sectorId ?? ""}
            className={`${selectCls} w-40`}
          >
            <option value="">전체</option>
            {sectorOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {boulderOptions && boulderOptions.length > 0 && (
        <div className="flex items-center gap-1">
          <label className="text-xs font-semibold text-[#57606A]" htmlFor="pf-boulder">
            Boulder
          </label>
          <select
            id="pf-boulder"
            name="boulderId"
            defaultValue={current.boulderId ?? ""}
            className={`${selectCls} w-40`}
          >
            <option value="">전체</option>
            {boulderOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {topoOptions && topoOptions.length > 0 && (
        <div className="flex items-center gap-1">
          <label className="text-xs font-semibold text-[#57606A]" htmlFor="pf-topo">
            Topo
          </label>
          <select
            id="pf-topo"
            name="topoId"
            defaultValue={current.topoId ?? ""}
            className={`${selectCls} w-40`}
          >
            <option value="">전체</option>
            {topoOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <button type="submit" className={btnPrimaryCls}>
        필터 적용
      </button>

      {hasAny && (
        <a
          href={action}
          className="text-xs text-[#0969DA] hover:underline"
        >
          필터 초기화
        </a>
      )}
    </form>
  );
}
