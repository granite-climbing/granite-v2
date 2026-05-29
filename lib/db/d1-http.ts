/**
 * Server-only module: Cloudflare D1 HTTP query API client.
 * Must NOT be imported by Client Components.
 * Do NOT add "use client" here.
 */

// ---------------------------------------------------------------------------
// Cloudflare D1 HTTP response envelope
// ---------------------------------------------------------------------------

interface D1ErrorEntry {
  message: string;
}

interface D1ResultEntry<T> {
  results: T[];
}

interface D1Envelope<T> {
  success: boolean;
  errors: D1ErrorEntry[];
  result: D1ResultEntry<T>[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEnvVars(): { url: string; token: string; databaseId: string } {
  const url = process.env.D1_HTTP_URL;
  const token = process.env.D1_API_TOKEN;
  const databaseId = process.env.D1_DATABASE_ID;

  const missing: string[] = [];
  if (!url) missing.push("D1_HTTP_URL");
  if (!token) missing.push("D1_API_TOKEN");
  if (!databaseId) missing.push("D1_DATABASE_ID");

  if (missing.length > 0) {
    throw new Error(
      `D1 HTTP client: missing required env vars: ${missing.join(", ")}`
    );
  }

  // TypeScript narrowing — safe after the missing check above
  return { url: url!, token: token!, databaseId: databaseId! };
}

function buildEndpoint(url: string, databaseId: string): string {
  // If the URL already ends with "/query" (or contains "/query?"), use as-is.
  if (/\/query(\?.*)?$/.test(url)) {
    return url;
  }
  // Otherwise join: <base>/<databaseId>/query
  return `${url.replace(/\/$/, "")}/${databaseId}/query`;
}

async function executeQuery<T>(
  sql: string,
  params: unknown[]
): Promise<T[]> {
  const { url, token, databaseId } = getEnvVars();
  const endpoint = buildEndpoint(url, databaseId);

  const response = await globalThis.fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sql, params }),
  });

  if (!response.ok) {
    // Try to parse body for CF error messages; fall back gracefully.
    let errorDetail = "";
    try {
      const body = (await response.json()) as Partial<D1Envelope<T>>;
      if (Array.isArray(body.errors) && body.errors.length > 0) {
        errorDetail = body.errors.map((e) => e.message).join("; ");
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(
      errorDetail
        ? `D1 query failed (${response.status}): ${errorDetail}`
        : `D1 query failed with HTTP ${response.status}`
    );
  }

  const body = (await response.json()) as D1Envelope<T>;

  if (!body.success) {
    const errorDetail =
      Array.isArray(body.errors) && body.errors.length > 0
        ? body.errors.map((e) => e.message).join("; ")
        : "unknown error";
    throw new Error(`D1 query failed: ${errorDetail}`);
  }

  return body.result?.[0]?.results ?? [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run a SQL query and return all result rows.
 */
export async function queryD1<T>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  return executeQuery<T>(sql, params ?? []);
}

/**
 * Run a SQL query and return only the first row, or null if no rows.
 */
export async function queryD1First<T>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await executeQuery<T>(sql, params ?? []);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute a non-query statement (INSERT, UPDATE, DELETE).
 * Does not return rows; throws on error.
 */
export async function executeD1(
  sql: string,
  params?: unknown[]
): Promise<void> {
  await executeQuery<unknown>(sql, params ?? []);
}

/**
 * Connectivity check. Returns true if `SELECT 1` succeeds, false otherwise.
 * Never throws.
 */
export async function pingD1(): Promise<boolean> {
  try {
    await executeQuery<unknown>("SELECT 1", []);
    return true;
  } catch {
    return false;
  }
}
