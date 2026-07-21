/**
 * 마이페이지 "공개여부" 토글 설정. 여러 항목의 공개 여부를 users 테이블의
 * 단일 컬럼(`privacy_visibility`, JSON 문자열)에 한 번에 저장한다.
 */

export type PrivacyVisibilityKey =
  | "instagram"
  | "youtube"
  | "height"
  | "apeIndex"
  | "weight"
  | "records"
  | "projects";

export type PrivacyVisibility = Record<PrivacyVisibilityKey, boolean>;

type PrivacyItem = { key: PrivacyVisibilityKey; label: string };

/** 렌더 순서 = 저장 키 정의. 라벨은 UI와 토스트 메시지에 함께 쓰인다. */
export const PRIVACY_VISIBILITY_ITEMS: readonly PrivacyItem[] = [
  { key: "instagram", label: "Instagram 계정" },
  { key: "youtube", label: "Youtube 계정" },
  { key: "height", label: "키" },
  { key: "apeIndex", label: "암 스팬" },
  { key: "weight", label: "몸무게" },
  { key: "records", label: "기록" },
  { key: "projects", label: "프로젝트" }
];

const PRIVACY_KEYS = PRIVACY_VISIBILITY_ITEMS.map((item) => item.key);

/** 저장값이 없으면 전 항목 비공개(false)가 기본. */
export function defaultPrivacyVisibility(): PrivacyVisibility {
  return PRIVACY_KEYS.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {} as PrivacyVisibility);
}

function isPrivacyKey(value: string): value is PrivacyVisibilityKey {
  return (PRIVACY_KEYS as string[]).includes(value);
}

/** DB의 JSON 문자열(또는 null)을 안전하게 파싱. 알 수 없는 키/형식은 무시. */
export function parsePrivacyVisibility(raw: string | null | undefined): PrivacyVisibility {
  const result = defaultPrivacyVisibility();
  if (!raw) {
    return result;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return result;
  }
  if (!parsed || typeof parsed !== "object") {
    return result;
  }
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (isPrivacyKey(key) && typeof value === "boolean") {
      result[key] = value;
    }
  }
  return result;
}

export function serializePrivacyVisibility(value: PrivacyVisibility): string {
  return JSON.stringify(value);
}

/** patch를 검증해 알려진 boolean 키만 남긴다. */
export function sanitizePrivacyPatch(patch: Record<string, unknown>): Partial<PrivacyVisibility> {
  const clean: Partial<PrivacyVisibility> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (isPrivacyKey(key) && typeof value === "boolean") {
      clean[key] = value;
    }
  }
  return clean;
}
