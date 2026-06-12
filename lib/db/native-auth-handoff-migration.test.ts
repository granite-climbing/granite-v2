import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = () => readFileSync(join(process.cwd(), "migrations/0010_native_auth_handoffs.sql"), "utf8");

describe("native auth handoff migration", () => {
  it("creates one-time native auth handoff storage", () => {
    const sql = migrationSql();

    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS native_auth_handoffs/i);
    expect(sql).toMatch(/id\s+TEXT PRIMARY KEY/i);
    expect(sql).toMatch(/code_hash\s+TEXT NOT NULL UNIQUE/i);
    expect(sql).toMatch(/token\s+TEXT NOT NULL/i);
    expect(sql).toMatch(/expires_at\s+TEXT NOT NULL/i);
    expect(sql).toMatch(/consumed_at\s+TEXT/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_native_auth_handoffs_lookup/i);
  });
});
