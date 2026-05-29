import { AppHeader } from "@/components/layout/app-header";
import { loginAdminAction } from "@/lib/actions/admin-auth";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const hasInvalidCredentials = resolvedSearchParams?.error === "invalid_credentials";

  return (
    <main className="min-h-screen bg-white">
      <AppHeader />
      <section className="px-5 py-10">
        <h1 className="text-3xl font-black">Admin Login</h1>
        <form action={loginAdminAction} className="mt-8 space-y-4 rounded-[8px] bg-[#F7F8F8] p-5">
          {hasInvalidCredentials ? (
            <p className="rounded-[8px] bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              이메일 또는 비밀번호가 올바르지 않습니다.
            </p>
          ) : null}
          <label className="block">
            <span className="text-sm font-bold">Email</span>
            <input name="email" type="email" required className="mt-2 h-12 w-full rounded-[8px] border border-[#E8E8E8] px-4" />
          </label>
          <label className="block">
            <span className="text-sm font-bold">Password</span>
            <input name="password" type="password" required className="mt-2 h-12 w-full rounded-[8px] border border-[#E8E8E8] px-4" />
          </label>
          <button className="h-12 w-full rounded-full bg-[#1A1A1A] text-sm font-black text-white" type="submit">
            로그인
          </button>
        </form>
      </section>
    </main>
  );
}
