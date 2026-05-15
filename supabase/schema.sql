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
--   신규 형식:
--     "__daily__|매일"             → 매일 반복 숙제, 모든 요일, 미완료
--     "__daily__|월,화"            → 매일 반복 숙제, 월·화 요일만, 미완료
--     "__daily__|화|YYYY-MM-DD"   → 매일 반복 숙제, 화 요일, 해당 날짜 완료
--   구형식 (하위 호환):
--     "__daily__"                 → 매일 반복 숙제, 모든 요일, 미완료
--     "__daily__:YYYY-MM-DD"      → 매일 반복 숙제, 모든 요일, 해당 날짜 완료
--   오늘만 숙제:
--     null / "YYYY-MM-DD"         → 오늘만 숙제 (일반 due date)
CREATE TABLE IF NOT EXISTS homework (
  id         text PRIMARY KEY,
  student_id text    NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id text,
  title      text    NOT NULL,
  due_date   text,               -- YYYY-MM-DD 또는 __daily__ 인코딩 값
  completed  boolean NOT NULL DEFAULT false,
  created_at text    NOT NULL   -- ISO 8601 문자열 (정렬용)
);

-- 숙제 감정 이모지 테이블
-- id: '{hwId}__{YYYY-MM-DD}' 형식의 고유 키
CREATE TABLE IF NOT EXISTS emotions (
  id    text PRIMARY KEY,   -- '{hwId}__{date}'
  emoji text NOT NULL
);

ALTER TABLE emotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_emotions" ON emotions FOR ALL TO anon USING (true) WITH CHECK (true);

-- 화이트보드(공지사항 + 답변) 테이블
-- type: 'notice' (공지, id='notice' 고정) | 'reply' (답변, id=타임스탬프)
CREATE TABLE IF NOT EXISTS whiteboard (
  id         text PRIMARY KEY,
  type       text NOT NULL,           -- 'notice' | 'reply'
  author     text,                    -- 공지: null, 답변: 작성자 이름
  content    text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- Row Level Security (RLS)
-- 이 앱은 인증 없이 사용하는 가족 전용 앱이므로
-- anon 키로 읽기/쓰기 모두 허용합니다.
-- =====================================================

ALTER TABLE students   ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework   ENABLE ROW LEVEL SECURITY;
ALTER TABLE whiteboard ENABLE ROW LEVEL SECURITY;

-- 각 테이블에 anon 전체 허용 정책 추가
CREATE POLICY "allow_all_students"   ON students   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_subjects"   ON subjects   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_sessions"   ON sessions   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_homework"   ON homework   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_whiteboard" ON whiteboard FOR ALL TO anon USING (true) WITH CHECK (true);
