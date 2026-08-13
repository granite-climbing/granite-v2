"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Toaster, showToast } from "@/components/public/toast";

/**
 * Reads the flash `?toast=` query param set by admin mutation redirects, shows it
 * as a toast, then strips the param so a refresh or Back doesn't replay it.
 */
export function AdminToaster() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const message = searchParams.get("toast");
    if (!message) {
      return;
    }

    showToast(message, "success");

    const next = new URLSearchParams(searchParams);
    next.delete("toast");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  return <Toaster />;
}
