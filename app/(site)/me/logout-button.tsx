import { logoutAction } from "@/lib/actions/logout";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="text-[14px] font-medium text-[#FF1F1F]">
        로그아웃
      </button>
    </form>
  );
}
