import { z } from "zod";
import { normalizeHandle } from "@/lib/beta/normalize";

const optionalNumberSchema = z.preprocess((value) => {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}, z.number().int().min(1).max(300).nullable());

const optionalTextSchema = z.preprocess((value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}, z.string().max(32).nullable());

const optionalYouTubeUrlSchema = z.preprocess((value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}, z.string().url().max(2_048).nullable()).refine((value) => {
  if (value === null) return true;

  const url = new URL(value);
  return (
    url.protocol === "https:" &&
    (url.hostname === "youtube.com" || url.hostname === "www.youtube.com") &&
    url.pathname !== "/"
  );
}, "YouTube channel URL must use youtube.com");

const profileInputSchema = z.object({
  nickname: z.string().trim().min(1).max(32),
  gender: z.enum(["male", "female"]),
  heightCm: optionalNumberSchema,
  apeIndexCm: optionalNumberSchema,
  weightKg: optionalNumberSchema,
  topBoulderingGrade: optionalTextSchema,
  topSportGrade: optionalTextSchema,
  youtubeUrl: optionalYouTubeUrlSchema
});

export type ProfileInput = {
  instagramId: string;
  gender: "male" | "female";
  heightCm: number | null;
  apeIndexCm: number | null;
  weightKg: number | null;
  topBoulderingGrade: string | null;
  topSportGrade: string | null;
  youtubeUrl: string | null;
};

export function parseProfileInput(formData: FormData): ProfileInput | null {
  const parsed = profileInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return null;

  const instagramId = normalizeHandle(parsed.data.nickname);
  if (!instagramId) return null;

  return {
    instagramId,
    gender: parsed.data.gender,
    heightCm: parsed.data.heightCm,
    apeIndexCm: parsed.data.apeIndexCm,
    weightKg: parsed.data.weightKg,
    topBoulderingGrade: parsed.data.topBoulderingGrade,
    topSportGrade: parsed.data.topSportGrade,
    youtubeUrl: parsed.data.youtubeUrl
  };
}
