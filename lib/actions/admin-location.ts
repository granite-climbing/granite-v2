"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import {
  convertW3wToCoordinates,
  What3WordsConfigError,
  What3WordsInvalidAddressError,
  What3WordsRequestError,
} from "@/lib/location/what3words";

const convertW3wInputSchema = z.object({
  words: z.string().trim().min(1, "Enter a what3words address."),
});

export type ConvertW3wToCoordinatesResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; message: string };

export async function convertW3wToCoordinatesAction(input: unknown): Promise<ConvertW3wToCoordinatesResult> {
  await requireAdmin();

  const parsed = convertW3wInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Enter a what3words address." };
  }

  try {
    const coordinates = await convertW3wToCoordinates(parsed.data.words);
    return { ok: true, ...coordinates };
  } catch (error) {
    if (
      error instanceof What3WordsConfigError ||
      error instanceof What3WordsInvalidAddressError ||
      error instanceof What3WordsRequestError
    ) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Could not convert this what3words address." };
  }
}
