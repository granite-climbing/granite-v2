import { notFound, redirect } from "next/navigation";
import { findRouteById } from "@/lib/db/repository";

type RoutePageProps = {
  params: Promise<{ routeId: string }>;
};

export default async function RoutePage({ params }: RoutePageProps) {
  const resolvedParams = await params;
  const route = findRouteById(resolvedParams.routeId);
  if (!route) {
    notFound();
  }

  redirect(`/topos/${route.topoId}?route=${route.id}`);
}
