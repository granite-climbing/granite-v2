"use client";

import { useState } from "react";
import { logoutFromGranite } from "@/lib/auth/logout";

export function LogoutButton() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  return (
    <button
      type="button"
      disabled={isLoggingOut}
      onClick={() => {
        setIsLoggingOut(true);
        void logoutFromGranite().finally(() => setIsLoggingOut(false));
      }}
      className="mt-6 h-11 w-full rounded-lg border border-[#E8E8E8] bg-white text-sm font-black text-[#1A1A1A] disabled:opacity-60"
    >
      로그아웃
    </button>
  );
}
