'use client';

import { useParams, useRouter } from 'next/navigation';
import { useApp } from '../lib/store';
import type { StudentId } from '../lib/types';

export default function DashboardPage() {
  const params = useParams();
  const studentId = params.studentId as StudentId;
  const router = useRouter();
  const { data, getStudentHomework, updateHomework } = useApp();

  const student = data.students.find(s => s.id === studentId);
  const homework = getStudentHomework(studentId);

  if (!student) return null;

  const todayDate = new Date();
  const today = todayDate.toISOString().split('T')[0];
  const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;
  const todayLabel = DAY_LABELS[todayDate.getDay()];

  function formatScheduledDays(days: string[]): string {
    if (days.length === 0 || days.includes('매일')) return '매일';
    return days.join('·');
  }

  // 오늘 표시해야 하는 숙제인지 판단 (요일 필터 적용)
  function isScheduledToday(h: typeof homework[number]): boolean {
    if (!h.isDaily) return true;
    if (h.scheduledDays.length === 0 || h.scheduledDays.includes('매일')) return true;
    return h.scheduledDays.includes(todayLabel);
  }

  function isDone(h: typeof homework[number]) {
    return h.isDaily ? h.completedDate === today : h.completed;
  }

  const todayHomework = homework.filter(h => isScheduledToday(h));
  const pendingHw = todayHomework.filter(h => !isDone(h));
  const completedHw = todayHomework.filter(h => isDone(h));

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dateStr = `${todayDate.getMonth() + 1}월 ${todayDate.getDate()}일 (${dayNames[todayDate.getDay()]})`;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="px-5 pt-14 pb-6" style={{ background: 'var(--surface)' }}>
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1 mb-4"
          style={{ color: 'var(--text-sub)', fontSize: 14 }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          전체 학생
        </button>
        <div className="flex items-center gap-3">
          {student.photo ? (
            <img
              src={student.photo}
              alt="프로필"
              style={{ width: 52, height: 52, borderRadius: 16, objectFit: 'cover', border: `2px solid ${student.color}30` }}
            />
          ) : (
            <div
              className="rounded-2xl flex items-center justify-center text-3xl"
              style={{ width: 52, height: 52, background: student.color + '18' }}
            >
              {student.avatar}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold" style={{ fontSize: 22, color: 'var(--text)' }}>{student.name}</h1>
              <span className="rounded-full px-2 py-0.5 font-medium" style={{ fontSize: 11, background: student.color + '18', color: student.color }}>
                {student.grade}
              </span>
            </div>
            <p style={{ color: 'var(--text-sub)', fontSize: 13, marginTop: 2 }}>{dateStr}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Homework Summary Card */}
        <div
          className="rounded-2xl p-5 animate-fadein"
          style={{ background: student.color, boxShadow: `0 8px 24px ${student.color}40` }}
        >
          <p className="font-medium mb-4" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>숙제 현황</p>
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-xl p-3"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>미완료</p>
              <div className="flex items-end gap-1">
                <span className="font-bold" style={{ fontSize: 32, color: '#fff', lineHeight: 1 }}>
                  {pendingHw.length}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15, marginBottom: 2 }}>개</span>
              </div>
            </div>
            <div
              className="rounded-xl p-3"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            >
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>완료</p>
              <div className="flex items-end gap-1">
                <span className="font-bold" style={{ fontSize: 32, color: '#fff', lineHeight: 1 }}>
                  {completedHw.length}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15, marginBottom: 2 }}>개</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Homework — checkable list */}
        {pendingHw.length > 0 ? (
          <div
            className="rounded-2xl p-5 animate-fadein"
            style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)', animationDelay: '0.08s' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold" style={{ fontSize: 16, color: 'var(--text)' }}>미완료 숙제</h2>
              <button
                onClick={() => router.push(`/${studentId}/homework`)}
                style={{ fontSize: 13, color: 'var(--primary)' }}
              >
                전체보기
              </button>
            </div>
            <div className="space-y-2">
              {pendingHw.map((item, i) => {
                const subj = data.subjects.find(s => s.id === item.subjectId);
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl p-3 animate-fadein"
                    style={{ background: 'var(--bg)', animationDelay: `${i * 0.04}s` }}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => item.isDaily
                        ? updateHomework(item.id, { completedDate: today })
                        : updateHomework(item.id, { completed: true })
                      }
                      className="flex-shrink-0 rounded-full transition-all active:scale-90"
                      style={{
                        width: 28, height: 28,
                        background: 'transparent',
                        border: `2.5px solid ${student.color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" opacity="0.35">
                        <path d="M2 6.5l3 3 6-6" stroke={student.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }} className="truncate">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {/* 매일/오늘만 배지 */}
                        <span
                          className="rounded-full px-2 py-0.5 font-bold"
                          style={{
                            fontSize: 10,
                            background: item.isDaily ? '#3182F615' : '#F59E0B15',
                            color: item.isDaily ? '#3182F6' : '#D97706',
                          }}
                        >
                          {item.isDaily ? `📅 ${formatScheduledDays(item.scheduledDays)}` : '✨ 오늘만'}
                        </span>
                        {subj && (
                          <span
                            className="rounded-full px-2 py-0.5 font-semibold"
                            style={{ fontSize: 10, background: subj.color + '18', color: subj.color }}
                          >
                            {subj.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div
            className="rounded-2xl p-8 flex flex-col items-center animate-fadein"
            style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)', animationDelay: '0.08s' }}
          >
            <span style={{ fontSize: 44, marginBottom: 8 }}>🎉</span>
            <p className="font-bold" style={{ fontSize: 16, color: 'var(--text)' }}>모든 숙제 완료!</p>
            <p style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>오늘 숙제를 다 마쳤어요</p>
          </div>
        )}
      </div>
    </div>
  );
}
