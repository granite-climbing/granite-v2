import { logoutAction } from "@/lib/actions/logout";

export function LogoutButton() {
  return (
    <form action={logoutAction} className="mt-6">
      <button
        type="submit"
        className="h-11 w-full rounded-lg border border-[#E8E8E8] bg-white text-sm font-black text-[#1A1A1A]"
      >
        로그아웃
      </button>
    </form>
  );
}
