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
 * 기존 스키마 컬럼만 사용하며, is_daily / completed_date / scheduledDays 정보는
 * due_date 필드에 인코딩합니다.
 *
 * 인코딩 규칙 (due_date 값):
 *   신규 형식:
 *     "__daily__|매일"              → 매일 숙제, 모든 요일, 미완료
 *     "__daily__|월,화"             → 매일 숙제, 월·화 요일만, 미완료
 *     "__daily__|화|YYYY-MM-DD"    → 매일 숙제, 화 요일, 해당 날짜 완료
 *   구형식 (하위 호환):
 *     "__daily__"                  → 매일 숙제, 모든 요일, 미완료
 *     "__daily__:YYYY-MM-DD"       → 매일 숙제, 모든 요일, 해당 날짜 완료
 *   오늘만 숙제:
 *     null / "YYYY-MM-DD"          → 오늘만 숙제
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

/**
 * due_date 인코딩: isDaily/completedDates/scheduledDays → due_date 문자열
 *
 * 인코딩 규칙:
 *   daily:   "__daily__|매일"              → 매일 숙제, 미완료
 *            "__daily__|월,화"             → 매일 숙제, 월·화, 미완료
 *            "__daily__|월,화|2026-05-12;2026-05-13" → 해당 날짜들에 완료
 *   one-time: null / "YYYY-MM-DD"
 */
function encodeDueDate(
  isDaily: boolean,
  completedDates: string[],
  actualDueDate: string | null,
  scheduledDays: string[],
): string | null {
  if (!isDaily) return actualDueDate;
  const daysStr =
    scheduledDays.length === 0 || scheduledDays.includes('매일')
      ? '매일'
      : scheduledDays.join(',');
  const datesStr = completedDates.length > 0 ? completedDates.join(';') : '';
  return datesStr
    ? `__daily__|${daysStr}|${datesStr}`
    : `__daily__|${daysStr}`;
}

/** due_date 디코딩: due_date 문자열 → isDaily/completedDates/dueDate/scheduledDays */
function decodeDueDate(dueDate: string | null): {
  isDaily: boolean;
  completedDates: string[];
  actualDueDate: string | null;
  scheduledDays: string[];
} {
  if (dueDate?.startsWith('__daily__')) {
    if (dueDate.includes('|')) {
      const parts = dueDate.split('|');
      const daysStr = parts[1] ?? '매일';
      const datesRaw = parts[2] ?? '';
      const scheduledDays =
        daysStr === '매일' ? ['매일'] : daysStr.split(',').filter(Boolean);
      // ';' 구분 다중 날짜 (신규) 또는 단일 날짜 (구형식 하위 호환)
      const completedDates = datesRaw ? datesRaw.split(';').filter(Boolean) : [];
      return { isDaily: true, completedDates, actualDueDate: null, scheduledDays };
    }
    // 구형식: __daily__[:YYYY-MM-DD]
    const singleDate = dueDate.startsWith('__daily__:')
      ? dueDate.slice('__daily__:'.length)
      : null;
    return {
      isDaily: true,
      completedDates: singleDate ? [singleDate] : [],
      actualDueDate: null,
      scheduledDays: ['매일'],
    };
  }
  return { isDaily: false, completedDates: [], actualDueDate: dueDate, scheduledDays: [] };
}

function rowToHomework(r: HomeworkRow): HomeworkItem {
  const { isDaily, completedDates, actualDueDate, scheduledDays } = decodeDueDate(r.due_date);
  return {
    id: r.id,
    studentId: r.student_id as StudentId,
    subjectId: r.subject_id,
    title: r.title,
    dueDate: actualDueDate,
    completed: r.completed,
    completedDates,
    createdAt: r.created_at,
    isDaily,
    scheduledDays,
  };
}
function homeworkToRow(h: HomeworkItem): HomeworkRow {
  return {
    id: h.id,
    student_id: h.studentId,
    subject_id: h.subjectId,
    title: h.title,
    due_date: encodeDueDate(h.isDaily, h.completedDates, h.dueDate, h.scheduledDays),
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
  // upsert: 중복 실행 시에도 오류 없이 덮어씀 (StrictMode 이중 호출 안전)
  await db.from('students').upsert(data.students.map(studentToRow));
  if (data.subjects.length > 0) await db.from('subjects').upsert(data.subjects.map(subjectToRow));
  if (data.sessions.length > 0)  await db.from('sessions').upsert(data.sessions.map(sessionToRow));
  if (data.homework.length > 0)  await db.from('homework').upsert(data.homework.map(homeworkToRow));
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
  clearDateData: (date: string) => void;
  removeCompletedDate: (date: string) => void;
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
/** 로컬 타임존 기준 YYYY-MM-DD 반환 */
function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** ISO 문자열(UTC 포함)을 KST 로컬 날짜 YYYY-MM-DD로 변환 */
function localDateOf(isoStr: string): string {
  return toDateStr(new Date(isoStr));
}

// ─── 자동 정리: 이번 달 이전 데이터 삭제 ────────────────────────────────────

function getMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * 오래된 데이터를 자동 정리한다.
 * - 오늘만 숙제(isDaily=false): 이번 달 이전 항목 삭제 (이달 누적 포인트 계산을 위해 이달 것은 보존)
 * - 학습 세션: 이번 달 이전 항목 삭제
 * - 매일 숙제(isDaily=true): 영구 보존, 단 completedDates 중 이번 달 이전 날짜 제거
 */
async function cleanupOldData(loadedData: AppData): Promise<AppData> {
  const monthStart = getMonthStart();

  // 오늘만 숙제: 이번 달 이전에 만들어진 항목 삭제
  const oldOneTimeIds = loadedData.homework
    .filter(h => !h.isDaily && localDateOf(h.createdAt) < monthStart)
    .map(h => h.id);

  const oldSessionIds = loadedData.sessions
    .filter(s => s.date < monthStart)
    .map(s => s.id);

  // 매일 숙제: completedDates에서 이번 달 이전 날짜 + 수동 지정 삭제 날짜 제거
  const REMOVE_DATES = ['2026-05-13']; // 잘못 기록된 완료 날짜 목록
  const dailyToUpdate: HomeworkItem[] = [];
  const hwWithTrimmedDates = loadedData.homework.map(h => {
    if (!h.isDaily) return h;
    const filtered = h.completedDates.filter(
      d => d >= monthStart && !REMOVE_DATES.includes(d)
    );
    if (filtered.length === h.completedDates.length) return h;
    const trimmed = { ...h, completedDates: filtered };
    dailyToUpdate.push(trimmed);
    return trimmed;
  });

  if (db) {
    if (oldOneTimeIds.length > 0) {
      const { error } = await db.from('homework').delete().in('id', oldOneTimeIds);
      if (error) console.warn('cleanupOldData(homework):', error);
    }
    if (oldSessionIds.length > 0) {
      const { error } = await db.from('sessions').delete().in('id', oldSessionIds);
      if (error) console.warn('cleanupOldData(sessions):', error);
    }
    // 날짜가 잘린 daily 숙제 DB 업데이트
    for (const hw of dailyToUpdate) {
      await db.from('homework').update({
        due_date: encodeDueDate(hw.isDaily, hw.completedDates, hw.dueDate, hw.scheduledDays),
      }).eq('id', hw.id);
    }
  }

  return {
    ...loadedData,
    homework: hwWithTrimmedDates.filter(h => !oldOneTimeIds.includes(h.id)),
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
              homework: fallback.homework
                .filter(h => h.isDaily || localDateOf(h.createdAt) >= monthStart)
                .map(h => {
                  if (!h.isDaily) return h;
                  return { ...h, completedDates: (h.completedDates ?? []).filter(d => d >= monthStart) };
                }),
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
    setData(prev => ({ ...prev, subjects: [...prev.subjects, subject] }));
    if (db) {
      db.from('subjects').insert(subjectToRow(subject))
        .then(({ error }) => { if (error) console.error('addSubject:', error); });
    }
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
    setData(prev => ({ ...prev, sessions: [...prev.sessions, session] }));
    if (db) {
      db.from('sessions').insert(sessionToRow(session))
        .then(({ error }) => { if (error) console.error('addSession:', error); });
    }
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
    setData(prev => ({ ...prev, homework: [...prev.homework, item] }));
    if (db) {
      db.from('homework').insert(homeworkToRow(item))
        .then(({ error }) => { if (error) console.error('addHomework:', error); });
    }
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
        // isDaily, completedDates, dueDate, scheduledDays 중 하나라도 변경되면 due_date 재인코딩
        if ('isDaily' in updates || 'completedDates' in updates || 'dueDate' in updates || 'scheduledDays' in updates) {
          dbUpdates.due_date = encodeDueDate(
            updatedItem.isDaily,
            updatedItem.completedDates,
            updatedItem.dueDate,
            updatedItem.scheduledDays,
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

  /**
   * 특정 날짜 데이터 삭제:
   * - 매일 숙제: 해당 날짜를 completedDates에서 제거하고, 패널티 계산에서 제외하기 위해 해당 날짜를 완료 처리
   * - 오늘만 숙제: 해당 날짜에 생성된 항목 삭제
   */
  const clearDateData = useCallback((date: string) => {
    setData(prev => {
      const onedayToDelete = prev.homework
        .filter(h => !h.isDaily && localDateOf(h.createdAt) === date)
        .map(h => h.id);

      const updatedHw = prev.homework
        .filter(h => !onedayToDelete.includes(h.id))
        .map(h => {
          if (!h.isDaily) return h;
          // 해당 날짜를 completedDates에 추가(패널티 제거), 이미 있으면 유지
          if (h.completedDates.includes(date)) return h;
          return { ...h, completedDates: [...h.completedDates, date] };
        });

      if (db) {
        if (onedayToDelete.length > 0) {
          db.from('homework').delete().in('id', onedayToDelete)
            .then(({ error }) => { if (error) console.error('clearDateData(delete):', error); });
        }
        for (const hw of updatedHw) {
          if (!hw.isDaily) continue;
          const original = prev.homework.find(h => h.id === hw.id);
          if (!original || original.completedDates.includes(date)) continue;
          db.from('homework').update({
            due_date: encodeDueDate(hw.isDaily, hw.completedDates, hw.dueDate, hw.scheduledDays),
          }).eq('id', hw.id)
            .then(({ error }) => { if (error) console.error('clearDateData(update):', error); });
        }
      }

      return { ...prev, homework: updatedHw };
    });
  }, []);

  /** 특정 날짜를 모든 매일 숙제의 completedDates에서 제거 (잘못된 완료 기록 삭제용) */
  const removeCompletedDate = useCallback((date: string) => {
    setData(prev => {
      const toUpdate: HomeworkItem[] = [];
      const updated = prev.homework.map(h => {
        if (!h.isDaily || !h.completedDates.includes(date)) return h;
        const next = { ...h, completedDates: h.completedDates.filter(d => d !== date) };
        toUpdate.push(next);
        return next;
      });
      if (db) {
        for (const hw of toUpdate) {
          db.from('homework').update({
            due_date: encodeDueDate(hw.isDaily, hw.completedDates, hw.dueDate, hw.scheduledDays),
          }).eq('id', hw.id)
            .then(({ error }) => { if (error) console.error('removeCompletedDate:', error); });
        }
      }
      return { ...prev, homework: updated };
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
      addHomework, updateHomework, deleteHomework, clearDateData, removeCompletedDate,
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
