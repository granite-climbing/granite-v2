/**
 * User-specific "project" (saved routes / favorites) queries for Cloudflare D1.
 *
 * Separate boundary from `lib/db/queries.ts` (public content reads): these
 * functions are scoped to a single authenticated user and read/write the
 * `favorites` table (see `migrations/0010_user_favorites.sql`).
 */

import { randomUUID } from "node:crypto";
import { executeD1, queryD1, queryD1First } from "./d1-http";
import type { SavedRouteListItem } from "./schema";

// ---------------------------------------------------------------------------
// Internal row shapes (snake_case → camelCase via SQL aliases, is_published as 0|1)
// ---------------------------------------------------------------------------

type SavedRouteListItemRow = Omit<SavedRouteListItem, "isPublished"> & {
  isPublished: 0 | 1;
};

function mapSavedRoute(row: SavedRouteListItemRow): SavedRouteListItem {
  return { ...row, isPublished: row.isPublished === 1 };
}

// ---------------------------------------------------------------------------
// 1. Saved routes for a user
// ---------------------------------------------------------------------------

/**
 * Published routes a user has favorited, newest favorite first.
 * Requires the full ancestor chain (topo → boulder → sector → crag → area)
 * to be published and non-soft-deleted, same as `getRouteById` in queries.ts.
 */
export async function listSavedRoutesForUser(userId: string): Promise<SavedRouteListItem[]> {
  const rows = await queryD1<SavedRouteListItemRow>(
    `SELECT
       f.id AS favoriteId,
       f.created_at AS savedAt,
       r.id,
       r.topo_id AS topoId,
       r.name,
       r.slug,
       r.grade,
       r.grade_num AS gradeNum,
       r.fa,
       r.description,
       r.line_image_url AS lineImageUrl,
       r.is_published AS isPublished,
       r.sort_order AS sortOrder,
       b.id AS boulderId,
       b.name AS boulderName,
       s.name AS sectorName,
       c.name AS cragName,
       c.slug AS cragSlug,
       s.slug AS sectorSlug
     FROM favorites f
     JOIN routes r ON r.id = f.target_id
     JOIN topos t ON t.id = r.topo_id
     JOIN boulders b ON b.id = t.boulder_id
     JOIN sectors s ON s.id = b.sector_id
     JOIN crags c ON c.id = s.crag_id
     JOIN areas a ON a.id = c.area_id
     WHERE f.user_id = ?
       AND f.target_type = 'route'
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
     ORDER BY f.created_at DESC`,
    [userId]
  );

  return rows.map(mapSavedRoute);
}

// ---------------------------------------------------------------------------
// 2. Guard: published route lookup for favoriting
// ---------------------------------------------------------------------------

/**
 * Confirms a route id refers to a currently published route (full ancestor
 * chain published and non-soft-deleted) before allowing it to be favorited.
 */
export async function findPublishedRouteForFavorite(routeId: string): Promise<{ id: string } | null> {
  return queryD1First<{ id: string }>(
    `SELECT r.id
     FROM routes r
     JOIN topos t ON t.id = r.topo_id
     JOIN boulders b ON b.id = t.boulder_id
     JOIN sectors s ON s.id = b.sector_id
     JOIN crags c ON c.id = s.crag_id
     JOIN areas a ON a.id = c.area_id
     WHERE r.id = ?
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
     LIMIT 1`,
    [routeId]
  );
}

// ---------------------------------------------------------------------------
// 3. Mutations
// ---------------------------------------------------------------------------

/** Adds a route favorite for a user. Idempotent via INSERT OR IGNORE + UNIQUE constraint. */
export async function addRouteFavorite(userId: string, routeId: string): Promise<void> {
  await executeD1(
    `INSERT OR IGNORE INTO favorites (id, user_id, target_type, target_id)
     VALUES (?, ?, ?, ?)`,
    [`fav_${randomUUID()}`, userId, "route", routeId]
  );
}

/** Removes a route favorite for a user, if it exists. */
export async function removeRouteFavorite(userId: string, routeId: string): Promise<void> {
  await executeD1(
    `DELETE FROM favorites
     WHERE user_id = ? AND target_type = ? AND target_id = ?`,
    [userId, "route", routeId]
  );
}

// ---------------------------------------------------------------------------
// 4. Reads for favorite state
// ---------------------------------------------------------------------------

/** Whether a single route is already favorited by a user. */
export async function isRouteFavoritedByUser(userId: string, routeId: string): Promise<boolean> {
  const row = await queryD1First<{ id: string }>(
    `SELECT id
     FROM favorites
     WHERE user_id = ? AND target_type = ? AND target_id = ?
     LIMIT 1`,
    [userId, "route", routeId]
  );

  return Boolean(row);
}

/**
 * Batch-checks which of the given route ids are favorited by a user.
 * Used by the Topo page to avoid N+1 favorite-state queries per route.
 * Returns an empty Set without querying when `routeIds` is empty.
 */
export async function listFavoritedRouteIdsForUser(userId: string, routeIds: string[]): Promise<Set<string>> {
  if (routeIds.length === 0) {
    return new Set();
  }

  const placeholders = routeIds.map(() => "?").join(", ");
  const rows = await queryD1<{ targetId: string }>(
    `SELECT target_id AS targetId
     FROM favorites
     WHERE user_id = ?
       AND target_type = ?
       AND target_id IN (${placeholders})`,
    [userId, "route", ...routeIds]
  );

  return new Set(rows.map((row) => row.targetId));
}
