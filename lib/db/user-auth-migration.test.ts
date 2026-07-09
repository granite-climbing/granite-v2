import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = () => readFileSync(join(process.cwd(), "migrations/0009_user_auth.sql"), "utf8");
const instagramDuplicatesSql = () =>
  readFileSync(join(process.cwd(), "migrations/0013_users_instagram_id_allow_duplicates.sql"), "utf8");

describe("Phase 6 user auth migration", () => {
  it("creates users with profile fields needed by OAuth login", () => {
    const sql = migrationSql();

    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS users/i);
    expect(sql).toMatch(/id\s+TEXT PRIMARY KEY/i);
    expect(sql).toMatch(/display_name\s+TEXT NOT NULL/i);
    expect(sql).toMatch(/email\s+TEXT/i);
    expect(sql).toMatch(/avatar_url\s+TEXT/i);
    expect(sql).toMatch(/instagram_id\s+TEXT/i);
    expect(sql).toMatch(/youtube_id\s+TEXT/i);
    expect(sql).toMatch(/gender\s+TEXT CHECK \(gender IN \('male', 'female'\)\)/i);
    expect(sql).toMatch(/height_cm\s+INTEGER/i);
    expect(sql).toMatch(/ape_index_cm\s+INTEGER/i);
    expect(sql).toMatch(/top_bouldering_grade\s+TEXT/i);
    expect(sql).toMatch(/top_sport_grade\s+TEXT/i);
    expect(sql).toMatch(/onboarding_completed_at\s+TEXT/i);
    expect(sql).toMatch(/deleted_at\s+TEXT/i);
    expect(sql).toMatch(/created_at\s+TEXT NOT NULL DEFAULT \(datetime\('now'\)\)/i);
    expect(sql).toMatch(/updated_at\s+TEXT NOT NULL DEFAULT \(datetime\('now'\)\)/i);
  });

  it("creates provider identities with a unique provider uid pair", () => {
    const sql = migrationSql();

    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS user_oauth_identities/i);
    expect(sql).toMatch(/user_id\s+TEXT NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/i);
    expect(sql).toMatch(/provider\s+TEXT NOT NULL CHECK \(provider IN \('kakao', 'naver', 'google', 'apple'\)\)/i);
    expect(sql).toMatch(/provider_uid\s+TEXT NOT NULL/i);
    expect(sql).toMatch(/email_at_link\s+TEXT/i);
    expect(sql).toMatch(/UNIQUE \(provider, provider_uid\)/i);
  });

  it("adds lookup indexes for login, merge, and profile handle flows", () => {
    const sql = migrationSql();

    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_users_email ON users \(email\)/i);
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS idx_users_instagram_id ON users \(instagram_id\)/i);
    expect(sql).toMatch(/WHERE instagram_id IS NOT NULL AND deleted_at IS NULL/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_user_oauth_identities_user_id ON user_oauth_identities \(user_id\)/i);
  });
});

describe("instagram_id duplicate allowance migration (0013)", () => {
  it("replaces the unique instagram_id index with a plain lookup index", () => {
    const sql = instagramDuplicatesSql();

    expect(sql).toMatch(/DROP INDEX IF EXISTS idx_users_instagram_id/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_users_instagram_id ON users \(instagram_id\)/i);
    expect(sql).not.toMatch(/CREATE UNIQUE INDEX/i);
    expect(sql).toMatch(/WHERE instagram_id IS NOT NULL AND deleted_at IS NULL/i);
  });
});
