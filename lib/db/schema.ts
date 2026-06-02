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
  allCrags: Array<Crag & { stats: Omit<Stats, "crags"> }>;
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
  crags: Array<Crag & { stats: Omit<Stats, "crags"> }>;
  cragLocations: CragLocation[];
};
