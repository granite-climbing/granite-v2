-- 회원 탈퇴 신청 시각. NULL 이면 정상 계정.
-- 값이 있으면 탈퇴 유예 상태이며, 6개월이 지나면 만료로 판정한다
-- (lib/auth/withdrawal.ts). 실제 삭제 시각은 기존 deleted_at 에 기록한다.
ALTER TABLE users ADD COLUMN withdraw_at TEXT;

CREATE INDEX IF NOT EXISTS idx_users_withdraw_at
  ON users (withdraw_at) WHERE withdraw_at IS NOT NULL;
