-- 기존 DB에 homework_history 테이블 추가 (Supabase SQL Editor에서 실행)
CREATE TABLE IF NOT EXISTS homework_history (
  id                  text PRIMARY KEY,
  homework_id         text NOT NULL,
  student_id          text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id          text,
  title               text NOT NULL,
  date                text NOT NULL,
  is_daily            boolean NOT NULL DEFAULT true,
  completed           boolean NOT NULL DEFAULT false,
  scheduled_days      text NOT NULL DEFAULT '매일',
  homework_created_at text NOT NULL,
  archived_at         text NOT NULL
);

ALTER TABLE homework_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "allow_all_homework_history" ON homework_history FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
