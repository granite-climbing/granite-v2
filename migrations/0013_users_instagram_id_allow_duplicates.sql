-- 0013: users.instagram_id 중복 허용
-- 0009에서 만든 partial UNIQUE 인덱스(idx_users_instagram_id) 때문에
-- 동일한 인스타그램 ID로 가입 시 UNIQUE constraint 오류가 발생했다.
-- 조회 성능을 위해 인덱스는 유지하되 UNIQUE 제약만 제거한다.

DROP INDEX IF EXISTS idx_users_instagram_id;

CREATE INDEX IF NOT EXISTS idx_users_instagram_id ON users (instagram_id)
  WHERE instagram_id IS NOT NULL AND deleted_at IS NULL;
