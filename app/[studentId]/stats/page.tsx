'use client';

import { useState } from 'react';
import { useApp } from '../../lib/store';
import { isBeforeServiceStart, isLaunchDailyCompleteDay } from '../../lib/serviceConfig';
import type { HomeworkHistoryRecord, HomeworkItem, Student, StudentId } from '../../lib/types';
import { getHomeworkStateForDate } from '../../lib/homeworkHistory';
import { isDailyHomeworkExempt } from '../../lib/exemptDates';
import type { ExemptDate } from '../../lib/types';

type Period = 'week' | 'month';

// ── 날짜 유틸 ──────────────────────────────────────────────
function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getWeekDates(): string[] {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toLocalDateStr(d);
  });
}

function getMonthDates(): string[] {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Array.from({ length: last }, (_, i) =>
    toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), i + 1))
  );
}

function getWeekLabel(): string {
  const dates = getWeekDates();
  const s = new Date(dates[0] + 'T12:00:00');
  const e = new Date(dates[6] + 'T12:00:00');
  return `${s.getMonth() + 1}/${s.getDate()}–${e.getMonth() + 1}/${e.getDate()}`;
}

function getMonthLabel(): string {
  const now = new Date();
  return `${now.getMonth() + 1}월`;
}

const WEEK_DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;
// ── 타입 & 계산 ─────────────────────────────────────────────
type HwDot = { id: string; title: string; done: boolean };
type DayStat = { completed: number; pending: number; items: HwDot[] };

function calcStats(
  studentId: StudentId,
  homework: HomeworkItem[],
  history: HomeworkHistoryRecord[],
  exemptDates: ExemptDate[],
  students: Student[],
  periodDates: string[],
): Record<string, DayStat> {
  const today = toLocalDateStr(new Date());
  const byDate: Record<string, DayStat> = {};
  for (const d of periodDates) byDate[d] = { completed: 0, pending: 0, items: [] };

  for (const date of periodDates) {
    if (date > today || isBeforeServiceStart(date)) continue;
    if (isDailyHomeworkExempt(date, exemptDates) && !isLaunchDailyCompleteDay(studentId, date)) {
      continue;
    }

    const dayState = getHomeworkStateForDate(studentId, homework, history, date, today, students);
    for (const s of dayState) {
      byDate[date].items.push({ id: s.id, title: s.title, done: s.done });
      s.done ? byDate[date].completed++ : byDate[date].pending++;
    }
  }
  return byDate;
}

// ── 주간 통합 뷰 ─────────────────────────────────────────────
function WeekView({
  dates,
  students,
  allStats,
}: {
  dates: string[];
  students: Student[];
  allStats: Record<StudentId, Record<string, DayStat>>;
}) {
  const today = toLocalDateStr(new Date());

  return (
    <div>
      {/* 날짜 헤더 */}
      <div className="flex mb-3" style={{ paddingLeft: 52 }}>
        {dates.map((date, i) => {
          const isToday = date === today;
          const dayNum = parseInt(date.split('-')[2]);
          return (
            <div key={date} className="flex-1 flex flex-col items-center gap-0.5">
              <span style={{ fontSize: 10, color: isToday ? 'var(--primary)' : 'var(--text-sub)', fontWeight: isToday ? 700 : 400 }}>
                {WEEK_DAY_LABELS[i]}
              </span>
              <div
                className="rounded-full flex items-center justify-center"
                style={{
                  width: 22, height: 22,
                  background: isToday ? 'var(--primary)' : 'transparent',
                  fontSize: 11, fontWeight: isToday ? 700 : 400,
                  color: isToday ? '#fff' : 'var(--text-sub)',
                }}
              >
                {dayNum}
              </div>
            </div>
          );
        })}
      </div>

      {/* 구분선 */}
      <div style={{ height: 1, background: 'var(--border)', marginBottom: 12 }} />

      {/* 학생별 행 */}
      <div className="space-y-4">
        {students.map(student => {
          const byDate = allStats[student.id] ?? {};
          return (
            <div key={student.id} className="flex items-start gap-2">
              {/* 학생 라벨 */}
              <div className="flex flex-col items-center gap-1 flex-shrink-0" style={{ width: 44 }}>
                {student.photo ? (
                  <img src={student.photo} alt="" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover', border: `2px solid ${student.color}` }} />
                ) : (
                  <div className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, background: student.color + '20', fontSize: 16, border: `1.5px solid ${student.color}40` }}>
                    {student.avatar}
                  </div>
                )}
                <span style={{ fontSize: 9, color: 'var(--text-sub)', fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>
                  {student.name}
                </span>
              </div>

              {/* 날짜별 점 */}
              {dates.map(date => {
                const stat = byDate[date] ?? { items: [] };
                const isFuture = date > today;
                return (
                  <div key={date} className="flex-1 flex flex-col items-center gap-1 pt-1">
                    {isFuture ? (
                      <div className="rounded-full" style={{ width: 8, height: 8, background: 'var(--border)' }} />
                    ) : stat.items.length === 0 ? (
                      <div style={{ width: 8, height: 8 }} />
                    ) : (
                      stat.items.map(item => (
                        <div
                          key={item.id}
                          className="rounded-full flex-shrink-0"
                          title={item.title}
                          style={{
                            width: 10, height: 10,
                            background: item.done ? student.color : '#E5E8EB',
                            border: item.done ? 'none' : `1.5px solid #C9CDD2`,
                          }}
                        />
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 월간 통합 뷰 ─────────────────────────────────────────────
function MonthView({
  dates,
  students,
  allStats,
}: {
  dates: string[];
  students: Student[];
  allStats: Record<StudentId, Record<string, DayStat>>;
}) {
  const today = toLocalDateStr(new Date());

  // 달력 그리드 구성
  const firstDate = new Date(dates[0] + 'T12:00:00');
  let startDow = firstDate.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  const cells: (string | null)[] = [...Array(startDow).fill(null), ...dates];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div>
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-2">
        {['월','화','수','목','금','토','일'].map(d => (
          <div key={d} className="text-center" style={{ fontSize: 10, color: 'var(--text-sub)', fontWeight: 600 }}>{d}</div>
        ))}
      </div>

      {/* 주 행 */}
      <div className="space-y-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-y-1">
            {week.map((date, di) => {
              if (!date) return <div key={di} />;

              const isToday = date === today;
              const isFuture = date > today;
              const dayNum = parseInt(date.split('-')[2]);

              return (
                <div key={di} className="flex flex-col items-center" style={{ minHeight: 50 }}>
                  {/* 날짜 */}
                  <div
                    className="rounded-full flex items-center justify-center mb-1"
                    style={{
                      width: 20, height: 20,
                      background: isToday ? 'var(--primary)' : 'transparent',
                      fontSize: 10,
                      fontWeight: isToday ? 700 : 400,
                      color: isToday ? '#fff' : isFuture ? 'var(--border)' : 'var(--text-sub)',
                    }}
                  >
                    {dayNum}
                  </div>

                  {/* 학생별 점 그룹 */}
                  {!isFuture && (
                    <div className="flex flex-col gap-0.5 items-center w-full">
                      {students.map(student => {
                        const stat = allStats[student.id]?.[date] ?? { items: [] };
                        if (stat.items.length === 0) return null;
                        return (
                          <div key={student.id} className="flex flex-wrap justify-center gap-0.5" style={{ maxWidth: 32 }}>
                            {stat.items.map(item => (
                              <div
                                key={item.id}
                                className="rounded-full"
                                title={`${student.name}: ${item.title}`}
                                style={{
                                  width: 6, height: 6,
                                  background: item.done ? student.color : '#E5E8EB',
                                  border: item.done ? 'none' : '1px solid #C9CDD2',
                                  flexShrink: 0,
                                }}
                              />
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────
export default function StatsPage() {
  const { data } = useApp();
  const [period, setPeriod] = useState<Period>('week');

  const weekDates = getWeekDates();
  const monthDates = getMonthDates();
  const periodDates = period === 'week' ? weekDates : monthDates;

  const students = data.students;
  const homework = data.homework;
  const homeworkHistory = data.homeworkHistory ?? [];
  const exemptDates = data.exemptDates ?? [];
  const today = toLocalDateStr(new Date());

  const allStats = Object.fromEntries(
    students.map(s => [s.id, calcStats(s.id, homework, homeworkHistory, exemptDates, students, periodDates)])
  ) as Record<StudentId, Record<string, DayStat>>;

  // 학생별 요약 수치
  const summaries = students.map(s => {
    const byDate = allStats[s.id] ?? {};
    const activeDates = periodDates.filter(
      d => d <= today && !isDailyHomeworkExempt(d, exemptDates) && (byDate[d]?.items.length ?? 0) > 0,
    );
    const completedDays = activeDates.filter(d => byDate[d].pending === 0).length;
    const activeDays = activeDates.length;
    return { student: s, completedDays, activeDays };
  });

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="px-5 pt-14 pb-4" style={{ background: 'var(--surface)' }}>
        <h1 className="font-bold" style={{ fontSize: 22, color: 'var(--text)' }}>학습 통계</h1>
        <p style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 2 }}>숙제 완료 현황 비교</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Period Toggle */}
        <div className="flex rounded-2xl p-1" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}>
          {(['week', 'month'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="flex-1 py-2.5 rounded-xl font-bold transition-all"
              style={{
                fontSize: 13,
                background: period === p ? 'var(--primary)' : 'transparent',
                color: period === p ? '#fff' : 'var(--text-sub)',
              }}
            >
              {p === 'week' ? `이번 주  ${getWeekLabel()}` : `이번 달  ${getMonthLabel()}`}
            </button>
          ))}
        </div>

        {/* 학생 요약 카드 */}
        <div className="grid grid-cols-2 gap-3">
          {summaries.map(({ student, completedDays, activeDays }) => (
            <div key={student.id} className="rounded-2xl p-4" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)', borderTop: `3px solid ${student.color}` }}>
              <div className="flex items-center gap-2 mb-3">
                {student.photo ? (
                  <img src={student.photo} alt="" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover' }} />
                ) : (
                  <div className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, background: student.color + '18', fontSize: 16 }}>
                    {student.avatar}
                  </div>
                )}
                <div>
                  <p className="font-bold" style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.2 }}>{student.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-sub)' }}>{student.grade}</p>
                </div>
              </div>
              <div className="flex items-end gap-1">
                <span className="font-bold" style={{ fontSize: 26, color: student.color, lineHeight: 1 }}>{completedDays}</span>
                <span style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 2 }}>/ {activeDays}일</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 2 }}>숙제 있던 날 완료</p>
            </div>
          ))}
        </div>

        {/* 범례 */}
        <div className="flex flex-wrap gap-3 px-1">
          {students.map(s => (
            <div key={s.id} className="flex items-center gap-1.5">
              <div className="rounded-full" style={{ width: 10, height: 10, background: s.color }} />
              <span style={{ fontSize: 12, color: 'var(--text-sub)', fontWeight: 600 }}>{s.name} 완료</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="rounded-full" style={{ width: 10, height: 10, background: '#E5E8EB', border: '1.5px solid #C9CDD2' }} />
            <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>미완료</span>
          </div>
        </div>

        {/* 통합 그래프 */}
        <div className="rounded-2xl p-5 animate-fadein" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}>
          {period === 'week' ? (
            <WeekView dates={weekDates} students={students} allStats={allStats} />
          ) : (
            <MonthView dates={monthDates} students={students} allStats={allStats} />
          )}
        </div>
      </div>

      <div style={{ height: 80 }} />
    </div>
  );
}
