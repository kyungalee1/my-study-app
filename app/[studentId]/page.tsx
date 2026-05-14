'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '../lib/store';
import type { StudentId } from '../lib/types';
import { useState, useEffect, Suspense } from 'react';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

const EMOTIONS = [
  { emoji: '🔥', label: '불타올랐어' },
  { emoji: '😎', label: '뿌듯해' },
  { emoji: '😊', label: '즐거웠어' },
  { emoji: '😑', label: '그냥그래' },
  { emoji: '😤', label: '짜증났어' },
];

function toLocalStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const EMOTIONS_STORAGE_KEY = 'hw-emotions';
function loadEmotions(): Record<string, string> {
  try { const s = localStorage.getItem(EMOTIONS_STORAGE_KEY); return s ? JSON.parse(s) : {}; } catch { return {}; }
}
function saveEmotions(map: Record<string, string>) {
  try { localStorage.setItem(EMOTIONS_STORAGE_KEY, JSON.stringify(map)); } catch {}
}

function DashboardContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const studentId = params.studentId as StudentId;
  const router = useRouter();
  const { data, getStudentHomework, updateHomework } = useApp();

  const [emotions, setEmotions] = useState<Record<string, string>>({});
  // 감정 패널이 열려 있는 항목 id
  const [openEmotion, setOpenEmotion] = useState<string | null>(null);

  useEffect(() => { setEmotions(loadEmotions()); }, []);

  const student = data.students.find(s => s.id === studentId);
  const homework = getStudentHomework(studentId);
  if (!student) return null;

  const todayStr = toLocalStr(new Date());
  const viewDate = searchParams.get('date') ?? todayStr;
  const isToday = viewDate === todayStr;
  const viewDateObj = new Date(viewDate + 'T12:00:00');
  const viewDayLabel = DAY_LABELS[viewDateObj.getDay()];
  const viewDateDisplay = `${viewDateObj.getMonth() + 1}월 ${viewDateObj.getDate()}일 (${DAY_LABELS[viewDateObj.getDay()]})`;

  function isDone(h: typeof homework[number]) {
    return h.isDaily ? h.completedDates.includes(viewDate) : h.completed;
  }
  function isScheduledOnDate(h: typeof homework[number]): boolean {
    const created = toLocalStr(new Date(h.createdAt));
    if (!h.isDaily) return created === viewDate;
    if (created > viewDate) return false;
    if (h.scheduledDays.length === 0 || h.scheduledDays.includes('매일')) return true;
    return h.scheduledDays.includes(viewDayLabel);
  }

  const viewHomework = homework.filter(h => isScheduledOnDate(h));
  const pendingHw = viewHomework.filter(h => !isDone(h));
  const completedHw = viewHomework.filter(h => isDone(h));

  function toggleHomework(item: typeof homework[number]) {
    if (!isToday) return;
    if (item.isDaily) {
      const newDates = item.completedDates.includes(todayStr)
        ? item.completedDates.filter(d => d !== todayStr)
        : [...item.completedDates, todayStr];
      updateHomework(item.id, { completedDates: newDates });
    } else {
      updateHomework(item.id, { completed: true });
    }
  }

  function emotionKey(hwId: string) { return `${hwId}__${viewDate}`; }

  function selectEmotion(hwId: string, emoji: string) {
    const key = emotionKey(hwId);
    const next = { ...emotions, [key]: emoji };
    setEmotions(next);
    saveEmotions(next);
    setOpenEmotion(null);
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* 헤더 — 컴팩트 */}
      <div className="px-4 pt-12 pb-3" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => router.push(isToday ? '/' : `/?date=${viewDate}`)}
            className="flex items-center justify-center rounded-full active:opacity-50"
            style={{ width: 32, height: 32, background: 'var(--bg)', color: 'var(--text-sub)', flexShrink: 0 }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M13 5L8 10l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* 아바타 */}
          {student.photo ? (
            <img src={student.photo} alt="" style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover', border: `2px solid ${student.color}40`, flexShrink: 0 }} />
          ) : (
            <div className="flex items-center justify-center rounded-xl" style={{ width: 36, height: 36, background: student.color + '18', fontSize: 20, flexShrink: 0 }}>
              {student.avatar}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold truncate" style={{ fontSize: 17, color: 'var(--text)' }}>{student.name}</span>
              <span className="rounded-full px-1.5 py-0.5 font-semibold flex-shrink-0" style={{ fontSize: 10, background: student.color + '18', color: student.color }}>
                {student.grade}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>{viewDateDisplay}</span>
              {!isToday && (
                <span className="rounded-full px-1.5 py-0.5 font-semibold" style={{ fontSize: 9, background: '#FEF3C7', color: '#D97706' }}>과거</span>
              )}
            </div>
          </div>

          {/* 미완료/완료 인라인 수치 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex flex-col items-center rounded-xl px-2.5 py-1.5" style={{ background: pendingHw.length > 0 ? '#FEF3C7' : 'var(--bg)' }}>
              <span className="font-bold" style={{ fontSize: 18, lineHeight: 1, color: pendingHw.length > 0 ? '#D97706' : 'var(--text-sub)' }}>{pendingHw.length}</span>
              <span style={{ fontSize: 9, color: 'var(--text-sub)', marginTop: 1 }}>미완료</span>
            </div>
            <div className="flex flex-col items-center rounded-xl px-2.5 py-1.5" style={{ background: completedHw.length > 0 ? '#E6F9F5' : 'var(--bg)' }}>
              <span className="font-bold" style={{ fontSize: 18, lineHeight: 1, color: completedHw.length > 0 ? 'var(--success)' : 'var(--text-sub)' }}>{completedHw.length}</span>
              <span style={{ fontSize: 9, color: 'var(--text-sub)', marginTop: 1 }}>완료</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 py-3 space-y-3">
        {/* 과거 안내 */}
        {!isToday && (
          <div className="rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: '#FEF3C7' }}>
            <span style={{ fontSize: 13 }}>📅</span>
            <p style={{ fontSize: 11, color: '#92400E', fontWeight: 600 }}>과거 기록 — 체크 변경 불가</p>
          </div>
        )}

        {/* 숙제 없는 날 */}
        {viewHomework.length === 0 && (
          <div className="rounded-2xl p-8 flex flex-col items-center" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}>
            <span style={{ fontSize: 36, marginBottom: 6 }}>📋</span>
            <p className="font-bold" style={{ fontSize: 15, color: 'var(--text)' }}>숙제가 없는 날이에요</p>
          </div>
        )}

        {/* 미완료 섹션 */}
        {pendingHw.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}>
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <span className="font-bold" style={{ fontSize: 13, color: 'var(--text)' }}>미완료 숙제</span>
              {isToday && (
                <button onClick={() => router.push(`/${studentId}/homework`)} style={{ fontSize: 12, color: 'var(--primary)' }}>관리</button>
              )}
            </div>
            {pendingHw.map((item, i) => {
              const subj = data.subjects.find(s => s.id === item.subjectId);
              return (
                <div key={item.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}>
                  <button
                    onClick={() => toggleHomework(item)}
                    disabled={!isToday}
                    className="flex-shrink-0 rounded-full active:scale-90 transition-transform"
                    style={{
                      width: 26, height: 26,
                      background: 'transparent',
                      border: `2px solid ${isToday ? student.color : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: isToday ? 1 : 0.4,
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 13 13" fill="none" opacity={0.3}>
                      <path d="M2 6.5l3 3 6-6" stroke={student.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-semibold" style={{ fontSize: 14, color: 'var(--text)' }}>{item.title}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="rounded-full px-1.5 py-0.5 font-bold" style={{ fontSize: 9, background: item.isDaily ? '#3182F615' : '#F59E0B15', color: item.isDaily ? '#3182F6' : '#D97706' }}>
                        {item.isDaily ? '📅 매일' : '✨ 오늘만'}
                      </span>
                      {subj && <span className="rounded-full px-1.5 py-0.5 font-semibold" style={{ fontSize: 9, background: subj.color + '18', color: subj.color }}>{subj.name}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
            <div style={{ height: 4 }} />
          </div>
        )}

        {/* 완료 섹션 */}
        {completedHw.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}>
            <div className="px-4 pt-3 pb-2">
              <span className="font-bold" style={{ fontSize: 13, color: 'var(--text)' }}>완료한 숙제 ✓</span>
            </div>
            {completedHw.map((item, i) => {
              const key = emotionKey(item.id);
              const selected = emotions[key];
              const isOpen = openEmotion === key;

              return (
                <div key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                  {/* 숙제 행 */}
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    {/* 완료 체크 */}
                    <div className="flex-shrink-0 rounded-full flex items-center justify-center"
                      style={{ width: 26, height: 26, background: student.color }}>
                      <svg width="11" height="11" viewBox="0 0 13 13" fill="none">
                        <path d="M2 6.5l3 3 6-6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>

                    <p className="flex-1 truncate font-semibold" style={{ fontSize: 14, color: 'var(--text-sub)', textDecoration: 'line-through' }}>
                      {item.title}
                    </p>

                    {/* 감정 버튼 — 선택됐으면 이모지, 아니면 "기분?" */}
                    <button
                      onClick={() => setOpenEmotion(isOpen ? null : key)}
                      className="flex-shrink-0 rounded-full flex items-center gap-1 active:scale-90 transition-transform"
                      style={{
                        padding: '4px 10px',
                        background: selected ? student.color + '18' : 'var(--bg)',
                        border: `1.5px solid ${selected ? student.color + '40' : 'var(--border)'}`,
                      }}
                    >
                      {selected ? (
                        <span style={{ fontSize: 18 }}>{selected}</span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-sub)', fontWeight: 600 }}>기분?</span>
                      )}
                    </button>
                  </div>

                  {/* 감정 선택 드롭다운 */}
                  {isOpen && (
                    <div className="px-3 pb-3 pt-1">
                      <div className="flex gap-1.5">
                        {EMOTIONS.map(({ emoji, label }) => {
                          const isSel = selected === emoji;
                          return (
                            <button
                              key={emoji}
                              onClick={() => selectEmotion(item.id, emoji)}
                              className="flex-1 flex flex-col items-center gap-1 rounded-xl py-2 active:scale-90 transition-all"
                              style={{
                                background: isSel ? student.color : 'var(--bg)',
                                boxShadow: isSel ? `0 3px 10px ${student.color}40` : 'none',
                              }}
                            >
                              <span style={{ fontSize: 22 }}>{emoji}</span>
                              <span style={{ fontSize: 8, fontWeight: 700, color: isSel ? '#fff' : 'var(--text-sub)', textAlign: 'center', lineHeight: 1.3 }}>
                                {label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ height: 4 }} />
          </div>
        )}

        {/* 모두 완료 배너 */}
        {pendingHw.length === 0 && completedHw.length > 0 && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-2" style={{ background: '#E6F9F5' }}>
            <span style={{ fontSize: 20 }}>🎉</span>
            <p className="font-bold" style={{ fontSize: 13, color: 'var(--success)' }}>
              {isToday ? '오늘 숙제 모두 완료!' : '이 날 숙제를 다 마쳤어요'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}
