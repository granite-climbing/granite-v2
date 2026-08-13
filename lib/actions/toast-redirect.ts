import { headers } from "next/headers";
import { redirect } from "next/navigation";

// Human-facing label for each content type, embedded in the admin toast message.
export type ContentKind = "Area" | "Crag" | "Sector" | "Boulder" | "Topo" | "Route" | "Announcement";

const VERB = {
  create: "등록이 완료되었습니다",
  update: "수정이 완료되었습니다",
  delete: "삭제가 완료되었습니다",
  restore: "복구가 완료되었습니다",
  publish: "게시되었습니다",
  unpublish: "숨김 처리되었습니다",
} as const;

export type ToastVerb = keyof typeof VERB;

/**
 * Builds a message like `안양 Crag 등록이 완료되었습니다`. Falls back to the type
 * label alone when the entity has no name (should not normally happen).
 */
export function contentToastMessage(name: string, kind: ContentKind, verb: ToastVerb): string {
  const trimmed = name.trim();
  const label = trimmed ? `${trimmed} ${kind}` : kind;
  return `${label} ${VERB[verb]}`;
}

/**
 * Redirects back to the admin list the action was submitted from, carrying a
 * flash `toast` query param that <AdminToaster/> surfaces and then strips.
 *
 * The target is derived from the request `referer` so the current filter context
 * (areaId, cragId, …) is preserved, while `edit`/`new` are dropped so any open
 * drawer closes after the mutation. `redirect()` throws NEXT_REDIRECT, so this
 * must be the final call in an action and never sit inside a try/catch.
 */
export async function redirectWithToast(message: string): Promise<never> {
  const referer = (await headers()).get("referer");
  let base = "/admin/content";
  const params = new URLSearchParams();

  if (referer) {
    try {
      const url = new URL(referer);
      base = url.pathname;
      for (const [key, value] of url.searchParams) {
        if (key !== "edit" && key !== "new" && key !== "toast") {
          params.set(key, value);
        }
      }
    } catch {
      // Malformed referer — fall back to the default base path.
    }
  }

  params.set("toast", message);
  redirect(`${base}?${params.toString()}`);
}
