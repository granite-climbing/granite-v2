-- 마이페이지 "공개여부" 토글. 여러 항목의 공개 여부를 JSON 문자열로 단일 컬럼에 저장.
-- NULL 이면 전 항목 비공개(false)가 기본값 (lib/user/privacy-visibility.ts).
ALTER TABLE users ADD COLUMN privacy_visibility TEXT;
