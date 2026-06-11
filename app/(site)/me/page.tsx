import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { cookies } from "next/headers";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import { findActiveUserById } from "@/lib/db/user-auth-queries";
import { LogoutButton } from "./logout-button";

export default async function MePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifyUserSessionToken(token) : null;
  const user = session ? await findActiveUserById(session.userId) : null;

  if (!user) {
    return <LoggedOut />;
  }

  return (
    <main className="min-h-screen bg-white">
      <AppHeader />
      <section className="px-5 py-8">
        <p className="text-xs font-bold uppercase text-[#8B8F91]">Social Login</p>
        <h1 className="mt-2 text-3xl font-black">{user.displayName}</h1>
        <dl className="mt-6 space-y-3 text-sm font-semibold text-[#5F6467]">
          <div className="rounded-lg bg-[#F7F8F8] p-3">
            <dt className="text-xs font-black uppercase text-[#8B8F91]">User ID</dt>
            <dd className="mt-1 break-all">{user.id}</dd>
          </div>
          <div className="rounded-lg bg-[#F7F8F8] p-3">
            <dt className="text-xs font-black uppercase text-[#8B8F91]">Email</dt>
            <dd className="mt-1 break-all">{user.email ?? "not provided"}</dd>
          </div>
        </dl>
        <LogoutButton />
      </section>
      <BottomNav />
    </main>
  );
}

function LoggedOut() {
  return (
    <main className="min-h-screen bg-white">
      <AppHeader />
      <section className="grid min-h-[70vh] place-items-center px-5 text-center">
        <div>
          <h1 className="text-3xl font-black tracking-[-0.06em]">마이</h1>
          <p className="mt-3 text-sm font-semibold text-[#6F7477]">로그인 후 계정 정보를 확인할 수 있습니다.</p>
          <a
            href="/login"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-[#1A1A1A] px-5 text-sm font-black text-white"
          >
            로그인
          </a>
        </div>
      </section>
      <BottomNav />
    </main>
  );
}
