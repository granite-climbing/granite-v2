import { normalizeHandle } from "@/lib/beta/normalize";
import type { User } from "@/lib/db/schema";
import {
  MOCK_RECORDS_MODEL,
  type MockRecentRecord,
  type MockRecordGradeBucket,
  type MockRecordVideo
} from "@/lib/mock/records";

export type UserRecordsProfile = {
  displayName: string;
  instagramId: string | null;
  avatarUrl: string | null;
  armSpanCm: number | null;
  heightCm: number | null;
  weightKg: number | null;
};

export type UserRecordsView = {
  profile: UserRecordsProfile;
  totalSends: number;
  highestGrade: string;
  gradeBuckets: MockRecordGradeBucket[];
  recentRecords: MockRecentRecord[];
  videos: MockRecordVideo[];
};

// 기록탭 화면 데이터의 단일 진입점. 프로필은 사용자 설정값(회원가입 온보딩)에서 오고,
// 기록 데이터는 기록 추가가 없는 Phase 9 동안 mock으로 채운다.
// TODO(phase-10): 기록 추가가 열리면 totalSends/highestGrade/gradeBuckets/recentRecords/videos를
// lib/db/record-queries.ts(getApprovedRecordsByUserId, buildUserRecordsModel 등) 기반 실데이터로 교체한다.
export async function getUserRecordsView(user: User): Promise<UserRecordsView> {
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
    totalSends: MOCK_RECORDS_MODEL.totalSends,
    highestGrade: MOCK_RECORDS_MODEL.highestGrade,
    gradeBuckets: MOCK_RECORDS_MODEL.gradeBuckets,
    recentRecords: MOCK_RECORDS_MODEL.recentRecords,
    videos: MOCK_RECORDS_MODEL.videos
  };
}
