import type { ExemptDate, HomeworkHistoryRecord, HomeworkItem, Student, StudentId } from './types';
import { isDailyHomeworkExempt } from './exemptDates';
import { getHomeworkStateForDate } from './homeworkHistory';
import {
  eachDateInRange,
  getMonthPointsStart,
  isBeforeServiceStart,
  isLaunchDailyCompleteDay,
  SERVICE_START_DATE,
} from './serviceConfig';

export { eachDateInRange };

export const POINT_DAILY = 500;
export const POINT_ONEDAY = 300;

/** 특정 날짜 매일 숙제 포인트: +500 / -500 / 0 (면제·미해당 0) */
export function getDailyPointsForDate(
  studentId: StudentId,
  homework: HomeworkItem[],
  history: HomeworkHistoryRecord[],
  exemptDates: ExemptDate[],
  students: Student[],
  dateStr: string,
  todayStr: string,
): number {
  if (isBeforeServiceStart(dateStr)) return 0;
  if (isLaunchDailyCompleteDay(studentId, dateStr)) {
    return POINT_DAILY;
  }
  if (isDailyHomeworkExempt(dateStr, exemptDates)) {
    return 0;
  }

  const dayState = getHomeworkStateForDate(
    studentId,
    homework,
    history,
    dateStr,
    todayStr,
    students,
  );
  const daily = dayState.filter(s => s.isDaily);
  if (daily.length === 0) return 0;

  if (daily.every(s => s.done)) return POINT_DAILY;
  if (dateStr < todayStr) return -POINT_DAILY;
  return 0;
}

export function getOnedayPointsForDate(
  studentId: StudentId,
  homework: HomeworkItem[],
  history: HomeworkHistoryRecord[],
  students: Student[],
  dateStr: string,
  todayStr: string,
): number {
  if (isBeforeServiceStart(dateStr)) return 0;

  const dayState = getHomeworkStateForDate(
    studentId,
    homework,
    history,
    dateStr,
    todayStr,
    students,
  );
  const oneday = dayState.filter(s => !s.isDaily);
  if (oneday.length > 0 && oneday.every(s => s.done)) return POINT_ONEDAY;
  return 0;
}

function sumPointsInRange(
  studentId: StudentId,
  homework: HomeworkItem[],
  history: HomeworkHistoryRecord[],
  exemptDates: ExemptDate[],
  students: Student[],
  start: string,
  end: string,
  todayStr: string,
): number {
  if (isBeforeServiceStart(end)) return 0;
  const rangeStart = start > SERVICE_START_DATE ? start : SERVICE_START_DATE;
  if (end < rangeStart) return 0;

  let total = 0;
  for (const dateStr of eachDateInRange(rangeStart, end)) {
    total += getDailyPointsForDate(
      studentId,
      homework,
      history,
      exemptDates,
      students,
      dateStr,
      todayStr,
    );
    total += getOnedayPointsForDate(studentId, homework, history, students, dateStr, todayStr);
  }
  return total;
}

export interface PointsDisplay {
  todayDaily: number;
  todayOneday: number;
  /** 5/14(서비스 시작) ~ 선택한 날까지 누적 이달 합계 */
  monthlyTotal: number;
}

export function calcPoints(
  studentId: StudentId,
  homework: HomeworkItem[],
  history: HomeworkHistoryRecord[],
  exemptDates: ExemptDate[],
  students: Student[],
  viewDate: string,
  todayStr: string,
): PointsDisplay {
  const rangeStart = getMonthPointsStart(viewDate);

  const todayDaily = Math.max(
    0,
    getDailyPointsForDate(studentId, homework, history, exemptDates, students, viewDate, todayStr),
  );
  const todayOneday = getOnedayPointsForDate(
    studentId,
    homework,
    history,
    students,
    viewDate,
    todayStr,
  );

  const monthlyTotal = sumPointsInRange(
    studentId,
    homework,
    history,
    exemptDates,
    students,
    rangeStart,
    viewDate,
    todayStr,
  );

  return { todayDaily, todayOneday, monthlyTotal };
}
