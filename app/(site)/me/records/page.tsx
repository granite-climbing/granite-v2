import { AppHeader } from "@/components/layout/app-header";

export default function RecordsPage() {
  return (
    <main data-hide-site-footer className="min-h-screen bg-white pb-[90px]">
      <AppHeader />
      <section className="grid min-h-[70vh] place-items-center px-5 text-center">
        <div>
          <h1 className="text-3xl font-black tracking-[-0.06em]">기록</h1>
          <p className="mt-3 text-sm font-semibold text-[#6F7477]">완등 기록은 Phase 6에서 로그인과 함께 제공됩니다.</p>
        </div>
      </section>
    </main>
  );
}
