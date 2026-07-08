// Phase 9 임시 mock 데이터. 사용자가 직접 기록을 추가할 수 없어 UI 검증용으로만 사용한다.
// Phase 10에서 기록 추가가 열리면 lib/db/record-queries.ts 기반 실데이터로 교체한다.

export type MockRecordGradeBucket = {
  grade: string;
  count: number;
};

export type MockRecentRecord = {
  id: string;
  routeName: string;
  grade: string;
  location: string;
};

export type MockRecordVideo = {
  id: string;
  thumbnailUrl: string | null;
  title: string;
};

export type MockRecordsModel = {
  totalSends: number;
  highestGrade: string;
  gradeBuckets: MockRecordGradeBucket[];
  recentRecords: MockRecentRecord[];
  videos: MockRecordVideo[];
};

export const MOCK_RECORDS_MODEL: MockRecordsModel = {
  totalSends: 126,
  highestGrade: "V10",
  gradeBuckets: [
    { grade: "V0", count: 2 },
    { grade: "V1", count: 8 },
    { grade: "V2", count: 12 },
    { grade: "V3", count: 24 },
    { grade: "V4", count: 28 },
    { grade: "V5", count: 16 },
    { grade: "V6", count: 2 },
    { grade: "V7", count: 0 },
    { grade: "V8", count: 0 },
    { grade: "V9", count: 0 },
    { grade: "V10", count: 0 },
    { grade: "V11", count: 0 },
    { grade: "V12+", count: 0 }
  ],
  recentRecords: [
    { id: "mock_record_1", routeName: "Midnight", grade: "V5", location: "더 클라임 성수" },
    { id: "mock_record_2", routeName: "Little Finger", grade: "V4", location: "현충바위" },
    { id: "mock_record_3", routeName: "Even Flow", grade: "V3", location: "인수봉" }
  ],
  videos: [
    { id: "mock_video_1", thumbnailUrl: null, title: "New Line" },
    { id: "mock_video_2", thumbnailUrl: null, title: "Memorial Boulder" },
    { id: "mock_video_3", thumbnailUrl: null, title: "북한산 볼더링" },
    { id: "mock_video_4", thumbnailUrl: null, title: "현충볼더 관련 안내" },
    { id: "mock_video_5", thumbnailUrl: null, title: "New Line 수락산" },
    { id: "mock_video_6", thumbnailUrl: null, title: "Forgotten Boulders" }
  ]
};
