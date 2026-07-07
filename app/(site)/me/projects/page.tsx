import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { ProjectRouteCard } from "@/components/public/project-route-card";
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

  return (
    <main data-hide-site-footer className="min-h-screen bg-white pb-[90px]">
      <AppHeader />
      <section className="px-5 pb-4 pt-6">
        <h1 className="text-[28px] font-black leading-9 text-black">프로젝트</h1>
        <p className="mt-1 text-[13px] font-semibold leading-5 text-[#6F7477]">
          다음에 오를 Route를 저장하고 한곳에서 확인하세요.
        </p>
      </section>
      {routes.length > 0 ? (
        <section aria-label="저장한 프로젝트">
          {routes.map((route) => (
            <ProjectRouteCard key={route.favoriteId} route={route} removeAction={removeRouteProjectAction} />
          ))}
        </section>
      ) : (
        <section className="grid min-h-[50vh] place-items-center px-5 text-center">
          <div>
            <h2 className="text-[20px] font-black leading-7 text-black">저장한 프로젝트가 없습니다</h2>
            <p className="mt-2 text-[13px] font-semibold leading-5 text-[#6F7477]">
              Route 상세에서 프로젝트 저장을 누르면 이곳에 표시됩니다.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
