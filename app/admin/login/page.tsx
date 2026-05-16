import { AppHeader } from "@/components/layout/app-header";

export default function AdminLoginPage() {
  return (
    <main className="min-h-screen bg-white">
      <AppHeader />
      <section className="px-5 py-10">
        <h1 className="text-3xl font-black tracking-[-0.06em]">Admin Login</h1>
        <form className="mt-8 space-y-4 rounded-[28px] bg-[#F7F8F8] p-5">
          <label className="block">
            <span className="text-sm font-bold">Email</span>
            <input name="email" type="email" className="mt-2 h-12 w-full rounded-2xl border border-[#E8E8E8] px-4" />
          </label>
          <label className="block">
            <span className="text-sm font-bold">Password</span>
            <input name="password" type="password" className="mt-2 h-12 w-full rounded-2xl border border-[#E8E8E8] px-4" />
          </label>
          <button className="h-12 w-full rounded-full bg-[#1A1A1A] text-sm font-black text-white" type="submit">
            로그인
          </button>
        </form>
      </section>
    </main>
  );
}
