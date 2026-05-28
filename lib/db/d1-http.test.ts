import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pingD1, queryD1, queryD1First } from "./d1-http";

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
