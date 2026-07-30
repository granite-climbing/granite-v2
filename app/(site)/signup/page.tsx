import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile/profile-form";
import { completeSignupAction } from "@/lib/actions/signup";
import { PENDING_SIGNUP_COOKIE_NAME, verifyPendingSignupToken } from "@/lib/auth/signup";

type SignupPageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const cookieStore = await cookies();
  const pendingToken = cookieStore.get(PENDING_SIGNUP_COOKIE_NAME)?.value;
  const pendingSignup = pendingToken ? await verifyPendingSignupToken(pendingToken) : null;
  if (!pendingSignup) redirect("/login?error=signup_expired");

  const params = (await searchParams) ?? {};
  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  return <main className="min-h-screen bg-black px-4 text-white"><section className="mx-auto min-h-screen w-full max-w-[390px] px-0 pb-12 pt-[74px]"><h1 className="text-[22px] font-black leading-[1.45] tracking-[-0.01em]">가입을 위한 정보를<br />입력해주세요.</h1>{error ? <p className="mt-4 text-[12px] font-semibold text-[#FF6868]">입력 정보를 다시 확인해주세요.</p> : null}<ProfileForm action={completeSignupAction} submitLabel="시작하기" /></section></main>;
}
