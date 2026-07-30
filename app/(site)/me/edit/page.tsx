import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile/profile-form";
import { updateProfileAction } from "@/lib/actions/profile";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import { findActiveUserById } from "@/lib/db/user-auth-queries";

export default async function EditProfilePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifyUserSessionToken(token) : null;
  const user = session ? await findActiveUserById(session.userId) : null;
  if (!user) redirect("/login?returnTo=/me/edit");

  return <main className="min-h-screen bg-black px-4 text-white"><section className="mx-auto min-h-screen w-full max-w-[390px] px-0 pb-12 pt-[74px]"><h1 className="text-[22px] font-black leading-[1.45] tracking-[-0.01em]">프로필을<br />수정해주세요.</h1><ProfileForm action={updateProfileAction} submitLabel="수정 완료" initialValues={{ nickname: user.displayName, instagramId: user.instagramId, gender: user.gender, heightCm: user.heightCm, apeIndexCm: user.apeIndexCm, weightKg: user.weightKg, topBoulderingGrade: user.topBoulderingGrade, topSportGrade: user.topSportGrade, youtubeUrl: user.youtubeId }} /></section></main>;
}
