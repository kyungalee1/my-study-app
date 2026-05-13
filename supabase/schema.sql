-- =====================================================
-- 공부 관리 앱 - Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 실행하세요
-- =====================================================

-- 학생 테이블
CREATE TABLE IF NOT EXISTS students (
  id    text PRIMARY KEY,
  name  text NOT NULL,
  grade text NOT NULL DEFAULT '중1',
  avatar text NOT NULL DEFAULT '🦁',
  color  text NOT NULL DEFAULT '#3182F6',
  photo  text          -- base64 data URL (선택)
);

-- 과목 테이블
CREATE TABLE IF NOT EXISTS subjects (
  id                     text PRIMARY KEY,
  student_id             text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  name                   text NOT NULL,
  color                  text NOT NULL DEFAULT '#3182F6',
  weekly_target_minutes  integer NOT NULL DEFAULT 0
);

-- 공부 세션 테이블
CREATE TABLE IF NOT EXISTS sessions (
  id               text PRIMARY KEY,
  student_id       text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id       text NOT NULL,
  date             text NOT NULL,   -- YYYY-MM-DD
  duration_minutes integer NOT NULL DEFAULT 0
);

-- 숙제 테이블
-- due_date 인코딩 규칙:
--   "__daily__"            → 매일 반복 숙제, 오늘 미완료
--   "__daily__:YYYY-MM-DD" → 매일 반복 숙제, 해당 날짜 완료
--   null / "YYYY-MM-DD"    → 오늘만 숙제 (일반 due date)
CREATE TABLE IF NOT EXISTS homework (
  id         text PRIMARY KEY,
  student_id text    NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id text,
  title      text    NOT NULL,
  due_date   text,               -- YYYY-MM-DD 또는 __daily__ 인코딩 값
  completed  boolean NOT NULL DEFAULT false,
  created_at text    NOT NULL   -- ISO 8601 문자열 (정렬용)
);

-- =====================================================
-- Row Level Security (RLS)
-- 이 앱은 인증 없이 사용하는 가족 전용 앱이므로
-- anon 키로 읽기/쓰기 모두 허용합니다.
-- =====================================================

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework  ENABLE ROW LEVEL SECURITY;

-- 각 테이블에 anon 전체 허용 정책 추가
CREATE POLICY "allow_all_students" ON students FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_subjects" ON subjects FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_sessions" ON sessions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_homework" ON homework  FOR ALL TO anon USING (true) WITH CHECK (true);
