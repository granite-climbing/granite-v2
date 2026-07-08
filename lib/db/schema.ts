export type TabName = "Info" | "Sector" | "Boulder" | "Route" | "Map" | "Travel";

export type Area = {
  id: string;
  name: string;
  nameEn: string | null;
  slug: string;
  coverImageUrl: string;
  isPublished: boolean;
  sortOrder: number;
};

export type Crag = {
  id: string;
  areaId: string;
  name: string;
  nameEn: string | null;
  slug: string;
  lat: number | null;
  lng: number | null;
  description: string;
  season: string;
  coverImageUrl: string;
  isPublished: boolean;
  sortOrder: number;
};

export type Sector = {
  id: string;
  cragId: string;
  name: string;
  nameEn: string | null;
  slug: string;
  lat: number | null;
  lng: number | null;
  description: string;
  season: string;
  coverImageUrl: string;
  isPublished: boolean;
  sortOrder: number;
};

export type Boulder = {
  id: string;
  sectorId: string;
  name: string;
  slug: string;
  lat: number;
  lng: number;
  hashtags: string;
  coverImageUrl: string;
  isPublished: boolean;
  sortOrder: number;
};

export type Topo = {
  id: string;
  boulderId: string;
  name: string;
  baseImageUrl: string;
  isPublished: boolean;
  sortOrder: number;
};

export type Route = {
  id: string;
  topoId: string;
  name: string;
  slug: string;
  grade: string;
  gradeNum: number;
  fa: string;
  description: string;
  lineImageUrl: string;
  isPublished: boolean;
  sortOrder: number;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  coverImageUrl: string;
  cragId: string | null;
  linkUrl: string;
  isPublished: boolean;
  publishedAt: string;
  sortOrder: number;
};

export type OAuthProviderId = "kakao" | "naver" | "google" | "apple";

export type User = {
  id: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  instagramId: string | null;
  youtubeId: string | null;
  gender: "male" | "female" | null;
  heightCm: number | null;
  apeIndexCm: number | null;
  weightKg: number | null;
  topBoulderingGrade: string | null;
  topSportGrade: string | null;
  onboardingCompletedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserOAuthIdentity = {
  id: string;
  userId: string;
  provider: OAuthProviderId;
  providerUid: string;
  emailAtLink: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Stats = {
  crags: number;
  sectors: number;
  boulders: number;
  routes: number;
};

export type RouteListItem = Route & {
  boulderId: string;
  boulderName: string;
  sectorName: string;
  cragName: string;
  cragSlug: string;
  sectorSlug: string;
};

export type BoulderDetail = Boulder & {
  hashtagsList: string[];
  topos: Array<Topo & { routes: Route[] }>;
};

export type TopoDetail = Topo & {
  topoIndex: number;
  topoCount: number;
  prevTopoId: string | null;
  nextTopoId: string | null;
  boulder: Boulder;
  sector: Sector;
  crag: Crag;
  routes: Route[];
};

export type CragDetail = Crag & {
  tabs: TabName[];
  stats: Stats;
  sectors: Sector[];
  boulders: Array<Boulder & { routeCount: number; gradeRange: string; hashtagsList: string[] }>;
  routes: RouteListItem[];
};

export type SectorDetail = Sector & {
  tabs: Exclude<TabName, "Sector">[];
  crag: Crag;
  stats: Omit<Stats, "crags">;
  boulders: Array<Boulder & { routeCount: number; gradeRange: string; hashtagsList: string[] }>;
  routes: RouteListItem[];
};

export type HomeModel = {
  totals: Stats;
  areas: Array<Area & { stats: Stats }>;
  allCrags: Array<Crag & { stats: Omit<Stats, "crags">; gradeCounts: number[] }>;
  announcements: Announcement[];
};

export type GradeBand = {
  band: string;  // e.g. "V0-V2"
  min: number;
  max: number;
  count: number;
};

export type CragLocation = {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
};

export type AreaDetail = Area & {
  stats: Stats;
  gradeDistribution: GradeBand[];
  crags: Array<Crag & { stats: Omit<Stats, "crags">; gradeCounts: number[] }>;
  cragLocations: CragLocation[];
};

export type BetaSource = "manual" | "instagram_webhook";
export type BetaPlatform = "instagram" | "youtube";
export type BetaStatus = "pending" | "approved" | "hidden" | "removed";
export type BetaClaimStatus = "unclaimed" | "claimed" | "verified" | "revoked";
export type WebhookInboxStatus =
  | "received"
  | "processing"
  | "matched"
  | "unmatched"
  | "manual_matched"
  | "rejected"
  | "duplicate"
  | "failed";

export type Beta = {
  id: string;
  routeId: string;
  userId: string | null;
  instagramId: string;
  displayName: string;
  source: BetaSource;
  platform: BetaPlatform;
  mediaUrl: string;
  permalinkUrl: string | null;
  externalMediaId: string | null;
  thumbnailUrl: string | null;
  sentAt: string;
  status: BetaStatus;
  claimStatus: BetaClaimStatus;
  moderationNote: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type UserRecordListItem = {
  betaId: string;
  routeId: string;
  topoId: string;
  routeName: string;
  routeGrade: string;
  routeGradeNum: number;
  boulderName: string;
  sectorName: string;
  cragName: string;
  platform: BetaPlatform;
  mediaUrl: string;
  thumbnailUrl: string | null;
  sentAt: string;
  displayName: string;
};

export type UserRecordClaimCandidate = UserRecordListItem & {
  instagramId: string;
  claimStatus: BetaClaimStatus;
};

export type UserRecordGradeBucket = {
  grade: string;
  gradeNum: number;
  count: number;
};

export type UserRecordsModel = {
  records: UserRecordListItem[];
  claimCandidates: UserRecordClaimCandidate[];
  gradeBuckets: UserRecordGradeBucket[];
  summary: {
    totalRecords: number;
    highestGrade: string;
    latestSentAt: string | null;
    claimCandidateCount: number;
  };
};

export type WebhookInbox = {
  id: string;
  provider: "instagram";
  externalId: string;
  externalMediaId: string | null;
  igUserId: string;
  igUsername: string;
  caption: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  matchedBetaId: string | null;
  status: WebhookInboxStatus;
  processingAttempts: number;
  lastErrorCode: string;
  lastErrorMessage: string;
  rawPayload: string;
  receivedAt: string;
  updatedAt: string;
};

export type WebhookOperationalEventType =
  | "invalid_signature"
  | "graph_api_failure"
  | "caption_parse_failed"
  | "route_match_ambiguous"
  | "duplicate_beta"
  | "thumbnail_lookup_failed"
  | "thumbnail_copy_failed";

export type WebhookOperationalEvent = {
  id: string;
  eventType: WebhookOperationalEventType;
  provider: "instagram";
  webhookId: string | null;
  betaId: string | null;
  requestId: string;
  method: string;
  path: string;
  statusCode: number | null;
  message: string;
  metadata: string;
  createdAt: string;
};
