import { queryD1 } from "./d1-http";
import type {
  RouteSearchRowForRecord,
  UserRecordClaimCandidate,
  UserRecordGradeBucket,
  UserRecordListItem,
  UserRecordWithRoute,
  UserRecordsModel
} from "./schema";

type PartialRecordForBucket = Pick<UserRecordListItem, "routeGrade" | "routeGradeNum">;

const APPROVED_RECORD_SELECT = `
  be.id AS betaId,
  r.id AS routeId,
  r.topo_id AS topoId,
  r.name AS routeName,
  r.grade AS routeGrade,
  r.grade_num AS routeGradeNum,
  b.name AS boulderName,
  s.name AS sectorName,
  c.name AS cragName,
  be.platform,
  COALESCE(be.permalink_url, be.media_url) AS mediaUrl,
  be.thumbnail_url AS thumbnailUrl,
  be.sent_at AS sentAt,
  be.display_name AS displayName
`;

const PUBLISHED_ROUTE_JOIN = `
  JOIN routes r ON r.id = be.route_id
  JOIN topos t ON t.id = r.topo_id
  JOIN boulders b ON b.id = t.boulder_id
  JOIN sectors s ON s.id = b.sector_id
  JOIN crags c ON c.id = s.crag_id
  JOIN areas a ON a.id = c.area_id
`;

const PUBLISHED_ROUTE_FILTER = `
  AND r.is_published = 1
  AND t.is_published = 1
  AND b.is_published = 1
  AND s.is_published = 1
  AND c.is_published = 1
  AND a.is_published = 1
  AND r.deleted_at IS NULL
  AND t.deleted_at IS NULL
  AND b.deleted_at IS NULL
  AND s.deleted_at IS NULL
  AND c.deleted_at IS NULL
  AND a.deleted_at IS NULL
`;

export async function getApprovedRecordsByUserId(userId: string): Promise<UserRecordListItem[]> {
  return queryD1<UserRecordListItem>(
    `SELECT
       ${APPROVED_RECORD_SELECT}
     FROM betas be
     ${PUBLISHED_ROUTE_JOIN}
     WHERE be.user_id = ?
       AND be.status = 'approved'
       AND be.deleted_at IS NULL
       ${PUBLISHED_ROUTE_FILTER}
     ORDER BY be.sent_at DESC, be.created_at DESC`,
    [userId]
  );
}

export async function getApprovedClaimCandidateRecordsByInstagramId(
  instagramId: string | null
): Promise<UserRecordClaimCandidate[]> {
  if (!instagramId) {
    return [];
  }

  return queryD1<UserRecordClaimCandidate>(
    `SELECT
       ${APPROVED_RECORD_SELECT},
       be.instagram_id AS instagramId,
       be.claim_status AS claimStatus
     FROM betas be
     ${PUBLISHED_ROUTE_JOIN}
     WHERE be.user_id IS NULL
       AND be.instagram_id = ?
       AND be.platform = 'instagram'
       AND be.status = 'approved'
       AND be.claim_status = 'unclaimed'
       AND be.deleted_at IS NULL
       ${PUBLISHED_ROUTE_FILTER}
     ORDER BY be.sent_at DESC, be.created_at DESC`,
    [instagramId]
  );
}

export type InsertUserRecordInput = {
  id: string;
  userId: string;
  routeId: string;
  betaId: string | null;
  sentAt: string;
  rating: number | null;
};

export async function insertUserRecord(input: InsertUserRecordInput): Promise<void> {
  await queryD1(
    `INSERT INTO user_records (id, user_id, route_id, beta_id, sent_at, rating)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.id, input.userId, input.routeId, input.betaId, input.sentAt, input.rating]
  );
}

const USER_RECORD_ROUTE_JOIN = `
  JOIN routes r ON r.id = ur.route_id
  JOIN topos t ON t.id = r.topo_id
  JOIN boulders b ON b.id = t.boulder_id
  JOIN sectors s ON s.id = b.sector_id
  JOIN crags c ON c.id = s.crag_id
  JOIN areas a ON a.id = c.area_id
`;

export async function getUserRecordsByUserId(userId: string): Promise<UserRecordWithRoute[]> {
  return queryD1<UserRecordWithRoute>(
    `SELECT
       ur.id AS recordId,
       r.id AS routeId,
       r.topo_id AS topoId,
       r.name AS routeName,
       r.grade AS routeGrade,
       r.grade_num AS routeGradeNum,
       b.name AS boulderName,
       s.name AS sectorName,
       c.name AS cragName,
       ur.sent_at AS sentAt,
       ur.rating AS rating
     FROM user_records ur
     ${USER_RECORD_ROUTE_JOIN}
     WHERE ur.user_id = ?
       AND ur.deleted_at IS NULL
       ${PUBLISHED_ROUTE_FILTER}
     ORDER BY ur.sent_at DESC, ur.created_at DESC`,
    [userId]
  );
}

function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

const ROUTE_SEARCH_LIMIT = 20;

export async function searchPublishedRoutesForRecord(term: string): Promise<RouteSearchRowForRecord[]> {
  const trimmed = term.trim();
  if (!trimmed) {
    return [];
  }

  return queryD1<RouteSearchRowForRecord>(
    `SELECT
       r.id AS routeId,
       r.name AS routeName,
       r.grade AS routeGrade,
       b.name AS boulderName,
       s.name AS sectorName,
       c.name AS cragName,
       b.hashtags AS boulderHashtags
     FROM routes r
     JOIN topos t ON t.id = r.topo_id
     JOIN boulders b ON b.id = t.boulder_id
     JOIN sectors s ON s.id = b.sector_id
     JOIN crags c ON c.id = s.crag_id
     JOIN areas a ON a.id = c.area_id
     WHERE r.name LIKE ? ESCAPE '\\'
       ${PUBLISHED_ROUTE_FILTER}
     ORDER BY r.name COLLATE NOCASE ASC
     LIMIT ${ROUTE_SEARCH_LIMIT}`,
    [`%${escapeLikeTerm(trimmed)}%`]
  );
}

const CHART_GRADE_MAX = 12;

export function buildFixedGradeBuckets(records: Array<{ routeGradeNum: number }>): UserRecordGradeBucket[] {
  const counts = new Array<number>(CHART_GRADE_MAX + 1).fill(0);
  for (const record of records) {
    const index = Math.min(Math.max(record.routeGradeNum, 0), CHART_GRADE_MAX);
    counts[index] += 1;
  }

  return counts.map((count, index) => ({
    grade: index === CHART_GRADE_MAX ? "V12+" : `V${index}`,
    gradeNum: index,
    count
  }));
}

export async function getOwnBetaVideosByUserId(
  userId: string
): Promise<Array<{ id: string; thumbnailUrl: string | null; title: string }>> {
  return queryD1(
    `SELECT
       be.id AS id,
       be.thumbnail_url AS thumbnailUrl,
       r.name AS title
     FROM betas be
     JOIN routes r ON r.id = be.route_id
     WHERE be.user_id = ?
       AND be.status IN ('pending', 'approved')
       AND be.deleted_at IS NULL
     ORDER BY be.sent_at DESC, be.created_at DESC`,
    [userId]
  );
}

export function getRecordGradeBuckets(records: PartialRecordForBucket[]): UserRecordGradeBucket[] {
  const counts = new Map<number, { grade: string; gradeNum: number; count: number }>();

  for (const record of records) {
    const existing = counts.get(record.routeGradeNum);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(record.routeGradeNum, {
        grade: record.routeGrade,
        gradeNum: record.routeGradeNum,
        count: 1
      });
    }
  }

  return Array.from(counts.values()).sort((a, b) => a.gradeNum - b.gradeNum);
}

export function buildUserRecordsModel(input: {
  records: UserRecordListItem[];
  claimCandidates: UserRecordClaimCandidate[];
}): UserRecordsModel {
  const highest = input.records.reduce<UserRecordListItem | null>((current, record) => {
    if (!current || record.routeGradeNum > current.routeGradeNum) {
      return record;
    }
    return current;
  }, null);
  const latest = input.records[0] ?? null;

  return {
    records: input.records,
    claimCandidates: input.claimCandidates,
    gradeBuckets: getRecordGradeBuckets(input.records),
    summary: {
      totalRecords: input.records.length,
      highestGrade: highest?.routeGrade ?? "-",
      latestSentAt: latest?.sentAt ?? null,
      claimCandidateCount: input.claimCandidates.length
    }
  };
}
