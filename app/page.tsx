'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppProvider, useApp } from './lib/store';
import type { HomeworkItem, StudentId } from './lib/types';

const POINT_DAILY = 500;    // 매일 숙제: 전체 완료일 +500 / 지난 미완료일 -500
const POINT_ONEDAY = 300;   // 오늘만 숙제: 해당 날 전부 완료 시 +300
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

interface PointsBreakdown {
  daily: number;    // 매일 숙제 포인트 합계
  oneday: number;   // 오늘만 숙제 포인트 합계
  total: number;    // 전체 합계
}

function isDoneOn(hw: HomeworkItem, dateStr: string): boolean {
  return hw.isDaily ? hw.completedDate === dateStr : hw.completed;
}

function calcMonthlyPoints(studentId: StudentId, homework: HomeworkItem[]): PointsBreakdown {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  // ── 매일 숙제: 각 숙제의 등록일부터 날짜별 전체 완료 여부 집계 ──────────
  const dailyHw = homework.filter(h => h.isDaily && h.studentId === studentId);
  let dailyPoints = 0;

  if (dailyHw.length > 0) {
    const start = new Date(monthStart);
    const end = new Date(today);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      // 이 날짜 기준으로 이미 등록된 숙제만 집계 (등록일 <= 해당 날짜)
      const dayLabel = DAY_LABELS[new Date(dateStr).getDay()];
      const activeDailyHw = dailyHw.filter(hw => {
        if (hw.createdAt.split('T')[0] > dateStr) return false;
        // 요일 필터: '매일' 또는 해당 요일 포함 시 활성
        if (hw.scheduledDays.length === 0 || hw.scheduledDays.includes('매일')) return true;
        return hw.scheduledDays.includes(dayLabel);
      });
      if (activeDailyHw.length === 0) continue;

      const pending = activeDailyHw.filter(hw => !isDoneOn(hw, dateStr)).length;
      if (pending === 0) {
        dailyPoints += POINT_DAILY;        // 그날 전부 완료 → +500
      } else if (dateStr < today) {
        dailyPoints -= POINT_DAILY;        // 지난 날 미완료 → -500
      }
    }
  }

  // ── 오늘만 숙제: 날짜별로 그룹화하여 그날 등록된 전부 완료 시 +300 ──────
  const onedayHw = homework.filter(
    h => !h.isDaily && h.studentId === studentId && h.createdAt.split('T')[0] >= monthStart
  );
  let onedayPoints = 0;
  // 날짜별로 그룹화
  const onedayByDate = new Map<string, HomeworkItem[]>();
  for (const hw of onedayHw) {
    const dateKey = hw.createdAt.split('T')[0];
    if (!onedayByDate.has(dateKey)) onedayByDate.set(dateKey, []);
    onedayByDate.get(dateKey)!.push(hw);
  }
  // 날짜별로 전부 완료 시에만 +300
  for (const [, items] of onedayByDate) {
    if (items.length > 0 && items.every(hw => hw.completed)) {
      onedayPoints += POINT_ONEDAY;
    }
  }

  return { daily: dailyPoints, oneday: onedayPoints, total: dailyPoints + onedayPoints };
}

function formatPoints(pts: number): string {
  const abs = Math.abs(pts).toLocaleString('ko-KR');
  if (pts > 0) return `+${abs}원`;
  if (pts < 0) return `-${abs}원`;
  return '0원';
}

function formatPointsShort(pts: number): string {
  if (pts === 0) return '0원';
  const abs = Math.abs(pts).toLocaleString('ko-KR');
  return pts > 0 ? `+${abs}원` : `-${abs}원`;
}

const GRADE_GROUPS = [
  { label: '초등학교', grades: ['초1', '초2', '초3', '초4', '초5', '초6'] },
  { label: '중학교', grades: ['중1', '중2', '중3'] },
  { label: '고등학교', grades: ['고1', '고2', '고3'] },
];

function AvatarDisplay({ photo, avatar, color, size = 64 }: { photo?: string; avatar: string; color: string; size?: number }) {
  if (photo) {
    return (
      <img
        src={photo}
        alt="프로필"
        style={{
          width: size, height: size,
          borderRadius: size * 0.3,
          objectFit: 'cover',
          flexShrink: 0,
          border: `2px solid ${color}30`,
        }}
      />
    );
  }
  return (
    <div
      className="rounded-2xl flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, background: color + '18', fontSize: size * 0.45 }}
    >
      {avatar}
    </div>
  );
}

function HomeContent() {
  const { data, updateStudent, loading } = useApp();
  const homework = data.homework;
  const router = useRouter();

  const [editingId, setEditingId] = useState<StudentId | null>(null);
  const [editName, setEditName] = useState('');
  const [editGrade, setEditGrade] = useState('');
  const [editPhoto, setEditPhoto] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="flex flex-col items-center gap-3">
          <div
            className="animate-spin"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '3px solid var(--border)',
              borderTopColor: 'var(--primary)',
            }}
          />
          <p style={{ color: 'var(--text-sub)', fontSize: 14 }}>불러오는 중...</p>
        </div>
      </div>
    );
  }

  function startEdit(id: StudentId) {
    const student = data.students.find(s => s.id === id)!;
    setEditName(student.name);
    setEditGrade(student.grade);
    setEditPhoto(student.photo);
    setEditingId(id);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setEditPhoto(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    setEditPhoto(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function saveEdit() {
    if (!editingId) return;
    updateStudent(editingId, {
      name: editName.trim() || '학생',
      grade: editGrade,
      photo: editPhoto,
    });
    setEditingId(null);
  }

  function goToStudent(id: StudentId) {
    router.push(`/${id}`);
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="px-5 pt-14 pb-6" style={{ background: 'var(--surface)' }}>
        <p style={{ color: 'var(--text-sub)', fontSize: 14 }}>{dateStr}</p>
        <h1 className="mt-1 font-bold" style={{ fontSize: 26, color: 'var(--text)' }}>
          공부 관리
        </h1>
        <p className="mt-1" style={{ color: 'var(--text-sub)', fontSize: 15 }}>
          오늘도 함께 열심히 해봐요 💪
        </p>
      </div>

      {/* Student Cards */}
      <div className="px-4 py-5 space-y-3">
        {/* 이달 포인트 안내 */}
        <div className="rounded-2xl px-4 py-3 mb-1" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}>
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontSize: 18 }}>💰</span>
            <p className="font-bold" style={{ fontSize: 13, color: 'var(--text)' }}>이달 포인트 정산 기준</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg)' }}>
              <p className="font-bold" style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 4 }}>📅 매일 숙제</p>
              <p style={{ fontSize: 11, color: 'var(--text-sub)' }}>전부 완료한 날 <span style={{ color: 'var(--success)', fontWeight: 700 }}>+500원</span></p>
              <p style={{ fontSize: 11, color: 'var(--text-sub)' }}>지난 날 미완료 <span style={{ color: 'var(--error)', fontWeight: 700 }}>-500원</span></p>
            </div>
            <div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg)' }}>
              <p className="font-bold" style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 4 }}>✨ 오늘만 숙제</p>
              <p style={{ fontSize: 11, color: 'var(--text-sub)' }}>그날 전부 완료 시 <span style={{ color: 'var(--success)', fontWeight: 700 }}>+300원</span></p>
              <p style={{ fontSize: 11, color: 'var(--text-sub)' }}>매월 1일 초기화</p>
            </div>
          </div>
        </div>

        {data.students.map((student, i) => {
          const pts = calcMonthlyPoints(student.id, homework);
          const totalColor = pts.total > 0 ? 'var(--success)' : pts.total < 0 ? 'var(--error)' : 'var(--text-sub)';
          const dailyColor = pts.daily > 0 ? 'var(--success)' : pts.daily < 0 ? 'var(--error)' : 'var(--text-sub)';
          const onedayColor = pts.oneday > 0 ? 'var(--success)' : 'var(--text-sub)';

          return (
          <div
            key={student.id}
            className="animate-slideup"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <button
              onClick={() => goToStudent(student.id)}
              className="w-full text-left rounded-2xl p-5 transition-all"
              style={{
                background: 'var(--surface)',
                boxShadow: 'var(--shadow)',
                border: `2px solid transparent`,
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = student.color)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
            >
              {/* 학생 기본 정보 */}
              <div className="flex items-center gap-4 mb-4">
                <AvatarDisplay photo={student.photo} avatar={student.avatar} color={student.color} size={56} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold" style={{ fontSize: 20, color: 'var(--text)' }}>
                      {student.name}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 font-medium"
                      style={{ fontSize: 12, background: student.color + '18', color: student.color }}
                    >
                      {student.grade}
                    </span>
                  </div>
                  <p className="mt-0.5" style={{ color: 'var(--text-sub)', fontSize: 13 }}>
                    탭해서 공부 현황 보기
                  </p>
                </div>
                {/* 총 포인트 */}
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="font-bold" style={{ fontSize: 20, color: totalColor, lineHeight: 1 }}>
                    {formatPoints(pts.total)}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-sub)', marginTop: 2 }}>이달 합계</span>
                </div>
              </div>

              {/* 포인트 내역 바 */}
              <div
                className="rounded-xl px-4 py-3 grid grid-cols-2 gap-3"
                style={{ background: 'var(--bg)' }}
              >
                <div className="flex flex-col gap-0.5">
                  <span style={{ fontSize: 10, color: 'var(--text-sub)', fontWeight: 600 }}>📅 매일 숙제</span>
                  <span className="font-bold" style={{ fontSize: 15, color: dailyColor }}>
                    {formatPointsShort(pts.daily)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span style={{ fontSize: 10, color: 'var(--text-sub)', fontWeight: 600 }}>✨ 오늘만 숙제</span>
                  <span className="font-bold" style={{ fontSize: 15, color: onedayColor }}>
                    {formatPointsShort(pts.oneday)}
                  </span>
                </div>
              </div>
            </button>

            <button
              onClick={() => startEdit(student.id)}
              className="mt-1 ml-1 text-xs"
              style={{ color: 'var(--text-sub)' }}
            >
              프로필 수정
            </button>
          </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {editingId && (() => {
        const student = data.students.find(s => s.id === editingId)!;
        return (
          <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div
              className="w-full rounded-t-3xl p-6 animate-slideup"
              style={{ background: 'var(--surface)', maxHeight: '90vh', overflowY: 'auto' }}
            >
              <div className="w-10 h-1 rounded-full mx-auto mb-6" style={{ background: 'var(--border)' }} />
              <h2 className="font-bold mb-5" style={{ fontSize: 18, color: 'var(--text)' }}>
                프로필 수정
              </h2>

              {/* Photo Upload */}
              <div className="flex flex-col items-center mb-5">
                <div className="relative mb-3">
                  {editPhoto ? (
                    <img
                      src={editPhoto}
                      alt="프로필"
                      style={{ width: 88, height: 88, borderRadius: 24, objectFit: 'cover', border: `3px solid ${student.color}` }}
                    />
                  ) : (
                    <div
                      className="flex items-center justify-center rounded-3xl"
                      style={{ width: 88, height: 88, background: student.color + '18', fontSize: 40, border: `3px solid ${student.color}30` }}
                    >
                      {student.avatar}
                    </div>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center"
                    style={{ width: 28, height: 28, background: student.color, border: '2px solid white' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M7 3v8M3 7h8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl px-4 py-2 font-semibold text-sm"
                    style={{ background: student.color + '15', color: student.color }}
                  >
                    사진 업로드
                  </button>
                  {editPhoto && (
                    <button
                      onClick={removePhoto}
                      className="rounded-xl px-4 py-2 font-semibold text-sm"
                      style={{ background: '#FEE2E2', color: 'var(--error)' }}
                    >
                      사진 삭제
                    </button>
                  )}
                </div>
              </div>

              {/* Name */}
              <label className="block mb-1 text-sm font-medium" style={{ color: 'var(--text-sub)' }}>이름</label>
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full rounded-xl px-4 py-3 mb-4 outline-none font-medium"
                style={{ background: 'var(--bg)', fontSize: 16, color: 'var(--text)', border: '1.5px solid var(--border)' }}
                placeholder="이름 입력"
                maxLength={10}
              />

              {/* Grade */}
              <label className="block mb-2 text-sm font-medium" style={{ color: 'var(--text-sub)' }}>학년</label>
              <div className="space-y-3 mb-6">
                {GRADE_GROUPS.map(group => (
                  <div key={group.label}>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-sub)' }}>{group.label}</p>
                    <div className="flex gap-2 flex-wrap">
                      {group.grades.map(g => (
                        <button
                          key={g}
                          onClick={() => setEditGrade(g)}
                          className="rounded-xl py-2 font-semibold transition-all"
                          style={{
                            width: 52,
                            background: editGrade === g ? student.color : 'var(--bg)',
                            color: editGrade === g ? '#fff' : 'var(--text-sub)',
                            fontSize: 14,
                          }}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setEditingId(null)}
                  className="flex-1 py-4 rounded-2xl font-bold"
                  style={{ background: 'var(--bg)', color: 'var(--text-sub)', fontSize: 16 }}
                >
                  취소
                </button>
                <button
                  onClick={saveEdit}
                  className="flex-1 py-4 rounded-2xl font-bold"
                  style={{ background: student.color, color: '#fff', fontSize: 16 }}
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <HomeContent />
    </AppProvider>
  );
}
