export const GRADE_LABELS = [
  "V0",
  "V1",
  "V2",
  "V3",
  "V4",
  "V5",
  "V6",
  "V7",
  "V8",
  "V9",
  "V10",
  "V11+",
] as const;

export const GRADE_BUCKET_COUNT = GRADE_LABELS.length;

export function bucketGradeNums(
  items: ReadonlyArray<{ gradeNum: number }>
): number[] {
  const bars = Array.from({ length: GRADE_BUCKET_COUNT }, () => 0);
  for (const item of items) {
    const n = Math.floor(item.gradeNum);
    if (!Number.isFinite(n) || n < 0) continue;
    const idx = n >= GRADE_BUCKET_COUNT - 1 ? GRADE_BUCKET_COUNT - 1 : n;
    bars[idx] += 1;
  }
  return bars;
}
