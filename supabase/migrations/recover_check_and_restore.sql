-- ============================================================
-- 5월 14일 숙제/포인트 복구용 (Supabase SQL Editor에서 실행)
-- 김연호 = students 테이블에서 이름 확인 후 student_id 사용
-- ============================================================

-- ① 먼저 남아 있는 흔적 확인
SELECT id, name FROM students;

SELECT * FROM homework_history
WHERE date IN ('2026-05-14', '2025-05-14')
ORDER BY student_id, date;

SELECT id, emoji FROM emotions
WHERE id LIKE '%__2026-05-14' OR id LIKE '%__2025-05-14';

-- ② emotions에 그날 기록이 있으면 → 완료했던 숙제 ID를 알 수 있음
--    (감정은 완료한 숙제에만 남는 경우가 많음)
--    아래는 student_id를 본인 DB 값으로 바꾼 뒤 실행 (예: student1)

-- 연호 student_id 확인:
-- SELECT id FROM students WHERE name LIKE '%연호%';

-- ③ 복구 예시: 2026-05-14 매일 숙제 1건 완료로 기록 삽입
-- homework_id / title 은 ②번 emotions id 앞부분 참고하거나, 기억나는 제목으로 수정
/*
INSERT INTO homework_history (
  id, homework_id, student_id, subject_id, title, date,
  is_daily, completed, scheduled_days, homework_created_at, archived_at
) VALUES (
  'hw-RECOVER-연호-2026-05-14__2026-05-14',
  'hw-RECOVER-연호-2026-05-14',
  'student1',
  NULL,
  '복구된 매일 숙제',
  '2026-05-14',
  true,
  true,
  '매일',
  '2026-05-01T00:00:00',
  now()::text
) ON CONFLICT (id) DO UPDATE SET completed = true;
*/

-- ④ emotions 기반 자동 복구 (2026-05-14, emotions 행이 있을 때만)
-- student_id 를 연호의 id로 바꾸세요
/*
INSERT INTO homework_history (
  id, homework_id, student_id, subject_id, title, date,
  is_daily, completed, scheduled_days, homework_created_at, archived_at
)
SELECT
  e.id,
  split_part(e.id, '__', 1),
  'student1',
  NULL,
  '복구(감정기록)',
  '2026-05-14',
  true,
  true,
  '매일',
  '2026-05-01T00:00:00',
  now()::text
FROM emotions e
WHERE e.id LIKE '%__2026-05-14'
ON CONFLICT (id) DO UPDATE SET completed = true;
*/
