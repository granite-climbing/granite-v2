import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";

export default function ProjectsPage() {
  return (
    <main className="min-h-screen bg-white">
      <AppHeader />
      <section className="grid min-h-[70vh] place-items-center px-5 text-center">
        <div>
          <h1 className="text-3xl font-black tracking-[-0.06em]">프로젝트</h1>
          <p className="mt-3 text-sm font-semibold text-[#6F7477]">Route 즐겨찾기는 Phase 3에서 제공됩니다.</p>
        </div>
      </section>
      <BottomNav />
    </main>
  );
}
