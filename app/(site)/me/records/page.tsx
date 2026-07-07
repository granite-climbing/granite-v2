import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdSlot } from "@/components/public/ad-slot";
import { RecordList } from "@/components/public/record-list";
import { RecordSendChart } from "@/components/public/record-send-chart";
import { RecordVideoGrid } from "@/components/public/record-video-grid";
import { RecordsProfileHeader } from "@/components/public/records-profile-header";
import { RecordsTabs, resolveRecordsTab } from "@/components/public/records-tabs";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import { normalizeHandle } from "@/lib/beta/normalize";
import { findActiveUserById } from "@/lib/db/user-auth-queries";
import { MOCK_RECORDS_MODEL } from "@/lib/mock/records";

// 프로필에 없는 신체 정보의 Phase 9 mock 기본값. Phase 10에서 실데이터로 교체.
const MOCK_HEIGHT_CM = 182;
const MOCK_REACH_CM = 178;

type RecordsPageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

export default async function RecordsPage({ searchParams }: RecordsPageProps) {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifyUserSessionToken(token) : null;
  const user = session ? await findActiveUserById(session.userId) : null;

  if (!user) {
    redirect("/login?returnTo=/me/records");
  }

  const activeTab = resolveRecordsTab((await searchParams)?.tab);
  const instagramId = user.instagramId ? normalizeHandle(user.instagramId) : null;
  const heightCm = user.heightCm ?? MOCK_HEIGHT_CM;
  const reachCm = user.heightCm !== null && user.apeIndexCm !== null ? user.heightCm + user.apeIndexCm : MOCK_REACH_CM;
  const model = MOCK_RECORDS_MODEL;

  return (
    <main data-hide-site-footer className="min-h-screen bg-[#F7F8F8] pb-[90px] text-[#090909]">
      <RecordsProfileHeader
        displayName={user.displayName}
        instagramId={instagramId}
        avatarUrl={user.avatarUrl}
        reachCm={reachCm}
        heightCm={heightCm}
        weightKg={model.weightKg}
        totalSends={model.totalSends}
        highestGrade={model.highestGrade}
      />
      <RecordsTabs active={activeTab} />
      {activeTab === "record" ? (
        <div className="space-y-6 pt-6">
          <RecordSendChart buckets={model.gradeBuckets} />
          <RecordList records={model.recentRecords} />
          <section className="px-4">
            <button
              type="button"
              disabled
              title="세부 분석은 준비중입니다."
              className="flex h-14 w-full items-center justify-between rounded-[8px] bg-white px-4"
            >
              <span className="text-[16px] font-bold leading-6 text-[#090909]">세부 분석</span>
              <svg aria-hidden viewBox="0 0 24 24" className="size-6 fill-none stroke-[#090909]" strokeWidth="1.6">
                <path d="M4 12h16M14 6l6 6-6 6" />
              </svg>
            </button>
          </section>
          <AdSlot />
        </div>
      ) : (
        <RecordVideoGrid videos={model.videos} />
      )}
    </main>
  );
}
