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
  dueDate: string | null; // YYYY-MM-DD
  completed: boolean;     // one-time: 영구 완료 여부
  completedDate: string | null; // daily: 오늘 완료한 날짜(YYYY-MM-DD), null이면 미완료
  createdAt: string;
  isDaily: boolean;       // true: 매일 반복 숙제 / false: 오늘만 숙제
}

export interface AppData {
  students: Student[];
  subjects: Subject[];
  sessions: StudySession[];
  homework: HomeworkItem[];
}
