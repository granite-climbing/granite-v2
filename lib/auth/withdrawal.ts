export const WITHDRAWAL_RETENTION_MONTHS = 6;

export type WithdrawalStatus = "active" | "recoverable" | "expired";

const HAS_TIMEZONE = /([zZ]|[+-]\d{2}:?\d{2})$/;

/**
 * D1 은 타임스탬프를 두 형식으로 저장한다.
 *   - `datetime('now')` 기본값: "2026-07-22 03:04:05" (UTC, 존 표시 없음)
 *   - 애플리케이션 INSERT: "2026-07-22T03:04:05.000Z"
 * 존 표시가 없는 쪽을 그대로 `new Date()` 에 넘기면 로컬 시간으로 해석되므로
 * UTC 임을 명시해서 파싱한다.
 */
function parseTimestamp(value: string): Date {
  const isoish = value.replace(" ", "T");
  return new Date(HAS_TIMEZONE.test(isoish) ? isoish : `${isoish}Z`);
}

/**
 * 탈퇴 신청 시각으로부터 데이터가 삭제될 시각.
 * 월말 보정은 JS Date 의 기본 동작을 따른다 (8/31 + 6개월 → 3/3).
 * 경계에서 며칠 차이는 정책상 문제되지 않아 별도 처리하지 않는다.
 */
export function getScheduledDeletionAt(withdrawAt: string): Date {
  const deletionAt = parseTimestamp(withdrawAt);
  if (Number.isNaN(deletionAt.getTime())) {
    return deletionAt;
  }

  deletionAt.setUTCMonth(deletionAt.getUTCMonth() + WITHDRAWAL_RETENTION_MONTHS);
  return deletionAt;
}

export function getWithdrawalStatus(withdrawAt: string | null, now: Date): WithdrawalStatus {
  if (!withdrawAt) {
    return "active";
  }

  const deletionAt = getScheduledDeletionAt(withdrawAt);
  if (Number.isNaN(deletionAt.getTime())) {
    // 값이 깨졌으면 복구를 제안하지 않는 쪽이 안전하다.
    return "expired";
  }

  return now.getTime() < deletionAt.getTime() ? "recoverable" : "expired";
}
