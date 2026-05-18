import type { HomeworkHistoryRecord, HomeworkItem, Student, StudentId } from './types';
import {
  isBeforeServiceStart,
  isLaunchDailyCompleteDay,
  LAUNCH_COMPLETE_DATES,
} from './serviceConfig';

export const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** @deprecated isLaunchDailyCompleteDay 사용 */
export function isHardcodedDailyCompleteDay(
  studentId: StudentId,
  date: string,
  _students?: Student[],
): boolean {
  return isLaunchDailyCompleteDay(studentId, date);
}

export function historyId(homeworkId: string, date: string): string {
  return `${homeworkId}__${date}`;
}

export function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function localDateOf(isoStr: string): string {
  return toDateStr(new Date(isoStr));
}

export function encodeScheduledDays(days: string[]): string {
  if (days.length === 0 || days.includes('매일')) return '매일';
  return days.join(',');
}

export function decodeScheduledDays(raw: string): string[] {
  if (!raw || raw === '매일') return ['매일'];
  return raw.split(',').filter(Boolean);
}

/** 숙제 항목 + 특정 날짜 기준 스냅샷으로 동결 기록 생성 */
export function snapshotFromHomework(
  hw: HomeworkItem,
  date: string,
  completed: boolean,
): HomeworkHistoryRecord {
  return {
    id: historyId(hw.id, date),
    homeworkId: hw.id,
    studentId: hw.studentId,
    subjectId: hw.subjectId,
    title: hw.title,
    date,
    isDaily: hw.isDaily,
    completed,
    scheduledDays: [...hw.scheduledDays],
    homeworkCreatedAt: hw.createdAt,
    archivedAt: new Date().toISOString(),
  };
}

function isScheduledOnDay(
  isDaily: boolean,
  scheduledDays: string[],
  homeworkCreatedAt: string,
  date: string,
): boolean {
  if (!isDaily) {
    return localDateOf(homeworkCreatedAt) === date;
  }
  const created = localDateOf(homeworkCreatedAt);
  if (created > date) return false;
  const dayLabel = DAY_LABELS[new Date(date + 'T12:00:00').getDay()];
  if (scheduledDays.length === 0 || scheduledDays.includes('매일')) return true;
  return scheduledDays.includes(dayLabel);
}

export function isScheduledOnDate(
  record: Pick<HomeworkHistoryRecord, 'isDaily' | 'scheduledDays' | 'homeworkCreatedAt' | 'date'>,
  date: string,
): boolean {
  return isScheduledOnDay(record.isDaily, record.scheduledDays, record.homeworkCreatedAt, date);
}

export function isHomeworkScheduledOnDate(hw: HomeworkItem, date: string): boolean {
  return isScheduledOnDay(hw.isDaily, hw.scheduledDays, hw.createdAt, date);
}

/** 특정 날짜에 해당하는 동결 기록 조회 (없으면 undefined) */
export function getFrozenForDate(
  history: HomeworkHistoryRecord[],
  homeworkId: string,
  date: string,
): HomeworkHistoryRecord | undefined {
  return history.find(h => h.homeworkId === homeworkId && h.date === date);
}

type DayHwState = { id: string; title: string; isDaily: boolean; done: boolean; scheduledDays: string[] };

function liveDoneOnDate(hw: HomeworkItem, date: string): boolean {
  if (hw.isDaily) return hw.completedDates.includes(date);
  return localDateOf(hw.createdAt) === date && hw.completed;
}

/**
 * 포인트/통계 계산용: 특정 날짜의 숙제 완료 상태 목록.
 * - 과거: homework_history 우선(삭제·수정 전 스냅샷), 없으면 live completedDates 폴백
 * - 오늘 이후: live homework 기준
 */
export function getHomeworkStateForDate(
  studentId: StudentId,
  homework: HomeworkItem[],
  history: HomeworkHistoryRecord[],
  date: string,
  todayStr: string,
  students?: Student[],
): DayHwState[] {
  if (isBeforeServiceStart(date)) return [];

  const result: DayHwState[] = [];
  const myHw = homework.filter(h => h.studentId === studentId);
  const myHistory = history.filter(h => h.studentId === studentId && h.date === date);
  const historyByHwId = new Map(myHistory.map(h => [h.homeworkId, h]));
  const isPast = date < todayStr;

  for (const hw of myHw) {
    if (!isHomeworkScheduledOnDate(hw, date)) continue;

    const frozen = historyByHwId.get(hw.id);
    if (isPast && frozen) {
      result.push({
        id: hw.id,
        title: frozen.title,
        isDaily: frozen.isDaily,
        done: frozen.completed,
        scheduledDays: frozen.scheduledDays,
      });
    } else {
      result.push({
        id: hw.id,
        title: hw.title,
        isDaily: hw.isDaily,
        done: liveDoneOnDate(hw, date),
        scheduledDays: hw.scheduledDays,
      });
    }
  }

  // 삭제된 숙제는 history에만 남음
  for (const rec of myHistory) {
    if (myHw.some(h => h.id === rec.homeworkId)) continue;
    if (!isScheduledOnDate(rec, date)) continue;
    result.push({
      id: rec.homeworkId,
      title: rec.title,
      isDaily: rec.isDaily,
      done: rec.completed,
      scheduledDays: rec.scheduledDays,
    });
  }

  return applyLaunchDailyComplete(studentId, date, result, myHw);
}

/** 5/14~5/17 전원 매일 숙제 완료 확정 (오픈 직후 복구) */
function applyLaunchDailyComplete(
  studentId: StudentId,
  date: string,
  states: DayHwState[],
  myHw: HomeworkItem[],
): DayHwState[] {
  if (!isLaunchDailyCompleteDay(studentId, date)) {
    return states;
  }

  const byId = new Map(states.map(s => [s.id, s]));
  for (const hw of myHw) {
    if (!hw.isDaily || !isHomeworkScheduledOnDate(hw, date)) continue;
    byId.set(hw.id, {
      id: hw.id,
      title: hw.title,
      isDaily: true,
      done: true,
      scheduledDays: hw.scheduledDays,
    });
  }

  const merged = Array.from(byId.values()).map(s =>
    s.isDaily ? { ...s, done: true } : s,
  );

  if (!merged.some(s => s.isDaily)) {
    merged.push({
      id: `launch-daily-${studentId}-${date}`,
      title: '매일 숙제',
      isDaily: true,
      done: true,
      scheduledDays: ['매일'],
    });
  }

  return merged;
}

/** DB에 남기는 5/14~5/17 완료 history 스냅샷 */
export function buildHardcodedHistoryRecords(
  students: Student[],
  homework: HomeworkItem[],
  existingHistory: HomeworkHistoryRecord[],
): HomeworkHistoryRecord[] {
  const existingIds = new Set(existingHistory.map(h => h.id));
  const records: HomeworkHistoryRecord[] = [];
  const launchDates = LAUNCH_COMPLETE_DATES;

  for (const student of students) {
    const myHw = homework.filter(h => h.studentId === student.id);
    for (const date of launchDates) {
      const states = applyLaunchDailyComplete(student.id, date, [], myHw);
      for (const s of states.filter(x => x.isDaily && x.done)) {
        const id = historyId(s.id, date);
        if (existingIds.has(id)) continue;
        records.push({
          id,
          homeworkId: s.id,
          studentId: student.id,
          subjectId: homework.find(h => h.id === s.id)?.subjectId ?? null,
          title: s.title,
          date,
          isDaily: true,
          completed: true,
          scheduledDays: s.scheduledDays,
          homeworkCreatedAt: homework.find(h => h.id === s.id)?.createdAt ?? `${date}T00:00:00`,
          archivedAt: new Date().toISOString(),
        });
        existingIds.add(id);
      }
    }
  }

  return records;
}

/** live 숙제에서 오늘 이전 완료 날짜를 history로 이전할 스냅샷 목록 */
export function collectPastSnapshots(
  homework: HomeworkItem[],
  todayStr: string,
  existingHistory: HomeworkHistoryRecord[],
): HomeworkHistoryRecord[] {
  const existingIds = new Set(existingHistory.map(h => h.id));
  const snapshots: HomeworkHistoryRecord[] = [];

  for (const hw of homework) {
    if (hw.isDaily) {
      for (const date of hw.completedDates) {
        if (isBeforeServiceStart(date) || date >= todayStr) continue;
        const id = historyId(hw.id, date);
        if (existingIds.has(id)) continue;
        snapshots.push(snapshotFromHomework(hw, date, true));
      }
    } else {
      const created = localDateOf(hw.createdAt);
      if (isBeforeServiceStart(created) || created >= todayStr) continue;
      const id = historyId(hw.id, created);
      if (existingIds.has(id)) continue;
      snapshots.push(snapshotFromHomework(hw, created, hw.completed));
    }
  }

  return snapshots;
}

/** 삭제 전: 해당 숙제의 모든 과거·현재 기록을 history로 보존 */
export function collectArchiveOnDelete(
  hw: HomeworkItem,
  todayStr: string,
  existingHistory: HomeworkHistoryRecord[],
): HomeworkHistoryRecord[] {
  const existingIds = new Set(existingHistory.map(h => h.id));
  const snapshots: HomeworkHistoryRecord[] = [];

  if (hw.isDaily) {
    for (const date of hw.completedDates) {
      if (isBeforeServiceStart(date)) continue;
      const id = historyId(hw.id, date);
      if (existingIds.has(id)) continue;
      snapshots.push(snapshotFromHomework(hw, date, true));
    }
    // 미완료였던 과거 스케줄일은 history에 없으면 포인트 계산에서 제외됨 (기존과 동일)
  } else {
    const created = localDateOf(hw.createdAt);
    const id = historyId(hw.id, created);
    if (!existingIds.has(id)) {
      snapshots.push(snapshotFromHomework(hw, created, hw.completed));
    }
  }

  return snapshots;
}

/** emotions id 목록에서 과거 완료 history 복구 (숙제 행이 아직 있을 때) */
export function recoverHistoryFromEmotionIds(
  homework: HomeworkItem[],
  emotionIds: string[],
  existingHistory: HomeworkHistoryRecord[],
  todayStr: string,
): HomeworkHistoryRecord[] {
  const existingIds = new Set(existingHistory.map(h => h.id));
  const hwById = new Map(homework.map(h => [h.id, h]));
  const templateByHwId = new Map(existingHistory.map(h => [h.homeworkId, h]));
  const recovered: HomeworkHistoryRecord[] = [];

  for (const emoId of emotionIds) {
    const sep = emoId.indexOf('__');
    if (sep < 0) continue;
    const hwId = emoId.slice(0, sep);
    const date = emoId.slice(sep + 2);
    if (isBeforeServiceStart(date) || date >= todayStr) continue;

    const id = historyId(hwId, date);
    if (existingIds.has(id)) continue;

    const hw = hwById.get(hwId);
    if (hw) {
      recovered.push(snapshotFromHomework(hw, date, true));
      existingIds.add(id);
      continue;
    }

    const template = templateByHwId.get(hwId);
    if (template) {
      recovered.push({
        ...template,
        id,
        date,
        completed: true,
        archivedAt: new Date().toISOString(),
      });
      existingIds.add(id);
    }
  }

  return recovered;
}
