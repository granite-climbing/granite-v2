import { randomUUID } from "node:crypto";
import { executeD1, queryD1First } from "./d1-http";
import type { User } from "./schema";
import type { OAuthProfile, OAuthProviderId } from "@/lib/auth/oauth/types";

export type CompletedSignupInput = {
  provider: OAuthProviderId;
  providerUserId: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  instagramId: string;
  gender: "male" | "female";
  heightCm: number | null;
  apeIndexCm: number | null;
  topBoulderingGrade: string | null;
  topSportGrade: string | null;
};

type UserSqlRow = {
  id: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  instagramId: string | null;
  youtubeId: string | null;
  gender: "male" | "female" | null;
  heightCm: number | null;
  apeIndexCm: number | null;
  topBoulderingGrade: string | null;
  topSportGrade: string | null;
  onboardingCompletedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapUser(row: UserSqlRow | null): User | null {
  return row;
}

export async function findActiveUserById(id: string): Promise<User | null> {
  const row = await queryD1First<UserSqlRow>(
    `SELECT
       id,
       display_name AS displayName,
       email,
       avatar_url AS avatarUrl,
       instagram_id AS instagramId,
       youtube_id AS youtubeId,
       gender,
       height_cm AS heightCm,
       ape_index_cm AS apeIndexCm,
       top_bouldering_grade AS topBoulderingGrade,
       top_sport_grade AS topSportGrade,
       onboarding_completed_at AS onboardingCompletedAt,
       deleted_at AS deletedAt,
       created_at AS createdAt,
       updated_at AS updatedAt
     FROM users
     WHERE id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [id]
  );

  return mapUser(row);
}

export async function findUserByOAuthIdentity(
  provider: OAuthProviderId,
  providerUid: string
): Promise<User | null> {
  const row = await queryD1First<UserSqlRow>(
    `SELECT
       u.id,
       u.display_name AS displayName,
       u.email,
       u.avatar_url AS avatarUrl,
       u.instagram_id AS instagramId,
       u.youtube_id AS youtubeId,
       u.gender,
       u.height_cm AS heightCm,
       u.ape_index_cm AS apeIndexCm,
       u.top_bouldering_grade AS topBoulderingGrade,
       u.top_sport_grade AS topSportGrade,
       u.onboarding_completed_at AS onboardingCompletedAt,
       u.deleted_at AS deletedAt,
       u.created_at AS createdAt,
       u.updated_at AS updatedAt
     FROM users u
     JOIN user_oauth_identities i ON i.user_id = u.id
     WHERE i.provider = ?
       AND i.provider_uid = ?
       AND u.deleted_at IS NULL
     LIMIT 1`,
    [provider, providerUid]
  );

  return mapUser(row);
}

export async function ensureUserForOAuthProfile(profile: OAuthProfile): Promise<User> {
  const existing = await findUserByOAuthIdentity(profile.provider, profile.providerUserId);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const user: User = {
    id: `user_${randomUUID()}`,
    displayName: profile.displayName,
    email: profile.email,
    avatarUrl: profile.avatarUrl,
    instagramId: null,
    youtubeId: null,
    gender: null,
    heightCm: null,
    apeIndexCm: null,
    topBoulderingGrade: null,
    topSportGrade: null,
    onboardingCompletedAt: now,
    deletedAt: null,
    createdAt: now,
    updatedAt: now
  };
  const identityId = `oauth_${randomUUID()}`;

  await executeD1(
    `INSERT INTO users
       (id, display_name, email, avatar_url)
     VALUES (?, ?, ?, ?)`,
    [user.id, user.displayName, user.email, user.avatarUrl]
  );
  try {
    await executeD1(
      `INSERT INTO user_oauth_identities
         (id, user_id, provider, provider_uid, email_at_link)
       VALUES (?, ?, ?, ?, ?)`,
      [identityId, user.id, profile.provider, profile.providerUserId, profile.email]
    );
  } catch (error) {
    await executeD1(`DELETE FROM users WHERE id = ?`, [user.id]);
    const racedUser = await findUserByOAuthIdentity(profile.provider, profile.providerUserId);
    if (racedUser) {
      return racedUser;
    }
    throw error;
  }

  return user;
}

export async function createUserForCompletedSignup(input: CompletedSignupInput): Promise<User> {
  const existing = await findUserByOAuthIdentity(input.provider, input.providerUserId);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const user: User = {
    id: `user_${randomUUID()}`,
    displayName: input.displayName,
    email: input.email,
    avatarUrl: input.avatarUrl,
    instagramId: input.instagramId,
    youtubeId: null,
    gender: input.gender,
    heightCm: input.heightCm,
    apeIndexCm: input.apeIndexCm,
    topBoulderingGrade: input.topBoulderingGrade,
    topSportGrade: input.topSportGrade,
    onboardingCompletedAt: now,
    deletedAt: null,
    createdAt: now,
    updatedAt: now
  };
  const identityId = `oauth_${randomUUID()}`;

  await executeD1(
    `INSERT INTO users
       (id, display_name, email, avatar_url, instagram_id, gender, height_cm, ape_index_cm,
        top_bouldering_grade, top_sport_grade, onboarding_completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      user.displayName,
      user.email,
      user.avatarUrl,
      user.instagramId,
      user.gender,
      user.heightCm,
      user.apeIndexCm,
      user.topBoulderingGrade,
      user.topSportGrade,
      user.onboardingCompletedAt
    ]
  );

  try {
    await executeD1(
      `INSERT INTO user_oauth_identities
         (id, user_id, provider, provider_uid, email_at_link)
       VALUES (?, ?, ?, ?, ?)`,
      [identityId, user.id, input.provider, input.providerUserId, input.email]
    );
  } catch (error) {
    await executeD1(`DELETE FROM users WHERE id = ?`, [user.id]);
    const racedUser = await findUserByOAuthIdentity(input.provider, input.providerUserId);
    if (racedUser) {
      return racedUser;
    }
    throw error;
  }

  return user;
}
