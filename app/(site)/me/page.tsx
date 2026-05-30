import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";

export default function MePage() {
  return <ComingSoon title="마이" />;
}

function ComingSoon({ title }: { title: string }) {
  return (
    <main className="min-h-screen bg-white">
      <AppHeader />
      <section className="grid min-h-[70vh] place-items-center px-5 text-center">
        <div>
          <h1 className="text-3xl font-black tracking-[-0.06em]">{title}</h1>
          <p className="mt-3 text-sm font-semibold text-[#6F7477]">로그인/개인화 기능은 Phase 3 범위입니다.</p>
        </div>
      </section>
      <BottomNav />
    </main>
  );
}
