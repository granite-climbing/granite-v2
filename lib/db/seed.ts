import mockSeed from "./mock/granite.seed.json";
import type { Announcement, Area, Boulder, Crag, Route, Sector, Topo } from "./schema";

type MockSeed = {
  areas: Area[];
  crags: Crag[];
  sectors: Sector[];
  boulders: Boulder[];
  topos: Topo[];
  routes: Route[];
  announcements: Announcement[];
};

const seed = mockSeed as MockSeed;

export const areas = seed.areas;
export const crags = seed.crags;
export const sectors = seed.sectors;
export const boulders = seed.boulders;
export const topos = seed.topos;
export const routes = seed.routes;
export const announcements = seed.announcements;
