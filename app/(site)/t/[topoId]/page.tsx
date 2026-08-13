import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { findTopoById } from "@/lib/db/repository";
import { TopoNavArrow } from "@/components/public/topo-nav";
import { buildInstagramCaption } from "@/lib/beta/caption";
import { getApprovedBetaVideosByRoute } from "@/lib/db/beta-queries";
import { getRouteRecordRowsByRouteIds } from "@/lib/db/record-queries";
import { buildRouteRecordSummary, type RouteRecordSummary } from "@/lib/records/summary";
import { getPublishedAreas, parseHashtags } from "@/lib/db/queries";
import { RouteMoreActions } from "@/components/public/route-more-actions";
import { TopoBackButton } from "./topo-back-button";
import { removeRouteProjectAction, saveRouteProjectAction } from "@/lib/actions/project";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import { listFavoritedRouteIdsForUser } from "@/lib/db/project-queries";
import type { Route, TopoDetail } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

type TopoPageProps = {
  params: Promise<{ topoId: string }>;
  searchParams?: Promise<{ route?: string }>;
};

export default async function TopoPage({ params, searchParams }: TopoPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const topo = await findTopoById(resolvedParams.topoId);
  if (!topo) {
    notFound();
  }

  const selectedRoute = topo.routes.find((route) => route.id === resolvedSearchParams?.route);
  const imageUrl = selectedRoute?.lineImageUrl || topo.baseImageUrl;

  const [betaVideoEntries, areas, recordRowsByRouteId] = await Promise.all([
    Promise.all(topo.routes.map(async (route) => [route.id, await getApprovedBetaVideosByRoute(route.id)] as const)),
    getPublishedAreas(),
    getRouteRecordRowsByRouteIds(topo.routes.map((route) => route.id))
  ]);
  const betaVideosByRouteId = new Map(betaVideoEntries);
  const recordSummariesByRouteId = new Map<string, RouteRecordSummary>(
    topo.routes.map((route) => [
      route.id,
      buildRouteRecordSummary(recordRowsByRouteId.get(route.id) ?? [])
    ])
  );
  const areaName = areas.find((area) => area.id === topo.crag.areaId)?.name ?? null;

  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifyUserSessionToken(token) : null;
  const savedRouteIds = session
    ? await listFavoritedRouteIdsForUser(
        session.userId,
        topo.routes.map((route) => route.id)
      )
    : new Set<string>();

  return (
    <main className="min-h-screen bg-white text-[#090909]">
      <TopoHeader topo={topo} />
      <section
        className="relative h-[270px] bg-[#BABABA] bg-cover bg-center"
        style={{ backgroundImage: `url("${imageUrl}")` }}
      >
        <Link
          href={`/c/${topo.crag.slug}?tab=map&boulderId=${topo.boulder.id}`}
          className="absolute bottom-3 right-4 flex h-6 w-[88px] items-center justify-center rounded-full bg-[#2A2A2A]"
        >
          <span className="flex items-center gap-1 text-[12px] font-medium leading-4 text-white">
            <LocationIcon className="size-4" />
            <span>Location</span>
          </span>
        </Link>
      </section>
      <TopoRouteSheet
        topo={topo}
        selectedRoute={selectedRoute}
        betaVideosByRouteId={betaVideosByRouteId}
        recordSummariesByRouteId={recordSummariesByRouteId}
        areaName={areaName}
        savedRouteIds={savedRouteIds}
        isLoggedIn={Boolean(session)}
      />
    </main>
  );
}

function LocationIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path
        d="M11.2998 7.96647C12.4898 6.77653 12.9028 5.10372 12.5387 3.57864L14.202 2.8658C14.3713 2.79328 14.5672 2.87166 14.6397 3.04087C14.6575 3.08237 14.6667 3.12704 14.6667 3.17218V12.6667L10 14.6667L6 12.6667L1.79797 14.4675C1.62876 14.5401 1.43281 14.4617 1.36029 14.2925C1.3425 14.251 1.33333 14.2063 1.33333 14.1611V4.66667L3.41928 3.77269C3.13349 5.24421 3.56045 6.8268 4.70017 7.96647L8 11.2663L11.2998 7.96647ZM10.357 7.02367L8 9.38073L5.64298 7.02367C4.34123 5.72194 4.34123 3.61139 5.64298 2.30965C6.94473 1.00789 9.05527 1.00789 10.357 2.30965C11.6588 3.61139 11.6588 5.72194 10.357 7.02367Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TopoHeader({ topo }: { topo: TopoDetail }) {
  return (
    <header className="relative flex h-14 items-center justify-center bg-white">
      <TopoBackButton fallbackHref={`/c/${topo.crag.slug}?tab=route`} />
      <h1 className="text-[18px] font-medium leading-6 text-[#090909]">{topo.crag.name}</h1>
    </header>
  );
}

function TopoRouteSheet({
  topo,
  selectedRoute,
  betaVideosByRouteId,
  recordSummariesByRouteId,
  areaName,
  savedRouteIds,
  isLoggedIn,
}: {
  topo: TopoDetail;
  selectedRoute?: Route;
  betaVideosByRouteId: Map<string, Array<{ id: string; mediaUrl: string; thumbnailUrl: string | null; displayName: string }>>;
  recordSummariesByRouteId: Map<string, RouteRecordSummary>;
  areaName: string | null;
  savedRouteIds: Set<string>;
  isLoggedIn: boolean;
}) {
  return (
    <section className="bg-white px-4 pb-10 pt-2">
      <div className="mx-auto h-[2px] w-8 rounded-full bg-[#B8B8B8]" />
      <div className="mt-2 flex h-9 items-center justify-between">
        <TopoNavArrow topoId={topo.prevTopoId} direction="prev" />
        <h2 className="text-center text-[18px] font-medium leading-6 text-[#090909]">
          {topo.boulder.name} {topo.topoIndex}/{topo.topoCount}
        </h2>
        <TopoNavArrow topoId={topo.nextTopoId} direction="next" />
      </div>
      <div className="mt-3 border-y border-[#E8E8E8]">
        {topo.routes.map((route, index) => {
          const selected = route.id === selectedRoute?.id;
          const betaVideos = betaVideosByRouteId.get(route.id) ?? [];
          const caption = buildInstagramCaption({
            cragName: topo.crag.name,
            sectorName: topo.sector.name,
            boulderName: topo.boulder.name,
            routeName: route.name,
            grade: route.grade,
            boulderHashtags: parseHashtags(topo.boulder.hashtags),
          });
          return (
            <div
              key={route.id}
              className={`grid min-h-[88px] grid-cols-[24px_1fr_auto] items-center gap-2 border-b border-[#E8E8E8] px-2 last:border-b-0 ${
                selected ? "bg-[#F1F1F1]" : "bg-white"
              }`}
            >
              <Link
                href={selected ? `/t/${topo.id}` : `/t/${topo.id}?route=${route.id}`}
                replace
                className="contents"
              >
                <span className="grid size-6 place-items-center rounded-full bg-[#2A2A2A] text-[14px] font-medium leading-5 text-white">
                  {index + 1}
                </span>
                <span>
                  <span className="block text-[18px] font-medium leading-6 text-[#2A2A2A]">{route.name}</span>
                  {route.description ? (
                    <span className="mt-1 block whitespace-pre-line text-[10px] font-normal leading-[14px] text-[#7A7A7A]">
                      {route.description}
                    </span>
                  ) : null}
                  <span className="block text-[10px] font-normal leading-[14px] text-[#7A7A7A]">FA {route.fa}</span>
                </span>
              </Link>
              <span className="flex flex-col items-end gap-2">
                <span className="text-[18px] font-medium leading-6 text-[#2A2A2A]">{route.grade}</span>
                <RouteMoreActions
                  route={{
                    id: route.id,
                    name: route.name,
                    grade: route.grade,
                    fa: route.fa,
                    description: route.description
                  }}
                  breadcrumb={{
                    areaName,
                    cragName: topo.crag.name,
                    sectorName: topo.sector.name,
                    boulderName: topo.boulder.name
                  }}
                  caption={caption}
                  betaVideos={betaVideos}
                  recordSummary={recordSummariesByRouteId.get(route.id) ?? buildRouteRecordSummary([])}
                  saved={savedRouteIds.has(route.id)}
                  returnTo={`/t/${topo.id}?route=${route.id}`}
                  saveAction={saveRouteProjectAction}
                  removeAction={removeRouteProjectAction}
                  recordRoute={{
                    routeId: route.id,
                    routeName: route.name,
                    routeGrade: route.grade,
                    boulderName: topo.boulder.name,
                    sectorName: topo.sector.name,
                    cragName: topo.crag.name,
                    boulderHashtags: parseHashtags(topo.boulder.hashtags)
                  }}
                  isLoggedIn={isLoggedIn}
                />
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
