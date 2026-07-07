import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { RecordClaimCandidates } from "@/components/public/record-claim-candidates";
import { RecordGradeDistribution } from "@/components/public/record-grade-distribution";
import { RecordList } from "@/components/public/record-list";
import { RecordSummary } from "@/components/public/record-summary";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import { normalizeHandle } from "@/lib/beta/normalize";
import {
  buildUserRecordsModel,
  getApprovedClaimCandidateRecordsByInstagramId,
  getApprovedRecordsByUserId
} from "@/lib/db/record-queries";
import { findActiveUserById } from "@/lib/db/user-auth-queries";

export default async function RecordsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifyUserSessionToken(token) : null;
  const user = session ? await findActiveUserById(session.userId) : null;

  if (!user) {
    redirect("/login?returnTo=/me/records");
  }

  const instagramId = user.instagramId ? normalizeHandle(user.instagramId) : null;
  const [records, claimCandidates] = await Promise.all([
    getApprovedRecordsByUserId(user.id),
    getApprovedClaimCandidateRecordsByInstagramId(instagramId)
  ]);
  const model = buildUserRecordsModel({ records, claimCandidates });

  return (
    <main data-hide-site-footer className="min-h-screen bg-[#F7F7F7] pb-[90px] text-[#050505]">
      <AppHeader />
      <section className="bg-white px-5 pb-5 pt-6">
        <h1 className="text-[28px] font-black leading-9 text-black">기록</h1>
        <p className="mt-1 text-[13px] font-semibold leading-5 text-[#6F7477]">
          승인된 완등 기록과 연결 가능한 Instagram 기록을 확인하세요.
        </p>
      </section>
      <RecordSummary summary={model.summary} />
      <div className="mt-2">
        <RecordGradeDistribution buckets={model.gradeBuckets} />
      </div>
      <div className="mt-2">
        <RecordList records={model.records} />
      </div>
      <div className="mt-2">
        <RecordClaimCandidates instagramId={instagramId} candidates={model.claimCandidates} />
      </div>
    </main>
  );
}
