-- 기록 추가 시 한줄평(comment)과 체감 난이도(felt_grade_num, V-scale 0~12)를 저장한다.
-- Roll-forward only.

ALTER TABLE user_records ADD COLUMN comment TEXT;
ALTER TABLE user_records ADD COLUMN felt_grade_num INTEGER;
