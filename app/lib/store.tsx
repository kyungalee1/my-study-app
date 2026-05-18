'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { AppData, Student, Subject, StudySession, HomeworkItem, HomeworkHistoryRecord, ExemptDate, StudentId } from './types';
import { defaultData } from './defaults';
import { db } from './supabase';
import {
  collectArchiveOnDelete,
  collectPastSnapshots,
  encodeScheduledDays,
  decodeScheduledDays,
  recoverHistoryFromEmotionIds,
  buildHardcodedHistoryRecords,
  snapshotFromHomework,
} from './homeworkHistory';
import { loadExemptDatesLocal, mergeExemptDates, saveExemptDatesLocal } from './exemptDates';
import { isBeforeServiceStart, SERVICE_START_DATE } from './serviceConfig';

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
interface ExemptDateRow {
  date: string;
  label: string;
  created_at: string;
}
interface HomeworkHistoryRow {
  id: string;
  homework_id: string;
  student_id: string;
  subject_id: string | null;
  title: string;
  date: string;
  is_daily: boolean;
  completed: boolean;
  scheduled_days: string;
  homework_created_at: string;
  archived_at: string;
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

function rowToHomeworkHistory(r: HomeworkHistoryRow): HomeworkHistoryRecord {
  return {
    id: r.id,
    homeworkId: r.homework_id,
    studentId: r.student_id as StudentId,
    subjectId: r.subject_id,
    title: r.title,
    date: r.date,
    isDaily: r.is_daily,
    completed: r.completed,
    scheduledDays: decodeScheduledDays(r.scheduled_days),
    homeworkCreatedAt: r.homework_created_at,
    archivedAt: r.archived_at,
  };
}
function rowToExemptDate(r: ExemptDateRow): ExemptDate {
  return { date: r.date, label: r.label };
}
function exemptDateToRow(e: ExemptDate): ExemptDateRow {
  return { date: e.date, label: e.label, created_at: new Date().toISOString() };
}

function homeworkHistoryToRow(h: HomeworkHistoryRecord): HomeworkHistoryRow {
  return {
    id: h.id,
    homework_id: h.homeworkId,
    student_id: h.studentId,
    subject_id: h.subjectId,
    title: h.title,
    date: h.date,
    is_daily: h.isDaily,
    completed: h.completed,
    scheduled_days: encodeScheduledDays(h.scheduledDays),
    homework_created_at: h.homeworkCreatedAt,
    archived_at: h.archivedAt,
  };
}

// ─── Supabase Helpers ─────────────────────────────────────────────────────────

async function loadFromSupabase(): Promise<AppData | null> {
  if (!db) return null;
  const [studentsRes, subjectsRes, sessionsRes, homeworkRes, historyRes, exemptRes] = await Promise.all([
    db.from('students').select('*'),
    db.from('subjects').select('*'),
    db.from('sessions').select('*'),
    db.from('homework').select('*').order('created_at', { ascending: true }),
    db.from('homework_history').select('*'),
    db.from('exempt_dates').select('*').order('date', { ascending: true }),
  ]);
  if (studentsRes.error) throw studentsRes.error;
  if (!studentsRes.data || studentsRes.data.length === 0) return null;
  return {
    students: (studentsRes.data as StudentRow[]).map(rowToStudent),
    subjects: ((subjectsRes.data ?? []) as SubjectRow[]).map(rowToSubject),
    sessions: ((sessionsRes.data ?? []) as SessionRow[]).map(rowToSession),
    homework: ((homeworkRes.data ?? []) as HomeworkRow[]).map(rowToHomework),
    homeworkHistory: historyRes.error
      ? []
      : ((historyRes.data ?? []) as HomeworkHistoryRow[]).map(rowToHomeworkHistory),
    exemptDates: exemptRes.error
      ? []
      : ((exemptRes.data ?? []) as ExemptDateRow[]).map(rowToExemptDate),
  };
}

async function seedToSupabase(data: AppData) {
  if (!db) return;
  // upsert: 중복 실행 시에도 오류 없이 덮어씀 (StrictMode 이중 호출 안전)
  await db.from('students').upsert(data.students.map(studentToRow));
  if (data.subjects.length > 0) await db.from('subjects').upsert(data.subjects.map(subjectToRow));
  if (data.sessions.length > 0)  await db.from('sessions').upsert(data.sessions.map(sessionToRow));
  if (data.homework.length > 0)  await db.from('homework').upsert(data.homework.map(homeworkToRow));
  if (data.homeworkHistory.length > 0) {
    await db.from('homework_history').upsert(data.homeworkHistory.map(homeworkHistoryToRow));
  }
  if (data.exemptDates.length > 0) {
    await db.from('exempt_dates').upsert(data.exemptDates.map(exemptDateToRow));
  }
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
  addExemptDate: (item: ExemptDate) => void;
  removeExemptDate: (date: string) => void;
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

/** 서비스 시작(5/14) 이전 숙제·완료 기록 제거 */
async function purgePreServiceData(loadedData: AppData): Promise<AppData> {
  const preHistory = (loadedData.homeworkHistory ?? []).filter(h => isBeforeServiceStart(h.date));
  const preHistoryIds = preHistory.map(h => h.id);

  const homework = loadedData.homework
    .filter(h => {
      if (!h.isDaily && isBeforeServiceStart(localDateOf(h.createdAt))) return false;
      return true;
    })
    .map(h => ({
      ...h,
      completedDates: h.isDaily
        ? h.completedDates.filter(d => !isBeforeServiceStart(d))
        : h.completedDates,
    }));

  const homeworkHistory = (loadedData.homeworkHistory ?? []).filter(h => !isBeforeServiceStart(h.date));

  if (db) {
    if (preHistoryIds.length > 0) {
      const { error } = await db.from('homework_history').delete().in('id', preHistoryIds);
      if (error) console.warn('purgePreServiceData(history):', error);
    }
    for (const hw of homework) {
      const original = loadedData.homework.find(h => h.id === hw.id);
      if (!original || !hw.isDaily) continue;
      if (original.completedDates.join(';') === hw.completedDates.join(';')) continue;
      const { error } = await db.from('homework').update({
        due_date: encodeDueDate(hw.isDaily, hw.completedDates, hw.dueDate, hw.scheduledDays),
      }).eq('id', hw.id);
      if (error) console.warn('purgePreServiceData(homework):', error);
    }
    const deletedOneday = loadedData.homework.filter(
      h => !h.isDaily && isBeforeServiceStart(localDateOf(h.createdAt)),
    );
    if (deletedOneday.length > 0) {
      const { error } = await db.from('homework').delete().in('id', deletedOneday.map(h => h.id));
      if (error) console.warn('purgePreServiceData(delete oneday):', error);
    }
  }

  if (preHistoryIds.length > 0) {
    console.info(`서비스 시작(${SERVICE_START_DATE}) 이전 기록 ${preHistoryIds.length}건을 제거했습니다.`);
  }

  return { ...loadedData, homework, homeworkHistory };
}

/** 이번 달 이전 학습 세션만 정리 (숙제·완료 기록은 homework_history에 보존) */
async function cleanupOldSessions(loadedData: AppData): Promise<AppData> {
  const monthStart = getMonthStart();
  const oldSessionIds = loadedData.sessions
    .filter(s => s.date < monthStart)
    .map(s => s.id);

  if (db && oldSessionIds.length > 0) {
    const { error } = await db.from('sessions').delete().in('id', oldSessionIds);
    if (error) console.warn('cleanupOldSessions:', error);
  }

  return {
    ...loadedData,
    sessions: loadedData.sessions.filter(s => !oldSessionIds.includes(s.id)),
  };
}

/** 과거 완료 날짜를 homework_history에 복사(백업). live completedDates는 유지한다. */
async function migrateHomeworkToHistory(loadedData: AppData): Promise<AppData> {
  const todayStr = toDateStr(new Date());
  const newSnapshots = collectPastSnapshots(
    loadedData.homework,
    todayStr,
    loadedData.homeworkHistory ?? [],
  );

  const homeworkHistory = [...(loadedData.homeworkHistory ?? []), ...newSnapshots];

  if (db && newSnapshots.length > 0) {
    const { error } = await db.from('homework_history').upsert(newSnapshots.map(homeworkHistoryToRow));
    if (error) console.warn('migrateHomeworkToHistory(insert):', error);
  }

  return { ...loadedData, homeworkHistory };
}

/** emotions 테이블에서 사라진 과거 완료 기록 복구 */
async function recoverMissingHistoryFromEmotions(loadedData: AppData): Promise<AppData> {
  if (!db) return loadedData;
  const todayStr = toDateStr(new Date());
  const { data: emotions, error } = await db.from('emotions').select('id');
  if (error || !emotions?.length) return loadedData;

  const emotionIds = (emotions as { id: string }[]).map(e => e.id);
  const recovered = recoverHistoryFromEmotionIds(
    loadedData.homework,
    emotionIds,
    loadedData.homeworkHistory ?? [],
    todayStr,
  );
  if (recovered.length === 0) return loadedData;

  const { error: upsertErr } = await db
    .from('homework_history')
    .upsert(recovered.map(homeworkHistoryToRow));
  if (upsertErr) {
    console.warn('recoverMissingHistoryFromEmotions:', upsertErr);
    return loadedData;
  }

  console.info(`과거 숙제 기록 ${recovered.length}건을 emotions에서 복구했습니다.`);
  return {
    ...loadedData,
    homeworkHistory: [...(loadedData.homeworkHistory ?? []), ...recovered],
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
        const localExempt = loadExemptDatesLocal();
        const mergedExempt = mergeExemptDates(loaded.exemptDates ?? [], localExempt);
        loaded = {
          ...loaded,
          homeworkHistory: loaded.homeworkHistory ?? [],
          exemptDates: mergedExempt,
        };
        saveExemptDatesLocal(mergedExempt);
        if (db && mergedExempt.length > 0) {
          db.from('exempt_dates').upsert(mergedExempt.map(exemptDateToRow))
            .then(({ error }) => { if (error) console.warn('exempt_dates upsert:', error); });
        }
        loaded = await purgePreServiceData(loaded);
        loaded = await migrateHomeworkToHistory(loaded);
        const hardcodedHistory = buildHardcodedHistoryRecords(
          loaded.students,
          loaded.homework,
          loaded.homeworkHistory ?? [],
        );
        if (hardcodedHistory.length > 0) {
          loaded = {
            ...loaded,
            homeworkHistory: [...(loaded.homeworkHistory ?? []), ...hardcodedHistory],
          };
          if (db) {
            await db.from('homework_history').upsert(hardcodedHistory.map(homeworkHistoryToRow));
          }
        }
        loaded = await recoverMissingHistoryFromEmotions(loaded);
        loaded = await cleanupOldSessions(loaded);
        setData(loaded);
      } catch (err) {
        // Supabase 연결 실패 시 localStorage 폴백
        console.warn('Supabase 연결 실패, localStorage 폴백 사용:', err);
        try {
          const stored = localStorage.getItem('study-app-data');
          if (stored) {
            const parsed = JSON.parse(stored) as AppData;
            const fallback: AppData = {
              ...defaultData,
              ...parsed,
              homeworkHistory: parsed.homeworkHistory ?? [],
              exemptDates: parsed.exemptDates ?? [],
            };
            const todayStr = toDateStr(new Date());
            const purged = await purgePreServiceData(fallback);
            const snapshots = collectPastSnapshots(purged.homework, todayStr, purged.homeworkHistory);
            const mergedExempt = mergeExemptDates(
              fallback.exemptDates ?? [],
              loadExemptDatesLocal(),
            );
            saveExemptDatesLocal(mergedExempt);
            setData({
              ...purged,
              exemptDates: mergedExempt,
              homeworkHistory: [...purged.homeworkHistory, ...snapshots],
              sessions: purged.sessions.filter(s => s.date >= getMonthStart()),
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
      const todayStr = toDateStr(new Date());
      const original = prev.homework.find(h => h.id === id);
      if (!original) return prev;

      let historyUpdates: HomeworkHistoryRecord[] = [];
      let liveUpdates = { ...updates };

      // completedDates 변경: 실제로 바뀐 날짜만 반영 (과거는 history, 오늘 이후는 live)
      if ('completedDates' in updates && updates.completedDates) {
        const newDates = updates.completedDates;
        const changedDates = new Set<string>();
        for (const d of original.completedDates) {
          if (!newDates.includes(d)) changedDates.add(d);
        }
        for (const d of newDates) {
          if (!original.completedDates.includes(d)) changedDates.add(d);
        }
        for (const date of changedDates) {
          if (date >= todayStr) continue;
          const done = newDates.includes(date);
          historyUpdates.push(snapshotFromHomework(original, date, done));
        }
        liveUpdates = {
          ...liveUpdates,
          completedDates: newDates.filter(d => d >= todayStr),
        };
      }

      const merged = { ...original, ...liveUpdates };
      const nextHomework = prev.homework.map(h => h.id === id ? merged : h);
      let nextHistory = prev.homeworkHistory ?? [];

      if (historyUpdates.length > 0) {
        const byId = new Map(nextHistory.map(h => [h.id, h]));
        for (const snap of historyUpdates) byId.set(snap.id, snap);
        nextHistory = Array.from(byId.values());
        if (db) {
          db.from('homework_history').upsert(historyUpdates.map(homeworkHistoryToRow))
            .then(({ error }) => { if (error) console.error('updateHomework(history):', error); });
        }
      }

      if (db) {
        const dbUpdates: Partial<HomeworkRow> = {};
        if ('completed' in liveUpdates) dbUpdates.completed = liveUpdates.completed;
        if ('title' in liveUpdates) dbUpdates.title = liveUpdates.title;
        if ('subjectId' in liveUpdates) dbUpdates.subject_id = liveUpdates.subjectId ?? null;
        if (
          'isDaily' in liveUpdates ||
          'completedDates' in liveUpdates ||
          'dueDate' in liveUpdates ||
          'scheduledDays' in liveUpdates
        ) {
          dbUpdates.due_date = encodeDueDate(
            merged.isDaily,
            merged.completedDates,
            merged.dueDate,
            merged.scheduledDays,
          );
        }
        if (Object.keys(dbUpdates).length > 0) {
          db.from('homework').update(dbUpdates).eq('id', id)
            .then(({ error }) => { if (error) console.error('updateHomework:', error); });
        }
      }

      return { ...prev, homework: nextHomework, homeworkHistory: nextHistory };
    });
  }, []);

  const deleteHomework = useCallback((id: string) => {
    setData(prev => {
      const item = prev.homework.find(h => h.id === id);
      if (!item) return prev;

      const todayStr = toDateStr(new Date());
      const archiveSnaps = collectArchiveOnDelete(item, todayStr, prev.homeworkHistory ?? []);
      const byId = new Map((prev.homeworkHistory ?? []).map(h => [h.id, h]));
      for (const snap of archiveSnaps) byId.set(snap.id, snap);
      const nextHistory = Array.from(byId.values());

      if (db) {
        if (archiveSnaps.length > 0) {
          db.from('homework_history').upsert(archiveSnaps.map(homeworkHistoryToRow))
            .then(({ error }) => { if (error) console.error('deleteHomework(history):', error); });
        }
        db.from('homework').delete().eq('id', id)
          .then(({ error }) => { if (error) console.error('deleteHomework:', error); });
      }

      return {
        ...prev,
        homework: prev.homework.filter(h => h.id !== id),
        homeworkHistory: nextHistory,
      };
    });
  }, []);

  /**
   * 특정 날짜 데이터 삭제:
   * - 매일 숙제: 해당 날짜를 completedDates에서 제거하고, 패널티 계산에서 제외하기 위해 해당 날짜를 완료 처리
   * - 오늘만 숙제: 해당 날짜에 생성된 항목 삭제
   */
  const clearDateData = useCallback((date: string) => {
    setData(prev => {
      const todayStr = toDateStr(new Date());
      const historySnaps: HomeworkHistoryRecord[] = [];

      if (date < todayStr) {
        for (const hw of prev.homework) {
          if (!hw.isDaily) {
            if (localDateOf(hw.createdAt) !== date) continue;
            historySnaps.push(snapshotFromHomework(hw, date, true));
            continue;
          }
          historySnaps.push(snapshotFromHomework(hw, date, true));
        }
        const byId = new Map((prev.homeworkHistory ?? []).map(h => [h.id, h]));
        for (const snap of historySnaps) byId.set(snap.id, snap);
        if (db && historySnaps.length > 0) {
          db.from('homework_history').upsert(historySnaps.map(homeworkHistoryToRow))
            .then(({ error }) => { if (error) console.error('clearDateData(history):', error); });
        }
        return { ...prev, homeworkHistory: Array.from(byId.values()) };
      }

      const onedayToDelete = prev.homework
        .filter(h => !h.isDaily && localDateOf(h.createdAt) === date)
        .map(h => h.id);

      const updatedHw = prev.homework
        .filter(h => !onedayToDelete.includes(h.id))
        .map(h => {
          if (!h.isDaily) return h;
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
  const addExemptDate = useCallback((item: ExemptDate) => {
    setData(prev => {
      if (prev.exemptDates.some(e => e.date === item.date)) return prev;
      const next = {
        ...prev,
        exemptDates: [...prev.exemptDates, item].sort((a, b) => a.date.localeCompare(b.date)),
      };
      saveExemptDatesLocal(next.exemptDates);
      if (db) {
        db.from('exempt_dates').upsert(exemptDateToRow(item))
          .then(({ error }) => { if (error) console.error('addExemptDate:', error); });
      }
      return next;
    });
  }, []);

  const removeExemptDate = useCallback((date: string) => {
    setData(prev => {
      const next = { ...prev, exemptDates: prev.exemptDates.filter(e => e.date !== date) };
      saveExemptDatesLocal(next.exemptDates);
      if (db) {
        db.from('exempt_dates').delete().eq('date', date)
          .then(({ error }) => { if (error) console.error('removeExemptDate:', error); });
      }
      return next;
    });
  }, []);

  const removeCompletedDate = useCallback((date: string) => {
    setData(prev => {
      const todayStr = toDateStr(new Date());

      if (date < todayStr) {
        const historySnaps: HomeworkHistoryRecord[] = [];
        for (const hw of prev.homework.filter(h => h.isDaily)) {
          const existing = (prev.homeworkHistory ?? []).find(
            h => h.homeworkId === hw.id && h.date === date,
          );
          if (existing) {
            historySnaps.push({ ...existing, completed: false, archivedAt: new Date().toISOString() });
          }
        }
        const byId = new Map((prev.homeworkHistory ?? []).map(h => [h.id, h]));
        for (const snap of historySnaps) byId.set(snap.id, snap);
        if (db && historySnaps.length > 0) {
          db.from('homework_history').upsert(historySnaps.map(homeworkHistoryToRow))
            .then(({ error }) => { if (error) console.error('removeCompletedDate(history):', error); });
        }
        return { ...prev, homeworkHistory: Array.from(byId.values()) };
      }

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
      addExemptDate, removeExemptDate,
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
