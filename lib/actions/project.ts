"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import {
  addRouteFavorite,
  findPublishedRouteForFavorite,
  removeRouteFavorite
} from "@/lib/db/project-queries";

export type ProjectActionResult = {
  ok: boolean;
  message: string;
};

function sanitizeReturnTo(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/me/projects";
  }

  return value;
}

const projectRouteSchema = z.object({
  routeId: z.string().min(1),
  returnTo: z
    .string()
    .min(1)
    .default("/me/projects")
    .transform((value) => sanitizeReturnTo(value))
});

async function requireUserSessionOrRedirect(returnTo: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifyUserSessionToken(token) : null;

  if (!session) {
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  return session;
}

function revalidateProjectPaths(returnTo: string) {
  revalidatePath("/me/projects");
  // revalidatePath ignores query strings, so revalidate the pathname only.
  revalidatePath(new URL(returnTo, "http://localhost").pathname);
}

export async function saveRouteProjectAction(formData: FormData): Promise<ProjectActionResult> {
  const parsed = projectRouteSchema.parse(Object.fromEntries(formData));
  const session = await requireUserSessionOrRedirect(parsed.returnTo);
  const route = await findPublishedRouteForFavorite(parsed.routeId);

  if (!route) {
    return { ok: false, message: "저장할 수 없는 루트입니다." };
  }

  await addRouteFavorite(session.userId, parsed.routeId);
  revalidateProjectPaths(parsed.returnTo);

  return { ok: true, message: "프로젝트에 저장했습니다." };
}

export async function removeRouteProjectAction(formData: FormData): Promise<ProjectActionResult> {
  const parsed = projectRouteSchema.parse(Object.fromEntries(formData));
  const session = await requireUserSessionOrRedirect(parsed.returnTo);

  await removeRouteFavorite(session.userId, parsed.routeId);
  revalidateProjectPaths(parsed.returnTo);

  return { ok: true, message: "프로젝트에서 제거했습니다." };
}
