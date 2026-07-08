import { queryD1 } from "./d1-http";
import type { UserRecordClaimCandidate, UserRecordGradeBucket, UserRecordListItem, UserRecordsModel } from "./schema";

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
