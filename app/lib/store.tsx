'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { AppData, Student, Subject, StudySession, HomeworkItem, StudentId } from './types';
import { defaultData } from './defaults';
import { db } from './supabase';

// ─── DB Row Types (snake_case) ────────────────────────────────────────────────

interface StudentRow {
  id: string;
  name: string;
  grade: string;
  avatar: string;
  color: string;
  photo: string | null;
}
interface SubjectRow {
  id: string;
  student_id: string;
  name: string;
  color: string;
  weekly_target_minutes: number;
}
interface SessionRow {
  id: string;
  student_id: string;
  subject_id: string;
  date: string;
  duration_minutes: number;
}

/**
 * DB에 저장되는 숙제 Row.
 * 기존 스키마 컬럼만 사용하며, is_daily / completed_date 정보는
 * due_date 필드에 인코딩합니다.
 *
 * 인코딩 규칙 (due_date 값):
 *   "__daily__"           → 매일 숙제, 오늘 미완료
 *   "__daily__:YYYY-MM-DD" → 매일 숙제, 해당 날짜에 완료
 *   null / "YYYY-MM-DD"   → 오늘만 숙제 (일반 동작)
 */
interface HomeworkRow {
  id: string;
  student_id: string;
  subject_id: string | null;
  title: string;
  due_date: string | null;
  completed: boolean;
  created_at: string;
}

// ─── Converters ───────────────────────────────────────────────────────────────

function rowToStudent(r: StudentRow): Student {
  return { id: r.id as StudentId, name: r.name, grade: r.grade, avatar: r.avatar, color: r.color, photo: r.photo ?? undefined };
}
function studentToRow(s: Student): StudentRow {
  return { id: s.id, name: s.name, grade: s.grade, avatar: s.avatar, color: s.color, photo: s.photo ?? null };
}
function rowToSubject(r: SubjectRow): Subject {
  return { id: r.id, studentId: r.student_id as StudentId, name: r.name, color: r.color, weeklyTargetMinutes: r.weekly_target_minutes };
}
function subjectToRow(s: Subject): SubjectRow {
  return { id: s.id, student_id: s.studentId, name: s.name, color: s.color, weekly_target_minutes: s.weeklyTargetMinutes };
}
function rowToSession(r: SessionRow): StudySession {
  return { id: r.id, studentId: r.student_id as StudentId, subjectId: r.subject_id, date: r.date, durationMinutes: r.duration_minutes };
}
function sessionToRow(s: StudySession): SessionRow {
  return { id: s.id, student_id: s.studentId, subject_id: s.subjectId, date: s.date, duration_minutes: s.durationMinutes };
}

/** due_date 인코딩: isDaily/completedDate → due_date 문자열 */
function encodeDueDate(isDaily: boolean, completedDate: string | null, actualDueDate: string | null): string | null {
  if (!isDaily) return actualDueDate;
  return completedDate ? `__daily__:${completedDate}` : '__daily__';
}

/** due_date 디코딩: due_date 문자열 → isDaily/completedDate/dueDate */
function decodeDueDate(dueDate: string | null): { isDaily: boolean; completedDate: string | null; actualDueDate: string | null } {
  if (dueDate?.startsWith('__daily__')) {
    const completedDate = dueDate.startsWith('__daily__:') ? dueDate.slice('__daily__:'.length) : null;
    return { isDaily: true, completedDate, actualDueDate: null };
  }
  return { isDaily: false, completedDate: null, actualDueDate: dueDate };
}

function rowToHomework(r: HomeworkRow): HomeworkItem {
  const { isDaily, completedDate, actualDueDate } = decodeDueDate(r.due_date);
  return {
    id: r.id,
    studentId: r.student_id as StudentId,
    subjectId: r.subject_id,
    title: r.title,
    dueDate: actualDueDate,
    completed: r.completed,
    completedDate,
    createdAt: r.created_at,
    isDaily,
  };
}
function homeworkToRow(h: HomeworkItem): HomeworkRow {
  return {
    id: h.id,
    student_id: h.studentId,
    subject_id: h.subjectId,
    title: h.title,
    due_date: encodeDueDate(h.isDaily, h.completedDate, h.dueDate),
    completed: h.completed,
    created_at: h.createdAt,
  };
}

// ─── Supabase Helpers ─────────────────────────────────────────────────────────

async function loadFromSupabase(): Promise<AppData | null> {
  if (!db) return null;
  const [studentsRes, subjectsRes, sessionsRes, homeworkRes] = await Promise.all([
    db.from('students').select('*'),
    db.from('subjects').select('*'),
    db.from('sessions').select('*'),
    db.from('homework').select('*').order('created_at', { ascending: true }),
  ]);
  if (studentsRes.error) throw studentsRes.error;
  if (!studentsRes.data || studentsRes.data.length === 0) return null;
  return {
    students: (studentsRes.data as StudentRow[]).map(rowToStudent),
    subjects: ((subjectsRes.data ?? []) as SubjectRow[]).map(rowToSubject),
    sessions: ((sessionsRes.data ?? []) as SessionRow[]).map(rowToSession),
    homework: ((homeworkRes.data ?? []) as HomeworkRow[]).map(rowToHomework),
  };
}

async function seedToSupabase(data: AppData) {
  if (!db) return;
  await db.from('students').insert(data.students.map(studentToRow));
  if (data.subjects.length > 0) await db.from('subjects').insert(data.subjects.map(subjectToRow));
  if (data.sessions.length > 0)  await db.from('sessions').insert(data.sessions.map(sessionToRow));
  if (data.homework.length > 0)  await db.from('homework').insert(data.homework.map(homeworkToRow));
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AppContextValue {
  data: AppData;
  loading: boolean;
  updateStudent: (id: StudentId, updates: Partial<Student>) => void;
  addSubject: (subject: Subject) => void;
  updateSubject: (id: string, updates: Partial<Subject>) => void;
  deleteSubject: (id: string) => void;
  addSession: (session: StudySession) => void;
  deleteSession: (id: string) => void;
  addHomework: (item: HomeworkItem) => void;
  updateHomework: (id: string, updates: Partial<HomeworkItem>) => void;
  deleteHomework: (id: string) => void;
  getStudentSubjects: (studentId: StudentId) => Subject[];
  getWeekSessions: (studentId: StudentId) => StudySession[];
  getTodaySessions: (studentId: StudentId) => StudySession[];
  getStudentHomework: (studentId: StudentId) => HomeworkItem[];
  todayString: () => string;
  weekStartString: () => string;
}

const AppContext = createContext<AppContextValue | null>(null);

function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ─── 자동 정리: 이번 달 이전 데이터 삭제 ────────────────────────────────────

function getMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * 매월 초 기준으로 오래된 데이터를 자동 삭제한다.
 * - 오늘만 숙제(isDaily=false): 이번 달 이전 항목 삭제
 * - 학습 세션: 이번 달 이전 항목 삭제
 * - 매일 숙제(isDaily=true): 영구 보존 (반복 템플릿)
 */
async function cleanupOldData(loadedData: AppData): Promise<AppData> {
  const monthStart = getMonthStart();

  const oldOneTimeIds = loadedData.homework
    .filter(h => !h.isDaily && h.createdAt.split('T')[0] < monthStart)
    .map(h => h.id);

  const oldSessionIds = loadedData.sessions
    .filter(s => s.date < monthStart)
    .map(s => s.id);

  if (oldOneTimeIds.length === 0 && oldSessionIds.length === 0) return loadedData;

  if (db) {
    if (oldOneTimeIds.length > 0) {
      const { error } = await db.from('homework').delete().in('id', oldOneTimeIds);
      if (error) console.warn('cleanupOldData(homework):', error);
    }
    if (oldSessionIds.length > 0) {
      const { error } = await db.from('sessions').delete().in('id', oldSessionIds);
      if (error) console.warn('cleanupOldData(sessions):', error);
    }
  }

  return {
    ...loadedData,
    homework: loadedData.homework.filter(h => !oldOneTimeIds.includes(h.id)),
    sessions: loadedData.sessions.filter(s => !oldSessionIds.includes(s.id)),
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(defaultData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        let loaded = await loadFromSupabase();
        if (!loaded) {
          // DB가 비어 있으면 localStorage 데이터를 마이그레이션하거나 기본값으로 시드
          let seedData = defaultData;
          try {
            const stored = localStorage.getItem('study-app-data');
            if (stored) {
              const parsed = JSON.parse(stored) as AppData;
              if (parsed.students?.length > 0) seedData = { ...defaultData, ...parsed };
            }
          } catch { /* ignore */ }
          await seedToSupabase(seedData);
          loaded = seedData;
        }
        // 이번 달 이전 불필요 데이터 자동 정리
        loaded = await cleanupOldData(loaded);
        setData(loaded);
      } catch (err) {
        // Supabase 연결 실패 시 localStorage 폴백
        console.warn('Supabase 연결 실패, localStorage 폴백 사용:', err);
        try {
          const stored = localStorage.getItem('study-app-data');
          if (stored) {
            const fallback: AppData = { ...defaultData, ...JSON.parse(stored) };
            // localStorage 폴백에서도 오래된 데이터 정리 (DB 삭제 없이 메모리만)
            const monthStart = getMonthStart();
            setData({
              ...fallback,
              homework: fallback.homework.filter(
                h => h.isDaily || h.createdAt.split('T')[0] >= monthStart
              ),
              sessions: fallback.sessions.filter(s => s.date >= monthStart),
            });
          }
        } catch { /* ignore */ }
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // ─── Mutations (낙관적 업데이트 + Supabase 비동기 동기화) ─────────────────

  const updateStudent = useCallback((id: StudentId, updates: Partial<Student>) => {
    setData(prev => {
      const next = { ...prev, students: prev.students.map(s => s.id === id ? { ...s, ...updates } : s) };
      if (db) {
        const row = studentToRow(next.students.find(s => s.id === id)!);
        db.from('students').update(row).eq('id', id)
          .then(({ error }) => { if (error) console.error('updateStudent:', error); });
      }
      return next;
    });
  }, []);

  const addSubject = useCallback((subject: Subject) => {
    setData(prev => {
      const next = { ...prev, subjects: [...prev.subjects, subject] };
      if (db) {
        db.from('subjects').insert(subjectToRow(subject))
          .then(({ error }) => { if (error) console.error('addSubject:', error); });
      }
      return next;
    });
  }, []);

  const updateSubject = useCallback((id: string, updates: Partial<Subject>) => {
    setData(prev => {
      const next = { ...prev, subjects: prev.subjects.map(s => s.id === id ? { ...s, ...updates } : s) };
      if (db) {
        const row = subjectToRow(next.subjects.find(s => s.id === id)!);
        db.from('subjects').update(row).eq('id', id)
          .then(({ error }) => { if (error) console.error('updateSubject:', error); });
      }
      return next;
    });
  }, []);

  const deleteSubject = useCallback((id: string) => {
    setData(prev => {
      const next = { ...prev, subjects: prev.subjects.filter(s => s.id !== id) };
      if (db) {
        db.from('subjects').delete().eq('id', id)
          .then(({ error }) => { if (error) console.error('deleteSubject:', error); });
      }
      return next;
    });
  }, []);

  const addSession = useCallback((session: StudySession) => {
    setData(prev => {
      const next = { ...prev, sessions: [...prev.sessions, session] };
      if (db) {
        db.from('sessions').insert(sessionToRow(session))
          .then(({ error }) => { if (error) console.error('addSession:', error); });
      }
      return next;
    });
  }, []);

  const deleteSession = useCallback((id: string) => {
    setData(prev => {
      const next = { ...prev, sessions: prev.sessions.filter(s => s.id !== id) };
      if (db) {
        db.from('sessions').delete().eq('id', id)
          .then(({ error }) => { if (error) console.error('deleteSession:', error); });
      }
      return next;
    });
  }, []);

  const addHomework = useCallback((item: HomeworkItem) => {
    setData(prev => {
      const next = { ...prev, homework: [...prev.homework, item] };
      if (db) {
        db.from('homework').insert(homeworkToRow(item))
          .then(({ error }) => { if (error) console.error('addHomework:', error); });
      }
      return next;
    });
  }, []);

  const updateHomework = useCallback((id: string, updates: Partial<HomeworkItem>) => {
    setData(prev => {
      const next = { ...prev, homework: prev.homework.map(h => h.id === id ? { ...h, ...updates } : h) };
      if (db) {
        const updatedItem = next.homework.find(h => h.id === id)!;
        const dbUpdates: Partial<HomeworkRow> = {};
        if ('completed' in updates) dbUpdates.completed  = updates.completed;
        if ('title'     in updates) dbUpdates.title       = updates.title;
        if ('subjectId' in updates) dbUpdates.subject_id  = updates.subjectId ?? null;
        // isDaily, completedDate, dueDate 중 하나라도 변경되면 due_date 재인코딩
        if ('isDaily' in updates || 'completedDate' in updates || 'dueDate' in updates) {
          dbUpdates.due_date = encodeDueDate(
            updatedItem.isDaily,
            updatedItem.completedDate,
            updatedItem.dueDate,
          );
        }
        db.from('homework').update(dbUpdates).eq('id', id)
          .then(({ error }) => { if (error) console.error('updateHomework:', error); });
      }
      return next;
    });
  }, []);

  const deleteHomework = useCallback((id: string) => {
    setData(prev => {
      const next = { ...prev, homework: prev.homework.filter(h => h.id !== id) };
      if (db) {
        db.from('homework').delete().eq('id', id)
          .then(({ error }) => { if (error) console.error('deleteHomework:', error); });
      }
      return next;
    });
  }, []);

  // ─── Selectors ────────────────────────────────────────────────────────────

  const getStudentSubjects = useCallback((studentId: StudentId) =>
    data.subjects.filter(s => s.studentId === studentId), [data.subjects]);

  const getWeekSessions = useCallback((studentId: StudentId) => {
    const weekStart = toDateStr(getWeekStart());
    return data.sessions.filter(s => s.studentId === studentId && s.date >= weekStart);
  }, [data.sessions]);

  const getTodaySessions = useCallback((studentId: StudentId) => {
    const today = toDateStr(new Date());
    return data.sessions.filter(s => s.studentId === studentId && s.date === today);
  }, [data.sessions]);

  const getStudentHomework = useCallback((studentId: StudentId) =>
    data.homework.filter(h => h.studentId === studentId), [data.homework]);

  const todayString    = useCallback(() => toDateStr(new Date()), []);
  const weekStartString = useCallback(() => toDateStr(getWeekStart()), []);

  return (
    <AppContext.Provider value={{
      data, loading,
      updateStudent,
      addSubject, updateSubject, deleteSubject,
      addSession, deleteSession,
      addHomework, updateHomework, deleteHomework,
      getStudentSubjects, getWeekSessions, getTodaySessions, getStudentHomework,
      todayString, weekStartString,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
