import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ProjectRoutesView } from "@/components/public/project-routes-view";
import { removeRouteProjectAction } from "@/lib/actions/project";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import { listSavedRoutesForUser } from "@/lib/db/project-queries";

export default async function ProjectsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifyUserSessionToken(token) : null;

  if (!session) {
    redirect("/login?returnTo=/me/projects");
  }

  const routes = await listSavedRoutesForUser(session.userId);

  return <ProjectRoutesView routes={routes} removeAction={removeRouteProjectAction} />;
}
