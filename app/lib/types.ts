export type StudentId = 'student1' | 'student2';

export interface Student {
  id: StudentId;
  name: string;
  grade: string;
  avatar: string;
  color: string;
  photo?: string; // base64 data URL
}

export interface Subject {
  id: string;
  studentId: StudentId;
  name: string;
  color: string;
  weeklyTargetMinutes: number;
}

export interface StudySession {
  id: string;
  studentId: StudentId;
  subjectId: string;
  date: string; // YYYY-MM-DD
  durationMinutes: number;
}

export interface HomeworkItem {
  id: string;
  studentId: StudentId;
  subjectId: string | null;
  title: string;
  dueDate: string | null;   // YYYY-MM-DD
  completed: boolean;       // one-time: 영구 완료 여부
  completedDates: string[]; // daily: 완료한 날짜들(YYYY-MM-DD) — 오늘 이후만 유지
  createdAt: string;
  isDaily: boolean;         // true: 매일 반복 숙제 / false: 오늘만 숙제
  scheduledDays: string[];  // daily 전용: ['매일'] 또는 ['월','화'] 등 요일 배열
}

/** 과거 날짜 숙제 상태 스냅샷 (삭제·수정해도 보존) */
export interface HomeworkHistoryRecord {
  id: string;               // '{homeworkId}__{YYYY-MM-DD}'
  homeworkId: string;
  studentId: StudentId;
  subjectId: string | null;
  title: string;
  date: string;             // YYYY-MM-DD
  isDaily: boolean;
  completed: boolean;
  scheduledDays: string[];
  homeworkCreatedAt: string;
  archivedAt: string;
}

/** 매일 숙제 면제일 (여행·소풍 등) — 패널티·보너스 모두 제외 */
export interface ExemptDate {
  date: string;   // YYYY-MM-DD
  label: string;  // 예: 여행, 소풍
}

export interface AppData {
  students: Student[];
  subjects: Subject[];
  sessions: StudySession[];
  homework: HomeworkItem[];
  homeworkHistory: HomeworkHistoryRecord[];
  exemptDates: ExemptDate[];
}
