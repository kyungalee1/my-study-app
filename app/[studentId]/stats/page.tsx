'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../lib/store';
import type { HomeworkItem, StudentId } from '../../lib/types';

type Period = 'week' | 'month';

// ── 날짜 유틸 ──────────────────────────────────────────────
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
    return d.toISOString().split('T')[0];
  });
}

function getMonthDates(): string[] {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Array.from({ length: last }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), i + 1);
    return d.toISOString().split('T')[0];
  });
}

function getWeekLabel(): string {
  const dates = getWeekDates();
  const s = new Date(dates[0]);
  const e = new Date(dates[6]);
  return `${s.getMonth() + 1}/${s.getDate()}~${e.getMonth() + 1}/${e.getDate()}`;
}

function getMonthLabel(): string {
  const now = new Date();
  return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}월`;
}

const WEEK_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

// ── 학생별 통계 계산 ─────────────────────────────────────────
type DayStat = { completed: number; pending: number };

function calcStudentStats(
  studentId: StudentId,
  homework: HomeworkItem[],
  periodDates: string[]
) {
  const today = new Date().toISOString().split('T')[0];
  const byDate: Record<string, DayStat> = {};
  for (const d of periodDates) byDate[d] = { completed: 0, pending: 0 };

  const myHw = homework.filter(h => h.studentId === studentId);

  for (const date of periodDates) {
    if (date > today) continue; // 미래 날짜 제외

    for (const hw of myHw) {
      const createdDate = hw.createdAt.split('T')[0];

      if (hw.isDaily) {
        // 매일 숙제: 등록일 이후 날짜마다 활성화 + 요일 필터
        if (createdDate > date) continue;
        const dayLabel = DAY_LABELS[new Date(date).getDay()];
        const scheduled =
          hw.scheduledDays.length === 0 || hw.scheduledDays.includes('매일')
            ? true
            : hw.scheduledDays.includes(dayLabel);
        if (!scheduled) continue;
        const done = hw.completedDate === date;
        if (done) byDate[date].completed++;
        else byDate[date].pending++;
      } else {
        // 오늘만 숙제: 생성한 날에만 집계
        if (createdDate !== date) continue;
        if (hw.completed) byDate[date].completed++;
        else byDate[date].pending++;
      }
    }
  }

  // 활동일수: 해당 기간 내 숙제가 1개 이상 있는 날 (오늘 포함, 미래 제외)
  const studyDays = Object.entries(byDate).filter(
    ([date, v]) => date <= today && v.completed + v.pending > 0
  ).length;

  // 완료일: 그날 활성화된 숙제가 1개 이상이고 전부 완료된 날
  const completedDays = Object.entries(byDate).filter(
    ([date, v]) => date <= today && v.completed + v.pending > 0 && v.pending === 0
  ).length;

  return { byDate, studyDays, completedDays };
}

// ── 막대차트 ─────────────────────────────────────────────────
function DayBarChart({
  dates,
  byDate,
  color,
  isWeek,
}: {
  dates: string[];
  byDate: Record<string, DayStat>;
  color: string;
  isWeek: boolean;
}) {
  const today = new Date().toISOString().split('T')[0];
  const maxVal = Math.max(...dates.map(d => (byDate[d]?.completed ?? 0) + (byDate[d]?.pending ?? 0)), 1);

  const hasAny = dates.some(d => (byDate[d]?.completed ?? 0) + (byDate[d]?.pending ?? 0) > 0);

  if (!hasAny) {
    return (
      <div className="flex flex-col items-center py-6" style={{ color: 'var(--text-sub)' }}>
        <span style={{ fontSize: 32, marginBottom: 8 }}>📋</span>
        <p style={{ fontSize: 13 }}>아직 숙제 기록이 없어요</p>
      </div>
    );
  }

  return (
    <div>
      {/* Legend */}
      <div className="flex gap-3 mb-3">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--success)' }} />
          <span style={{ fontSize: 11, color: 'var(--text-sub)' }}>완료</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#E5E8EB' }} />
          <span style={{ fontSize: 11, color: 'var(--text-sub)' }}>미완료</span>
        </div>
      </div>

      <div className="flex items-end gap-1" style={{ height: 110 }}>
        {dates.map((date, i) => {
          const stat = byDate[date] ?? { completed: 0, pending: 0 };
          const total = stat.completed + stat.pending;
          const totalPct = total > 0 ? (total / maxVal) * 100 : 0;
          const completedPct = total > 0 ? (stat.completed / total) * 100 : 0;
          const isToday = date === today;
          const label = isWeek ? WEEK_LABELS[i] : String(parseInt(date.split('-')[2]));

          return (
            <div key={date} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full flex flex-col justify-end rounded-t-md overflow-hidden" style={{ height: 90 }}>
                {total > 0 ? (
                  <div
                    className="w-full flex flex-col justify-end rounded-t-md overflow-hidden"
                    style={{ height: `${totalPct}%`, minHeight: 4 }}
                  >
                    {/* pending on top */}
                    {stat.pending > 0 && (
                      <div
                        style={{
                          height: `${100 - completedPct}%`,
                          minHeight: stat.pending > 0 ? 3 : 0,
                          background: isToday ? '#C9CDD2' : '#E5E8EB',
                        }}
                      />
                    )}
                    {/* completed on bottom */}
                    {stat.completed > 0 && (
                      <div
                        style={{
                          height: `${completedPct}%`,
                          minHeight: stat.completed > 0 ? 3 : 0,
                          background: 'var(--success)',
                        }}
                      />
                    )}
                  </div>
                ) : null}
              </div>
              <span
                style={{
                  fontSize: isWeek ? 11 : 9,
                  color: isToday ? color : 'var(--text-light)',
                  fontWeight: isToday ? 700 : 500,
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────
export default function StatsPage() {
  const router = useRouter();
  const { data } = useApp();
  const [period, setPeriod] = useState<Period>('week');

  const weekDates = getWeekDates();
  const monthDates = getMonthDates();
  const periodDates = period === 'week' ? weekDates : monthDates;

  const students = data.students;
  const homework = data.homework;

  const statsMap = Object.fromEntries(
    students.map(s => [s.id, calcStudentStats(s.id, homework, periodDates)])
  ) as Record<StudentId, ReturnType<typeof calcStudentStats>>;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="px-5 pt-14 pb-5" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}>
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1 mb-3"
          style={{ color: 'var(--text-sub)', fontSize: 14 }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          전체 학생
        </button>
        <h1 className="font-bold mb-1" style={{ fontSize: 22, color: 'var(--text)' }}>학습 통계</h1>
        <p style={{ fontSize: 13, color: 'var(--text-sub)' }}>전체 학생 숙제 완료 현황을 비교해요</p>
      </div>

      <div className="px-4 py-5 space-y-5">
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
              {p === 'week' ? getWeekLabel() : getMonthLabel()}
            </button>
          ))}
        </div>

        {/* ── 학생별 상세 ── */}
        {students.map((student, idx) => {
          const st = statsMap[student.id];
          // 날짜 기준 완료/미완료
          const completedDays = st.completedDays;                    // 그날 숙제 전부 완료
          const incompleteDays = st.studyDays - st.completedDays;    // 활동했지만 미완료인 날
          const totalPeriodDays = periodDates.length;                 // 주=7, 월=실제 일수

          return (
            <div
              key={student.id}
              className="rounded-2xl overflow-hidden animate-fadein"
              style={{
                background: 'var(--surface)',
                boxShadow: 'var(--shadow)',
                animationDelay: `${idx * 0.06}s`,
              }}
            >
              {/* Student Header */}
              <div
                className="px-5 py-4 flex items-center gap-3"
                style={{ background: student.color + '12', borderBottom: '1px solid var(--border)' }}
              >
                {student.photo ? (
                  <img
                    src={student.photo}
                    alt=""
                    style={{ width: 40, height: 40, borderRadius: 13, objectFit: 'cover', border: `2px solid ${student.color}40` }}
                  />
                ) : (
                  <div
                    className="rounded-2xl flex items-center justify-center"
                    style={{ width: 40, height: 40, background: student.color + '25', fontSize: 22 }}
                  >
                    {student.avatar}
                  </div>
                )}
                <div>
                  <p className="font-bold" style={{ fontSize: 16, color: 'var(--text)' }}>{student.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-sub)' }}>{student.grade}</p>
                </div>
                <div className="ml-auto">
                  <span
                    className="rounded-full px-2.5 py-1 font-semibold"
                    style={{ fontSize: 11, background: student.color + '18', color: student.color }}
                  >
                    {period === 'week' ? getWeekLabel() : getMonthLabel()}
                  </span>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* Summary — 날짜 기준 (단일) */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg)' }}>
                    <p style={{ fontSize: 10, color: 'var(--text-sub)', fontWeight: 600 }}>활동일수</p>
                    <p className="font-bold mt-1" style={{ fontSize: 22, color: 'var(--text)' }}>{st.studyDays}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-sub)' }}>일</p>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ background: '#E6F9F5' }}>
                    <p style={{ fontSize: 10, color: '#00875A', fontWeight: 600 }}>완료일</p>
                    <p className="font-bold mt-1" style={{ fontSize: 22, color: 'var(--success)' }}>{completedDays}</p>
                    <p style={{ fontSize: 10, color: '#00875A' }}>일</p>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ background: student.color + '12' }}>
                    <p style={{ fontSize: 10, color: student.color, fontWeight: 600 }}>완료율</p>
                    <p className="font-bold mt-1" style={{ fontSize: 16, color: student.color, lineHeight: 1.2 }}>
                      {completedDays}/{totalPeriodDays}
                    </p>
                    <p style={{ fontSize: 10, color: student.color }}>일 완료</p>
                  </div>
                </div>

                {/* Bar chart */}
                <div>
                  <p className="font-bold mb-3" style={{ fontSize: 14, color: 'var(--text)' }}>
                    {period === 'week' ? '요일별' : '날짜별'} 완료 현황
                  </p>
                  <DayBarChart
                    dates={periodDates}
                    byDate={st.byDate}
                    color={student.color}
                    isWeek={period === 'week'}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
