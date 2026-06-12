import { cookies } from "next/headers";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import { findActiveUserById, findOAuthIdentitiesByUserId } from "@/lib/db/user-auth-queries";
import { buildMePageModel } from "./me-page-model";
import { MyPageContent, MyPageHeader } from "./me-page-content";
import { LogoutButton } from "./logout-button";

export default async function MePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifyUserSessionToken(token) : null;
  const user = session ? await findActiveUserById(session.userId) : null;

  if (!user) {
    return <LoggedOut />;
  }

  const identities = await findOAuthIdentitiesByUserId(user.id);
  const model = buildMePageModel(user, identities);

  return <MyPageContent model={model} logoutSlot={<LogoutButton />} />;
}

function LoggedOut() {
  return (
    <main data-hide-site-footer className="min-h-screen bg-[#F7F7F7] pb-[90px] text-[#050505]">
      <MyPageHeader />
      <section className="grid min-h-[70vh] place-items-center px-5 text-center">
        <div>
          <h2 className="text-[22px] font-bold">로그인이 필요합니다.</h2>
          <p className="mt-3 text-sm font-medium text-[#6F7477]">로그인 후 계정 정보를 확인할 수 있습니다.</p>
          <a
            href="/login"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-[#1A1A1A] px-5 text-sm font-black text-white"
          >
            로그인
          </a>
        </div>
      </section>
    </main>
  );
}
