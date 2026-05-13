'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApp } from '../../lib/store';
import type { StudentId, HomeworkItem } from '../../lib/types';

type Tab = 'daily' | 'oneday';

const DAY_OPTIONS = ['매일', '월', '화', '수', '목', '금', '토', '일'] as const;
const DAY_OF_WEEK = ['일', '월', '화', '수', '목', '금', '토'] as const;

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatScheduledDays(days: string[]): string {
  if (days.length === 0 || days.includes('매일')) return '매일';
  return days.join('·');
}

export default function HomeworkPage() {
  const params = useParams();
  const studentId = params.studentId as StudentId;
  const { data, getStudentSubjects, getStudentHomework, addHomework, updateHomework, deleteHomework } = useApp();

  const router = useRouter();
  const student = data.students.find(s => s.id === studentId);
  const subjects = getStudentSubjects(studentId);
  const allHomework = getStudentHomework(studentId);
  const today = toDateStr(new Date());

  const [tab, setTab] = useState<Tab>('daily');
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [scheduledDays, setScheduledDays] = useState<string[]>(['매일']);

  // 탭별 숙제 분리
  const dailyItems = allHomework.filter(h => h.isDaily);
  const onedayItems = allHomework
    .filter(h => !h.isDaily)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const currentItems = tab === 'daily' ? dailyItems : onedayItems;

  // 완료 여부 계산 (탭 종류에 따라 다름)
  function isDone(item: HomeworkItem): boolean {
    return item.isDaily ? item.completedDate === today : item.completed;
  }

  const pendingCount = currentItems.filter(h => !isDone(h)).length;
  const doneCount = currentItems.filter(h => isDone(h)).length;

  function toggleComplete(item: HomeworkItem) {
    if (item.isDaily) {
      const nowDone = item.completedDate === today;
      updateHomework(item.id, { completedDate: nowDone ? null : today });
    } else {
      updateHomework(item.id, { completed: !item.completed });
    }
  }

  function toggleDay(day: string) {
    if (day === '매일') {
      setScheduledDays(['매일']);
      return;
    }
    setScheduledDays(prev => {
      const withoutAll = prev.filter(d => d !== '매일');
      const already = withoutAll.includes(day);
      const next = already
        ? withoutAll.filter(d => d !== day)
        : [...withoutAll, day];
      return next.length === 0 ? ['매일'] : next;
    });
  }

  function addItem() {
    if (!title.trim()) return;
    const item: HomeworkItem = {
      id: `hw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      studentId,
      subjectId: subjectId || null,
      title: title.trim(),
      dueDate: null,
      completed: false,
      completedDate: null,
      createdAt: new Date().toISOString(),
      isDaily: tab === 'daily',
      scheduledDays: tab === 'daily' ? scheduledDays : [],
    };
    addHomework(item);
    setTitle('');
    setSubjectId('');
    setScheduledDays(['매일']);
    setShowAdd(false);
  }

  const color = student?.color ?? 'var(--primary)';

  function HomeworkRow({ item, i }: { item: HomeworkItem; i: number }) {
    const subj = data.subjects.find(s => s.id === item.subjectId);
    const done = isDone(item);

    return (
      <div
        className="rounded-2xl animate-fadein"
        style={{
          background: 'var(--surface)',
          boxShadow: 'var(--shadow)',
          animationDelay: `${i * 0.04}s`,
          opacity: done ? 0.72 : 1,
        }}
      >
        <div className="flex items-center gap-3 p-4">
          {/* Checkbox */}
          <button
            onClick={() => toggleComplete(item)}
            className="flex-shrink-0 rounded-full transition-all active:scale-90"
            style={{
              width: 28, height: 28,
              background: done ? 'var(--success)' : 'transparent',
              border: `2.5px solid ${done ? 'var(--success)' : color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {done ? (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2 6.5l3 3 6-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" opacity="0.3">
                <path d="M2 6.5l3 3 6-6" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>

          <div className="flex-1 min-w-0">
            <p
              className="font-semibold"
              style={{
                fontSize: 15,
                color: done ? 'var(--text-sub)' : 'var(--text)',
                textDecoration: done ? 'line-through' : 'none',
              }}
            >
              {item.title}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {/* 요일 배지 (매일 숙제만) */}
              {item.isDaily && (
                <span
                  className="rounded-full px-2 py-0.5 font-bold"
                  style={{ fontSize: 10, background: color + '18', color }}
                >
                  {formatScheduledDays(item.scheduledDays)}
                </span>
              )}
              {subj && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
                  style={{ fontSize: 11, background: subj.color + '20', color: subj.color }}
                >
                  {subj.name}
                </span>
              )}
              {done && (
                <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>
                  {item.isDaily ? '오늘 완료 ✓' : '완료'}
                </span>
              )}
            </div>
          </div>

          {/* Delete */}
          <button
            onClick={() => deleteHomework(item.id)}
            className="p-2 rounded-xl flex-shrink-0"
            style={{ background: 'var(--bg)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9"
                stroke="var(--text-light)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="px-5 pt-14 pb-0" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}>
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

        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span style={{ fontSize: 20 }}>{student?.avatar}</span>
              <h1 className="font-bold" style={{ fontSize: 22, color: 'var(--text)' }}>숙제 관리</h1>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-sub)' }}>
              미완료{' '}
              <span style={{ fontWeight: 700, color: pendingCount > 0 ? 'var(--error)' : 'var(--text)' }}>
                {pendingCount}개
              </span>
              {doneCount > 0 && (
                <>
                  {' '}· 완료{' '}
                  <span style={{ fontWeight: 700, color: 'var(--success)' }}>{doneCount}개</span>
                </>
              )}
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-2xl px-4 py-2.5 font-bold flex items-center gap-1.5"
            style={{ background: color, color: '#fff', fontSize: 14 }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            추가
          </button>
        </div>

        {/* Tabs */}
        <div className="flex">
          {([
            { key: 'daily', label: '📅 매일 숙제', desc: '매일 반복' },
            { key: 'oneday', label: '✨ 오늘만', desc: '임시 추가' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-1 pb-3 pt-1 font-bold transition-all relative"
              style={{
                fontSize: 14,
                color: tab === t.key ? color : 'var(--text-sub)',
              }}
            >
              {t.label}
              {tab === t.key && (
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-t-full"
                  style={{ height: 3, background: color }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 설명 배너 */}
      <div
        className="mx-4 mt-4 rounded-2xl px-4 py-3 flex items-center gap-2"
        style={{ background: color + '12' }}
      >
        {tab === 'daily' ? (
          <>
            <span style={{ fontSize: 18 }}>📅</span>
            <p style={{ fontSize: 12, color, fontWeight: 600 }}>
              매일 반복되는 숙제입니다. 요일을 지정하면 해당 요일에만 표시됩니다.
            </p>
          </>
        ) : (
          <>
            <span style={{ fontSize: 18 }}>✨</span>
            <p style={{ fontSize: 12, color, fontWeight: 600 }}>
              오늘 하루만 추가된 숙제입니다. 완료 후 삭제하면 돼요.
            </p>
          </>
        )}
      </div>

      {/* List */}
      <div className="px-4 py-4 space-y-2">
        {currentItems.length === 0 && (
          <div className="rounded-2xl p-10 flex flex-col items-center" style={{ background: 'var(--surface)' }}>
            <span style={{ fontSize: 48, marginBottom: 10 }}>
              {tab === 'daily' ? '📋' : '📝'}
            </span>
            <p className="font-bold mb-1" style={{ fontSize: 16, color: 'var(--text)' }}>
              {tab === 'daily' ? '매일 숙제가 없어요!' : '오늘 추가된 숙제가 없어요!'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-sub)' }}>위 + 버튼으로 추가해보세요</p>
          </div>
        )}

        {/* 미완료 */}
        {currentItems.filter(h => !isDone(h)).map((item, i) => (
          <HomeworkRow key={item.id} item={item} i={i} />
        ))}

        {/* 완료 구분선 */}
        {currentItems.filter(h => isDone(h)).length > 0 && (
          <>
            <div className="flex items-center gap-2 pt-2 pb-1">
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-sub)', fontWeight: 600 }}>
                완료 {currentItems.filter(h => isDone(h)).length}개 · 탭하면 되돌아가요
              </span>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>
            {currentItems.filter(h => isDone(h)).map((item, i) => (
              <HomeworkRow key={item.id} item={item} i={i} />
            ))}
          </>
        )}
      </div>

      {/* Add Sheet */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full rounded-t-3xl p-6 animate-slideup" style={{ background: 'var(--surface)', maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--border)' }} />
            <div className="flex items-center gap-2 mb-5">
              <span style={{ fontSize: 18 }}>{tab === 'daily' ? '📅' : '✨'}</span>
              <h2 className="font-bold" style={{ fontSize: 18, color: 'var(--text)' }}>
                {tab === 'daily' ? '매일 숙제 추가' : '오늘만 숙제 추가'}
              </h2>
            </div>

            {/* 숙제 내용 */}
            <label className="block mb-1 text-sm font-semibold" style={{ color: 'var(--text-sub)' }}>숙제 내용</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
              className="w-full rounded-xl px-4 py-3 mb-4 outline-none font-medium"
              style={{ background: 'var(--bg)', fontSize: 16, color: 'var(--text)', border: '1.5px solid var(--border)' }}
              placeholder={tab === 'daily' ? '예: 수학 문제집 p.50~60' : '예: 역사 보고서 초안 작성'}
              maxLength={50}
              autoFocus
            />

            {/* 요일 선택 (매일 숙제 전용) */}
            {tab === 'daily' && (
              <>
                <label className="block mb-2 text-sm font-semibold" style={{ color: 'var(--text-sub)' }}>
                  숙제할 요일
                </label>
                <div className="flex gap-1.5 flex-wrap mb-5">
                  {DAY_OPTIONS.map(day => {
                    const isSelected =
                      day === '매일'
                        ? scheduledDays.includes('매일')
                        : !scheduledDays.includes('매일') && scheduledDays.includes(day);
                    return (
                      <button
                        key={day}
                        onClick={() => toggleDay(day)}
                        className="rounded-xl font-bold transition-all"
                        style={{
                          minWidth: day === '매일' ? 52 : 38,
                          paddingTop: 8, paddingBottom: 8,
                          paddingLeft: day === '매일' ? 12 : 0,
                          paddingRight: day === '매일' ? 12 : 0,
                          fontSize: 13,
                          background: isSelected ? color : 'var(--bg)',
                          color: isSelected ? '#fff' : 'var(--text-sub)',
                        }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* 과목 선택 */}
            <label className="block mb-2 text-sm font-semibold" style={{ color: 'var(--text-sub)' }}>과목 (선택)</label>
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => setSubjectId('')}
                className="rounded-xl px-3 py-2 font-medium text-sm transition-all"
                style={{
                  background: !subjectId ? color : 'var(--bg)',
                  color: !subjectId ? '#fff' : 'var(--text-sub)',
                }}
              >
                없음
              </button>
              {subjects.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSubjectId(s.id)}
                  className="rounded-xl px-3 py-2 font-medium text-sm transition-all"
                  style={{
                    background: subjectId === s.id ? s.color : s.color + '15',
                    color: subjectId === s.id ? '#fff' : s.color,
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowAdd(false); setTitle(''); setSubjectId(''); setScheduledDays(['매일']); }}
                className="flex-1 py-4 rounded-2xl font-bold"
                style={{ background: 'var(--bg)', color: 'var(--text-sub)', fontSize: 16 }}
              >
                취소
              </button>
              <button
                onClick={addItem}
                className="flex-1 py-4 rounded-2xl font-bold transition-all"
                style={{
                  background: title.trim() ? color : 'var(--border)',
                  color: '#fff', fontSize: 16,
                }}
                disabled={!title.trim()}
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 요일 유틸 (외부 사용 가능)
export { DAY_OF_WEEK };
