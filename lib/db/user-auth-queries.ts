import { randomUUID } from "node:crypto";
import { batchD1, executeD1, executeD1Meta, queryD1, queryD1First } from "./d1-http";
import type { User, UserOAuthIdentity } from "./schema";
import type { OAuthProfile, OAuthProviderId } from "@/lib/auth/oauth/types";
import type { ProfileInput } from "@/lib/profile/profile-input";

export type CompletedSignupInput = {
  provider: OAuthProviderId;
  providerUserId: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  instagramId: string | null;
  youtubeUrl: string | null;
  gender: "male" | "female" | null;
  heightCm: number | null;
  apeIndexCm: number | null;
  weightKg: number | null;
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
  weightKg: number | null;
  topBoulderingGrade: string | null;
  topSportGrade: string | null;
  privacyVisibility: string | null;
  onboardingCompletedAt: string | null;
  withdrawAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type UserOAuthIdentitySqlRow = {
  id: string;
  userId: string;
  provider: UserOAuthIdentity["provider"];
  providerUid: string;
  emailAtLink: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapUser(row: UserSqlRow | null): User | null {
  return row;
}

/**
 * users 조회 컬럼 목록. 세 군데에서 쓰던 것을 모았다.
 * alias 가 있으면 JOIN 쿼리용으로 접두사를 붙인다.
 */
function userColumns(alias?: string): string {
  const p = alias ? `${alias}.` : "";
  return `${p}id,
       ${p}display_name AS displayName,
       ${p}email,
       ${p}avatar_url AS avatarUrl,
       ${p}instagram_id AS instagramId,
       ${p}youtube_id AS youtubeId,
       ${p}gender,
       ${p}height_cm AS heightCm,
       ${p}ape_index_cm AS apeIndexCm,
       ${p}weight_kg AS weightKg,
       ${p}top_bouldering_grade AS topBoulderingGrade,
       ${p}top_sport_grade AS topSportGrade,
       ${p}privacy_visibility AS privacyVisibility,
       ${p}onboarding_completed_at AS onboardingCompletedAt,
       ${p}withdraw_at AS withdrawAt,
       ${p}deleted_at AS deletedAt,
       ${p}created_at AS createdAt,
       ${p}updated_at AS updatedAt`;
}

export async function findActiveUserById(id: string): Promise<User | null> {
  const row = await queryD1First<UserSqlRow>(
    `SELECT
       ${userColumns()}
     FROM users
     WHERE id = ? AND deleted_at IS NULL AND withdraw_at IS NULL
     LIMIT 1`,
    [id]
  );

  return mapUser(row);
}

/**
 * 탈퇴 유예 중인 계정만 찾는다. 복구 확인 화면과 복구 액션이
 * 세션 없이 사용자를 확인할 때 쓴다.
 */
export async function findWithdrawnUserById(id: string): Promise<User | null> {
  const row = await queryD1First<UserSqlRow>(
    `SELECT
       ${userColumns()}
     FROM users
     WHERE id = ? AND deleted_at IS NULL AND withdraw_at IS NOT NULL
     LIMIT 1`,
    [id]
  );

  return mapUser(row);
}

export async function findOAuthIdentitiesByUserId(userId: string): Promise<UserOAuthIdentity[]> {
  return queryD1<UserOAuthIdentitySqlRow>(
    `SELECT
       id,
       user_id AS userId,
       provider,
       provider_uid AS providerUid,
       email_at_link AS emailAtLink,
       created_at AS createdAt,
       updated_at AS updatedAt
     FROM user_oauth_identities
     WHERE user_id = ?
     ORDER BY created_at ASC`,
    [userId]
  );
}

/**
 * 로그인 시도에 쓰는 조회. 탈퇴 유예 중인 계정도 돌려준다.
 * 세션을 줄지 복구를 제안할지는 lib/auth/login-resolution.ts 가 판단한다.
 */
export async function findLoginCandidateByOAuthIdentity(
  provider: OAuthProviderId,
  providerUid: string
): Promise<User | null> {
  const row = await queryD1First<UserSqlRow>(
    `SELECT
       ${userColumns("u")}
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
  const existing = await findLoginCandidateByOAuthIdentity(profile.provider, profile.providerUserId);
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
    weightKg: null,
    topBoulderingGrade: null,
    topSportGrade: null,
    privacyVisibility: null,
    onboardingCompletedAt: now,
    withdrawAt: null,
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
    const racedUser = await findLoginCandidateByOAuthIdentity(profile.provider, profile.providerUserId);
    if (racedUser) {
      return racedUser;
    }
    throw error;
  }

  return user;
}

export async function createUserForCompletedSignup(input: CompletedSignupInput): Promise<User> {
  const existing = await findLoginCandidateByOAuthIdentity(input.provider, input.providerUserId);
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
    youtubeId: input.youtubeUrl,
    gender: input.gender,
    heightCm: input.heightCm,
    apeIndexCm: input.apeIndexCm,
    weightKg: input.weightKg,
    topBoulderingGrade: input.topBoulderingGrade,
    topSportGrade: input.topSportGrade,
    privacyVisibility: null,
    onboardingCompletedAt: now,
    withdrawAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now
  };
  const identityId = `oauth_${randomUUID()}`;

  await executeD1(
    `INSERT INTO users
       (id, display_name, email, avatar_url, instagram_id, youtube_id, gender, height_cm, ape_index_cm, weight_kg,
        top_bouldering_grade, top_sport_grade, onboarding_completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      user.displayName,
      user.email,
      user.avatarUrl,
      user.instagramId,
      user.youtubeId,
      user.gender,
      user.heightCm,
      user.apeIndexCm,
      user.weightKg,
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
    const racedUser = await findLoginCandidateByOAuthIdentity(input.provider, input.providerUserId);
    if (racedUser) {
      return racedUser;
    }
    throw error;
  }

  return user;
}

/**
 * "공개여부" 토글 전체를 JSON 문자열로 단일 컬럼에 저장한다.
 * 병합/기본값 처리는 호출 측(Server Action)에서 수행하고, 여기서는 저장만 담당.
 */
export async function updateUserPrivacyVisibility(userId: string, privacyVisibilityJson: string): Promise<void> {
  await executeD1(
    `UPDATE users
       SET privacy_visibility = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND deleted_at IS NULL`,
    [privacyVisibilityJson, userId]
  );
}

export async function updateUserProfile(userId: string, profile: ProfileInput): Promise<void> {
  await executeD1(
    `UPDATE users SET display_name = ?, instagram_id = ?, youtube_id = ?, gender = ?, height_cm = ?, ape_index_cm = ?, weight_kg = ?, top_bouldering_grade = ?, top_sport_grade = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL AND withdraw_at IS NULL`,
    [profile.displayName, profile.instagramId, profile.youtubeUrl, profile.gender, profile.heightCm, profile.apeIndexCm, profile.weightKg, profile.topBoulderingGrade, profile.topSportGrade, userId]
  );
}

/**
 * 탈퇴 신청. 이미 탈퇴했거나 삭제된 계정이면 아무것도 바꾸지 않고 false.
 */
export async function markUserWithdrawn(userId: string): Promise<boolean> {
  const { changes } = await executeD1Meta(
    `UPDATE users
        SET withdraw_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND withdraw_at IS NULL AND deleted_at IS NULL`,
    [userId]
  );

  return changes > 0;
}

/**
 * 탈퇴 취소. 유예 중이 아닌 계정이면 false.
 * 6개월 경과 여부는 호출 측에서 판단한다 (lib/auth/withdrawal.ts).
 */
export async function restoreWithdrawnUser(userId: string): Promise<boolean> {
  const { changes } = await executeD1Meta(
    `UPDATE users
        SET withdraw_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND withdraw_at IS NOT NULL AND deleted_at IS NULL`,
    [userId]
  );

  return changes > 0;
}

/**
 * 보관 기간이 지난 계정을 로그인 시점에 정리한다.
 * 개인정보 익명화는 하지 않는다. OAuth identity 를 끊어서 같은 소셜 계정으로
 * 새로 가입할 수 있게 하는 것이 목적이다.
 *
 * 두 문장을 한 배치로 보낸다. 나눠 보내면 UPDATE 만 성공하고 DELETE 가 실패했을 때
 * deleted_at 은 찍혔는데 identity 가 남아, 이후 로그인이 조회에서 걸러지고
 * 재가입은 UNIQUE(provider, provider_uid) 로 막히는 영구 잠금 상태가 된다.
 */
export async function purgeExpiredWithdrawnUser(userId: string): Promise<void> {
  await batchD1([
    {
      sql: `UPDATE users
               SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND withdraw_at IS NOT NULL AND deleted_at IS NULL`,
      params: [userId],
      map: () => undefined
    },
    {
      // 같은 배치라 위 UPDATE 의 결과를 본다. 실제로 삭제 표시된 계정일 때만
      // identity 를 끊으므로, 정상 계정에 잘못 호출돼도 로그인 수단이 날아가지 않는다.
      // 앞선 시도가 UPDATE 만 남기고 죽었더라도 다시 호출하면 여기서 정리된다.
      sql: `DELETE FROM user_oauth_identities
             WHERE user_id = ?
               AND EXISTS (SELECT 1 FROM users WHERE id = ? AND deleted_at IS NOT NULL)`,
      params: [userId, userId],
      map: () => undefined
    }
  ]);
}
