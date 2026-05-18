import type { StudentId } from './types';

/** 서비스(포인트·숙제 기록) 시작일 — 이전 날짜는 데이터·패널티 없음 */
export const SERVICE_START_DATE = '2026-05-14';

/** 오픈 직후 전원 매일 숙제 완료로 확정한 마지막 날 (5/14~5/17) */
export const LAUNCH_COMPLETE_END_DATE = '2026-05-17';

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function eachDateInRange(start: string, end: string): string[] {
  if (end < start) return [];
  const dates: string[] = [];
  const [sy, sm, sd] = start.split('-').map(Number);
  const cur = new Date(sy, sm - 1, sd, 12, 0, 0);
  const [ey, em, ed] = end.split('-').map(Number);
  const endTime = new Date(ey, em - 1, ed, 12, 0, 0).getTime();
  while (cur.getTime() <= endTime) {
    dates.push(toDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export const LAUNCH_COMPLETE_DATES = eachDateInRange(
  SERVICE_START_DATE,
  LAUNCH_COMPLETE_END_DATE,
);

export function isBeforeServiceStart(date: string): boolean {
  return date < SERVICE_START_DATE;
}

/** 5/14~5/17: 두 학생 모두 매일 숙제 완료 (+500/일) */
export function isLaunchDailyCompleteDay(_studentId: StudentId, date: string): boolean {
  if (isBeforeServiceStart(date)) return false;
  return date <= LAUNCH_COMPLETE_END_DATE;
}

/** 이달 합계 집계 시작일 = max(해당 월 1일, 서비스 시작일) */
export function getMonthPointsStart(viewDate: string): string {
  const monthStart = viewDate.slice(0, 7) + '-01';
  return monthStart > SERVICE_START_DATE ? monthStart : SERVICE_START_DATE;
}
