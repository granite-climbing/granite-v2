import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdSlot } from "@/components/public/ad-slot";
import { RecordList } from "@/components/public/record-list";
import { RecordSendChart } from "@/components/public/record-send-chart";
import { RecordVideoGrid } from "@/components/public/record-video-grid";
import { RecordsProfileHeader } from "@/components/public/records-profile-header";
import { RecordsTabs, resolveRecordsTab } from "@/components/public/records-tabs";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import { findActiveUserById } from "@/lib/db/user-auth-queries";
import { getUserRecordsView } from "@/lib/records/user-records-view";

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
  const view = await getUserRecordsView(user);

  return (
    <main data-hide-site-footer className="min-h-screen bg-[#F7F8F8] pb-[90px] text-[#090909]">
      <RecordsProfileHeader profile={view.profile} totalSends={view.totalSends} highestGrade={view.highestGrade} />
      <RecordsTabs active={activeTab} />
      {activeTab === "record" ? (
        <div className="space-y-6 pt-6">
          <RecordSendChart buckets={view.gradeBuckets} />
          <RecordList records={view.recentRecords} />
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
        <RecordVideoGrid videos={view.videos} />
      )}
    </main>
  );
}
