import { notFound, redirect } from "next/navigation";
import { findRouteById } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

type RoutePageProps = {
  params: Promise<{ routeId: string }>;
};

export default async function RoutePage({ params }: RoutePageProps) {
  const resolvedParams = await params;
  const route = await findRouteById(resolvedParams.routeId);
  if (!route) {
    notFound();
  }

  redirect(`/topos/${route.topoId}?route=${route.id}`);
}
