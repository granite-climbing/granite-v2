import { describe, expect, it } from "vitest";
import {
  getScheduledDeletionAt,
  getWithdrawalStatus,
  WITHDRAWAL_RETENTION_MONTHS
} from "./withdrawal";

// 탈퇴 신청: 2026-01-22T00:00:00Z → 삭제 예정: 2026-07-22T00:00:00Z
const WITHDRAW_AT_ISO = "2026-01-22T00:00:00.000Z";

describe("getWithdrawalStatus", () => {
  it("보관 기간은 6개월이다", () => {
    expect(WITHDRAWAL_RETENTION_MONTHS).toBe(6);
  });

  it("withdraw_at 이 null 이면 active", () => {
    expect(getWithdrawalStatus(null, new Date("2026-07-22T00:00:00.000Z"))).toBe("active");
  });

  it("6개월 되기 1초 전이면 recoverable", () => {
    expect(getWithdrawalStatus(WITHDRAW_AT_ISO, new Date("2026-07-21T23:59:59.000Z"))).toBe(
      "recoverable"
    );
  });

  it("정확히 6개월이 되는 순간 expired", () => {
    expect(getWithdrawalStatus(WITHDRAW_AT_ISO, new Date("2026-07-22T00:00:00.000Z"))).toBe(
      "expired"
    );
  });

  it("6개월 하루 뒤면 expired", () => {
    expect(getWithdrawalStatus(WITHDRAW_AT_ISO, new Date("2026-07-23T00:00:00.000Z"))).toBe(
      "expired"
    );
  });

  it("SQLite datetime('now') 형식을 UTC 로 해석한다", () => {
    // 존 표시가 없다고 로컬 시간으로 읽으면 KST 환경에서 9시간 어긋난다.
    expect(getWithdrawalStatus("2026-01-22 00:00:00", new Date("2026-07-21T23:59:59.000Z"))).toBe(
      "recoverable"
    );
    expect(getWithdrawalStatus("2026-01-22 00:00:00", new Date("2026-07-22T00:00:01.000Z"))).toBe(
      "expired"
    );
  });

  it("파싱할 수 없는 값은 expired 로 처리한다", () => {
    expect(getWithdrawalStatus("not-a-date", new Date("2026-07-22T00:00:00.000Z"))).toBe("expired");
  });
});

describe("getScheduledDeletionAt", () => {
  it("탈퇴 신청일에 6개월을 더한다", () => {
    expect(getScheduledDeletionAt(WITHDRAW_AT_ISO).toISOString()).toBe("2026-07-22T00:00:00.000Z");
  });

  it("SQLite 형식도 같은 결과를 낸다", () => {
    expect(getScheduledDeletionAt("2026-01-22 00:00:00").toISOString()).toBe(
      "2026-07-22T00:00:00.000Z"
    );
  });
});
