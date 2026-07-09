import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  batchD1,
  executeD1,
  pingD1,
  queryD1,
  queryD1First,
  type D1Query,
} from "./d1-http";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEnvelope<T>(rows: T[], success = true) {
  return {
    success,
    errors: [] as { message: string }[],
    result: [{ results: rows }],
  };
}

function makeErrorEnvelope(messages: string[]) {
  return {
    success: false,
    errors: messages.map((m) => ({ message: m })),
    result: [],
  };
}

function mockFetch(body: unknown, status = 200) {
  const mockFn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  });
  vi.stubGlobal("fetch", mockFn);
  return mockFn;
}

// ---------------------------------------------------------------------------
// Env setup
// ---------------------------------------------------------------------------

const DEFAULT_ENV = {
  D1_HTTP_URL: "https://api.cloudflare.com/d1",
  D1_API_TOKEN: "test-token",
  D1_DATABASE_ID: "db-123",
};

function setEnv(overrides: Partial<typeof DEFAULT_ENV> = {}) {
  const env = { ...DEFAULT_ENV, ...overrides };
  process.env.D1_HTTP_URL = env.D1_HTTP_URL;
  process.env.D1_API_TOKEN = env.D1_API_TOKEN;
  process.env.D1_DATABASE_ID = env.D1_DATABASE_ID;
}

function clearEnv() {
  delete process.env.D1_HTTP_URL;
  delete process.env.D1_API_TOKEN;
  delete process.env.D1_DATABASE_ID;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("queryD1", () => {
  beforeEach(() => setEnv());
  afterEach(() => {
    clearEnv();
    vi.unstubAllGlobals();
  });

  it("returns rows from a successful envelope", async () => {
    const rows = [{ id: 1, name: "Boulder A" }];
    mockFetch(makeEnvelope(rows));

    const result = await queryD1<{ id: number; name: string }>(
      "SELECT * FROM spots"
    );

    expect(result).toEqual(rows);
  });

  it("sends correct method, headers, and body", async () => {
    const fetchMock = mockFetch(makeEnvelope([{ id: 1 }]));

    await queryD1("SELECT * FROM spots WHERE id = ?", [42]);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string>; body: string }
    ];

    // URL: base + databaseId + /query
    expect(url).toBe("https://api.cloudflare.com/d1/db-123/query");

    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers["Authorization"]).toBe("Bearer test-token");

    const parsed = JSON.parse(init.body);
    expect(parsed.sql).toBe("SELECT * FROM spots WHERE id = ?");
    expect(parsed.params).toEqual([42]);
  });

  it("defaults params to [] when not provided", async () => {
    const fetchMock = mockFetch(makeEnvelope([]));

    await queryD1("SELECT 1");

    const [, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { body: string }
    ];
    expect(JSON.parse(init.body).params).toEqual([]);
  });

  it("uses URL as-is when it already ends with /query", async () => {
    setEnv({ D1_HTTP_URL: "https://custom.host/accounts/abc/databases/xyz/query" });
    const fetchMock = mockFetch(makeEnvelope([]));

    await queryD1("SELECT 1");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://custom.host/accounts/abc/databases/xyz/query"
    );
  });
});

// ---------------------------------------------------------------------------

describe("queryD1First", () => {
  beforeEach(() => setEnv());
  afterEach(() => {
    clearEnv();
    vi.unstubAllGlobals();
  });

  it("returns the first row", async () => {
    const rows = [{ id: 1 }, { id: 2 }];
    mockFetch(makeEnvelope(rows));

    const result = await queryD1First<{ id: number }>("SELECT * FROM spots");
    expect(result).toEqual({ id: 1 });
  });

  it("returns null when results are empty", async () => {
    mockFetch(makeEnvelope([]));

    const result = await queryD1First<{ id: number }>("SELECT * FROM spots WHERE id = 9999");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe("error handling", () => {
  beforeEach(() => setEnv());
  afterEach(() => {
    clearEnv();
    vi.unstubAllGlobals();
  });

  it("throws when success is false and includes CF error text", async () => {
    mockFetch(makeErrorEnvelope(["syntax error near 'SLECT'", "parse failed"]));

    await expect(queryD1("SLECT 1")).rejects.toThrow(
      "syntax error near 'SLECT'"
    );
  });

  it("error message is a string, not the raw CF payload object", async () => {
    mockFetch(makeErrorEnvelope(["bad query"]));

    await expect(queryD1("bad")).rejects.toSatisfy((err: unknown) => {
      return err instanceof Error && typeof err.message === "string";
    });
  });

  it("throws on non-ok HTTP status with error detail from body", async () => {
    mockFetch(makeErrorEnvelope(["unauthorized"]), 403);

    await expect(queryD1("SELECT 1")).rejects.toThrow("unauthorized");
  });

  it("throws on non-ok HTTP status even when body has no errors array", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new Error("no body")),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(queryD1("SELECT 1")).rejects.toThrow("HTTP 500");
  });
});

// ---------------------------------------------------------------------------

describe("missing env vars", () => {
  afterEach(() => {
    clearEnv();
    vi.unstubAllGlobals();
  });

  it("throws when D1_HTTP_URL is missing", async () => {
    setEnv({ D1_HTTP_URL: undefined as unknown as string });
    delete process.env.D1_HTTP_URL;

    await expect(queryD1("SELECT 1")).rejects.toThrow("D1_HTTP_URL");
  });

  it("throws when D1_API_TOKEN is missing", async () => {
    setEnv({ D1_API_TOKEN: undefined as unknown as string });
    delete process.env.D1_API_TOKEN;

    await expect(queryD1("SELECT 1")).rejects.toThrow("D1_API_TOKEN");
  });

  it("throws when D1_DATABASE_ID is missing", async () => {
    setEnv({ D1_DATABASE_ID: undefined as unknown as string });
    delete process.env.D1_DATABASE_ID;

    await expect(queryD1("SELECT 1")).rejects.toThrow("D1_DATABASE_ID");
  });

  it("lists all missing vars in one error", async () => {
    clearEnv();

    await expect(queryD1("SELECT 1")).rejects.toThrow(
      /D1_HTTP_URL.*D1_API_TOKEN.*D1_DATABASE_ID/
    );
  });
});

// ---------------------------------------------------------------------------

describe("executeD1", () => {
  beforeEach(() => setEnv());
  afterEach(() => {
    clearEnv();
    vi.unstubAllGlobals();
  });

  it("executeD1 posts SQL and params to D1", async () => {
    const fetchMock = mockFetch(makeEnvelope([]));

    await executeD1("UPDATE crags SET name = ? WHERE id = ?", ["안양", "crag_anyang"]);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string>; body: string }
    ];

    expect(url).toBe("https://api.cloudflare.com/d1/db-123/query");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers["Authorization"]).toBe("Bearer test-token");

    const parsed = JSON.parse(init.body);
    expect(parsed.sql).toBe("UPDATE crags SET name = ? WHERE id = ?");
    expect(parsed.params).toEqual(["안양", "crag_anyang"]);
  });

  it("executeD1 throws normalized D1 errors", async () => {
    mockFetch(makeErrorEnvelope(["constraint failed"]));

    await expect(
      executeD1("INSERT INTO areas (id) VALUES (?)", ["x"])
    ).rejects.toThrow("D1 query failed: constraint failed");
  });
});

// ---------------------------------------------------------------------------

describe("batchD1", () => {
  beforeEach(() => setEnv());
  afterEach(() => {
    clearEnv();
    vi.unstubAllGlobals();
  });

  function makeBatchEnvelope(resultSets: unknown[][]) {
    return {
      success: true,
      errors: [] as { message: string }[],
      result: resultSets.map((rows) => ({ results: rows })),
    };
  }

  function q<T>(
    sql: string,
    params: unknown[],
    map: (rows: unknown[]) => T
  ): D1Query<T> {
    return { sql, params, map };
  }

  it("sends all statements in one request with the { batch: [...] } body", async () => {
    const fetchMock = mockFetch(makeBatchEnvelope([[], []]));

    await batchD1([
      q("SELECT * FROM crags WHERE id = ?", ["crag-1"], (rows) => rows),
      q("SELECT * FROM sectors WHERE crag_id = ?", ["crag-1"], (rows) => rows),
    ]);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string>; body: string }
    ];

    expect(url).toBe("https://api.cloudflare.com/d1/db-123/query");
    expect(init.method).toBe("POST");
    expect(init.headers["Authorization"]).toBe("Bearer test-token");

    const parsed = JSON.parse(init.body);
    expect(parsed.batch).toEqual([
      { sql: "SELECT * FROM crags WHERE id = ?", params: ["crag-1"] },
      { sql: "SELECT * FROM sectors WHERE crag_id = ?", params: ["crag-1"] },
    ]);
  });

  it("maps each result set through its own descriptor, in order", async () => {
    mockFetch(
      makeBatchEnvelope([
        [{ id: "crag-1" }],
        [{ id: "s-1" }, { id: "s-2" }],
      ])
    );

    const [crag, sectorCount] = await batchD1([
      q("SELECT ...", [], (rows) => (rows as { id: string }[])[0] ?? null),
      q("SELECT ...", [], (rows) => rows.length),
    ]);

    expect(crag).toEqual({ id: "crag-1" });
    expect(sectorCount).toBe(2);
  });

  it("returns [] without any HTTP request for an empty batch", async () => {
    const fetchMock = mockFetch(makeBatchEnvelope([]));

    const result = await batchD1([]);

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when the result count does not match the statement count", async () => {
    mockFetch(makeBatchEnvelope([[]]));

    await expect(
      batchD1([
        q("SELECT 1", [], (rows) => rows),
        q("SELECT 2", [], (rows) => rows),
      ])
    ).rejects.toThrow("expected 2 results, got 1");
  });

  it("throws normalized errors on an error envelope", async () => {
    mockFetch(makeErrorEnvelope(["no such table: nope"]));

    await expect(
      batchD1([q("SELECT * FROM nope", [], (rows) => rows)])
    ).rejects.toThrow("D1 batch failed: no such table: nope");
  });

  it("throws on non-ok HTTP status", async () => {
    mockFetch(makeErrorEnvelope(["unauthorized"]), 403);

    await expect(
      batchD1([q("SELECT 1", [], (rows) => rows)])
    ).rejects.toThrow("unauthorized");
  });
});

// ---------------------------------------------------------------------------

describe("pingD1", () => {
  beforeEach(() => setEnv());
  afterEach(() => {
    clearEnv();
    vi.unstubAllGlobals();
  });

  it("returns true when SELECT 1 succeeds", async () => {
    mockFetch(makeEnvelope([{ 1: 1 }]));

    await expect(pingD1()).resolves.toBe(true);
  });

  it("returns false when fetch rejects (network error)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network failure"))
    );

    await expect(pingD1()).resolves.toBe(false);
  });

  it("returns false when D1 returns an error envelope", async () => {
    mockFetch(makeErrorEnvelope(["db unavailable"]));

    await expect(pingD1()).resolves.toBe(false);
  });

  it("returns false when env vars are missing", async () => {
    clearEnv();

    await expect(pingD1()).resolves.toBe(false);
  });

  it("never throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));

    await expect(pingD1()).resolves.not.toThrow();
  });
});
