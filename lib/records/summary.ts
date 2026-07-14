/**
 * Pure aggregation helpers for route-level record summaries (루트 평가 ·
 * 체감 난이도 · Ascents comment). Client-safe: no DB imports — the rows come
 * from `lib/db/record-queries.getRouteRecordRowsByRouteIds`.
 */

/** Highest felt-grade bucket — V12 and above collapse into "V12+". */
export const FELT_GRADE_MAX = 12;

export type RouteRecordRow = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  sentAt: string;
  createdAt: string;
  rating: number | null;
  feltGradeNum: number | null;
  comment: string | null;
};

export type RouteRecordComment = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  sentAt: string;
  body: string;
  feltGrade: string | null;
  rating: number | null;
};

export type RouteRecordSummary = {
  /** Total record count for the route. */
  ascents: number;
  ratingCount: number;
  /** Average star rating rounded to 1 decimal, null when no ratings. */
  averageRating: number | null;
  /** 0-5 — averageRating rounded for star display. */
  stars: number;
  /** Average felt grade rounded to 1 decimal, null when no felt votes. */
  feelsGradeNum: number | null;
  /** e.g. "Solid V4", "Soft V5", "Hard V3" — null when no felt votes. */
  consensusLabel: string | null;
  /** Felt-grade vote buckets ordered by grade; ratio is count / max count. */
  feltDistribution: Array<{ grade: string; count: number; ratio: number }>;
  comments: RouteRecordComment[];
};

/** V-scale label for a felt grade number (0 → "V0", 12+ → "V12+"). */
export function formatFeltGrade(gradeNum: number): string {
  const n = Math.min(Math.max(Math.round(gradeNum), 0), FELT_GRADE_MAX);
  return n >= FELT_GRADE_MAX ? `V${FELT_GRADE_MAX}+` : `V${n}`;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Consensus wording for the average felt grade: within ±0.25 of the nearest
 * grade it's "Solid"; a rounded-up average (e.g. 4.7 → V5) reads "Soft",
 * a rounded-down one (e.g. 4.3 → V4) reads "Hard".
 */
export function formatConsensusLabel(averageFeltGradeNum: number): string {
  const base = Math.round(averageFeltGradeNum);
  const delta = averageFeltGradeNum - base;
  const word = delta < -0.25 ? "Soft" : delta > 0.25 ? "Hard" : "Solid";
  return `${word} ${formatFeltGrade(base)}`;
}

/** Relative time like the Figma mock ("today", "3 days ago", "7 months ago"). */
export function formatTimeAgo(dateString: string, now: Date = new Date()): string {
  const date = new Date(`${dateString.slice(0, 10)}T00:00:00`);
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.floor((now.getTime() - date.getTime()) / dayMs);
  if (days <= 0) return "today";
  if (days < 31) return days === 1 ? "1 day ago" : `${days} days ago`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return months === 1 ? "1 month ago" : `${months} months ago`;
  const years = Math.floor(days / 365.25);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

export function buildRouteRecordSummary(rows: RouteRecordRow[]): RouteRecordSummary {
  const ratings = rows
    .map((row) => row.rating)
    .filter((value): value is number => value !== null);
  const feltGrades = rows
    .map((row) => row.feltGradeNum)
    .filter((value): value is number => value !== null);

  const averageRating =
    ratings.length > 0
      ? round1(ratings.reduce((sum, value) => sum + value, 0) / ratings.length)
      : null;
  const feelsGradeNum =
    feltGrades.length > 0
      ? round1(feltGrades.reduce((sum, value) => sum + value, 0) / feltGrades.length)
      : null;

  const feltCounts = new Map<number, number>();
  for (const grade of feltGrades) {
    feltCounts.set(grade, (feltCounts.get(grade) ?? 0) + 1);
  }
  const maxFeltCount = Math.max(...feltCounts.values(), 1);
  const feltDistribution = Array.from(feltCounts.entries())
    .sort(([a], [b]) => a - b)
    .map(([gradeNum, count]) => ({
      grade: formatFeltGrade(gradeNum),
      count,
      ratio: count / maxFeltCount,
    }));

  const comments: RouteRecordComment[] = rows
    .filter((row): row is RouteRecordRow & { comment: string } => Boolean(row.comment))
    .map((row) => ({
      id: row.id,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      sentAt: row.sentAt,
      body: row.comment,
      feltGrade: row.feltGradeNum !== null ? formatFeltGrade(row.feltGradeNum) : null,
      rating: row.rating,
    }));

  return {
    ascents: rows.length,
    ratingCount: ratings.length,
    averageRating,
    stars: averageRating !== null ? Math.round(averageRating) : 0,
    feelsGradeNum,
    consensusLabel: feelsGradeNum !== null ? formatConsensusLabel(feelsGradeNum) : null,
    feltDistribution,
    comments,
  };
}
