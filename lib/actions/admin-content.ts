"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { parseBoulderForm, parseCragForm, parseRouteForm } from "./admin-content-schema";

export async function saveCragAction(formData: FormData) {
  parseCragForm(Object.fromEntries(formData));
  revalidateTag("spots:list");
  revalidatePath("/");
}

export async function saveBoulderAction(formData: FormData) {
  parseBoulderForm(Object.fromEntries(formData));
  revalidateTag("spots:list");
  revalidatePath("/");
}

export async function saveRouteAction(formData: FormData) {
  parseRouteForm(Object.fromEntries(formData));
  revalidateTag("spots:list");
  revalidatePath("/");
}
