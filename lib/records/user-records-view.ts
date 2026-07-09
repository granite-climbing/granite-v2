import { normalizeHandle } from "@/lib/beta/normalize";
import type { User, UserRecordWithRoute } from "@/lib/db/schema";
import {
  buildFixedGradeBuckets,
  getOwnBetaVideosByUserId,
  getUserRecordsByUserId
} from "@/lib/db/record-queries";

export type UserRecordsProfile = {
  displayName: string;
  instagramId: string | null;
  avatarUrl: string | null;
  armSpanCm: number | null;
  heightCm: number | null;
  weightKg: number | null;
};

export type RecordGradeBucket = {
  grade: string;
  count: number;
};

export type RecentRecordItem = {
  id: string;
  routeName: string;
  grade: string;
  location: string;
};

export type RecordVideoItem = {
  id: string;
  thumbnailUrl: string | null;
  title: string;
};

export type UserRecordsView = {
  profile: UserRecordsProfile;
  totalSends: number;
  highestGrade: string;
  gradeBuckets: RecordGradeBucket[];
  recentRecords: RecentRecordItem[];
  videos: RecordVideoItem[];
};

const RECENT_RECORD_LIMIT = 3;

// 기록탭 화면 데이터의 단일 진입점. 프로필은 사용자 설정값(회원가입 온보딩)에서 오고,
// 기록/영상은 user_records와 본인 소유 betas 실데이터를 사용한다 (Phase 10).
// 본인 화면이므로 영상은 pending 상태도 즉시 노출한다. 공개 영역 노출은 관리자 승인 후다.
export async function getUserRecordsView(user: User): Promise<UserRecordsView> {
  const [records, videos] = await Promise.all([
    getUserRecordsByUserId(user.id),
    getOwnBetaVideosByUserId(user.id)
  ]);

  const highest = records.reduce<UserRecordWithRoute | null>((current, record) => {
    if (!current || record.routeGradeNum > current.routeGradeNum) {
      return record;
    }
    return current;
  }, null);

  return {
    profile: {
      displayName: user.displayName,
      instagramId: user.instagramId ? normalizeHandle(user.instagramId) : null,
      avatarUrl: user.avatarUrl,
      // users.ape_index_cm 은 온보딩에서 암스팬 절대값(cm)으로 입력받는다.
      armSpanCm: user.apeIndexCm,
      heightCm: user.heightCm,
      weightKg: user.weightKg
    },
    totalSends: records.length,
    highestGrade: highest?.routeGrade ?? "-",
    gradeBuckets: buildFixedGradeBuckets(records),
    recentRecords: records.slice(0, RECENT_RECORD_LIMIT).map((record) => ({
      id: record.recordId,
      routeName: record.routeName,
      grade: record.routeGrade,
      location: record.cragName
    })),
    videos
  };
}
