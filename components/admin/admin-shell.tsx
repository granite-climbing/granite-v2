import { Suspense } from "react";
import { AdminToaster } from "./admin-toaster";

/** Top-level wrapper for every admin content page. Forces desktop minimum width. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen min-w-[1024px] bg-[#F7F8F8] p-6 text-[#111827]">
      {children}
      <Suspense fallback={null}>
        <AdminToaster />
      </Suspense>
    </main>
  );
}
