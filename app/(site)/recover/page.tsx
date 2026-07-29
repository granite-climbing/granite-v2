import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cancelRecoveryAction, restoreAccountAction } from "@/lib/actions/recover";
import { PENDING_RECOVERY_COOKIE_NAME, verifyPendingRecoveryToken } from "@/lib/auth/recovery";
import { getScheduledDeletionAt, getWithdrawalStatus } from "@/lib/auth/withdrawal";
import { findWithdrawnUserById } from "@/lib/db/user-auth-queries";
import { formatDateDots } from "@/lib/format/date";

export default async function RecoverPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_RECOVERY_COOKIE_NAME)?.value;
  const pending = token ? await verifyPendingRecoveryToken(token) : null;

  if (!pending) {
    redirect("/login");
  }

  const user = await findWithdrawnUserById(pending.userId);
  if (!user || !user.withdrawAt) {
    redirect("/login?error=recovery_unavailable");
  }

  if (getWithdrawalStatus(user.withdrawAt, new Date()) !== "recoverable") {
    redirect("/login?error=recovery_expired");
  }

  const withdrawnOn = formatDateDots(user.withdrawAt);
  const deletionOn = formatDateDots(getScheduledDeletionAt(user.withdrawAt).toISOString());

  return (
    <main data-hide-site-footer className="min-h-screen bg-black px-5 text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col justify-center pb-11">
        <h1 className="text-[20px] font-semibold leading-[28px]">탈퇴 신청된 계정입니다.</h1>
        <p className="mt-3 text-[15px] font-medium leading-[22px] text-[#B9B9B9]">
          복구하시겠습니까?
        </p>

        <dl className="mt-7 space-y-2 rounded-[10px] bg-white/5 p-4 text-[13px] font-medium">
          <div className="flex justify-between">
            <dt className="text-[#B9B9B9]">계정</dt>
            <dd>{user.displayName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#B9B9B9]">탈퇴 신청일</dt>
            <dd>{withdrawnOn}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#B9B9B9]">삭제 예정일</dt>
            <dd>{deletionOn}</dd>
          </div>
        </dl>

        <p className="mt-4 text-[12px] font-medium leading-[18px] text-[#8A8A8A]">
          삭제 예정일이 지나면 데이터가 일괄 삭제되어 복구할 수 없습니다.
        </p>

        <div className="mt-8 space-y-3">
          <form action={restoreAccountAction}>
            <button
              type="submit"
              className="h-[52px] w-full rounded-[8px] bg-white text-[15px] font-semibold text-black"
            >
              복구하기
            </button>
          </form>
          <form action={cancelRecoveryAction}>
            <button
              type="submit"
              className="h-[52px] w-full rounded-[8px] border border-white/20 text-[15px] font-semibold text-white"
            >
              아니요
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
