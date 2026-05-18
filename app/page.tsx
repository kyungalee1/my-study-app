'use client';

import { useRef, useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from './lib/store';
import { db } from './lib/supabase';
import type { StudentId } from './lib/types';
import { isLaunchDailyCompleteDay, SERVICE_START_DATE } from './lib/serviceConfig';
import { isDailyHomeworkExempt } from './lib/exemptDates';
import { calcPoints } from './lib/pointsCalc';
import type { ExemptDate } from './lib/types';
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

const PARENT_PASSWORD = '2925';

function toLocalStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayStr(): string {
  return toLocalStr(new Date());
}

/** ISO 문자열(UTC 포함)을 KST 로컬 날짜 YYYY-MM-DD로 변환 */
function localDateOf(isoStr: string): string {
  return toLocalStr(new Date(isoStr));
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

// ── 화이트보드 타입 & 유틸 ──────────────────────────────────
interface WbMessage { id: string; author: string; text: string; ts: number; }
interface WbData { notice: string; replies: WbMessage[]; }
interface WbRow { id: string; type: string; author: string | null; content: string; created_at: string; }

// 날짜별로 다른 localStorage 키 사용
function wbLocalKey(date: string) { return `whiteboard-v2__${date}`; }

function loadWbLocal(date: string): WbData {
  try {
    const s = localStorage.getItem(wbLocalKey(date));
    return s ? JSON.parse(s) : { notice: '', replies: [] };
  } catch { return { notice: '', replies: [] }; }
}

function saveWbLocal(wb: WbData, date: string) {
  try { localStorage.setItem(wbLocalKey(date), JSON.stringify(wb)); } catch {}
}

async function loadWbFromDb(targetDate: string): Promise<WbData> {
  if (!db) return loadWbLocal(targetDate);
  try {
    const { data, error } = await db.from('whiteboard').select('*').order('created_at', { ascending: true });
    if (error || !data) return loadWbLocal(targetDate);
    const rows = data as WbRow[];
    // 공지: created_at 날짜 기준 조회 (댓글과 동일한 방식)
    // 구형 id='notice' 와 신형 id='notice__YYYY-MM-DD' 모두 지원
    const noticeRow = rows.find(r =>
      r.type === 'notice' && toLocalStr(new Date(r.created_at)) === targetDate
    );
    // 답변: created_at 날짜(로컬 기준)가 targetDate인 것만
    const replyRows = rows.filter(r => r.type === 'reply' && toLocalStr(new Date(r.created_at)) === targetDate);
    const wb: WbData = {
      notice: noticeRow?.content ?? '',
      replies: replyRows.map(r => ({
        id: r.id,
        author: r.author ?? '',
        text: r.content,
        ts: new Date(r.created_at).getTime(),
      })),
    };
    saveWbLocal(wb, targetDate);
    return wb;
  } catch { return loadWbLocal(targetDate); }
}

async function saveNoticeToDb(notice: string, date: string): Promise<void> {
  if (!db) return;
  // id에 날짜를 포함시켜 날짜별 공지가 독립적으로 저장됨
  const { error } = await db.from('whiteboard').upsert({
    id: `notice__${date}`,
    type: 'notice',
    author: null,
    content: notice,
    created_at: new Date().toISOString(),
  });
  if (error) console.error('saveNoticeToDb:', error);
}

async function addReplyToDb(msg: WbMessage): Promise<void> {
  if (!db) return;
  const { error } = await db.from('whiteboard').insert({
    id: msg.id,
    type: 'reply',
    author: msg.author,
    content: msg.text,
    created_at: new Date(msg.ts).toISOString(),
  });
  if (error) console.error('addReplyToDb:', error);
}

async function deleteReplyFromDb(id: string): Promise<void> {
  if (!db) return;
  await db.from('whiteboard').delete().eq('id', id);
}

function HomeContent() {
  const { data, updateStudent, loading, addExemptDate, removeExemptDate } = useApp();
  const homework = data.homework;
  const homeworkHistory = data.homeworkHistory ?? [];
  const exemptDates = data.exemptDates ?? [];
  const router = useRouter();

  const [editingId, setEditingId] = useState<StudentId | null>(null);
  const [editName, setEditName] = useState('');
  const [editGrade, setEditGrade] = useState('');
  const [editPhoto, setEditPhoto] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const todayStr = getTodayStr();
  const searchParams = useSearchParams();
  const initialDate = (() => {
    const p = searchParams.get('date');
    if (p && p >= SERVICE_START_DATE && p <= todayStr) return p;
    return todayStr;
  })();
  const [viewDate, setViewDate] = useState(initialDate);

  // 화이트보드
  const [wb, setWb] = useState<WbData>({ notice: '', replies: [] });
  const [wbEdit, setWbEdit] = useState(false);
  const [wbDraft, setWbDraft] = useState('');
  const [exemptOpen, setExemptOpen] = useState(false);
  const [exemptUnlocked, setExemptUnlocked] = useState(false);
  const [exemptPw, setExemptPw] = useState('');
  const [exemptLabelDraft, setExemptLabelDraft] = useState('여행');
  const viewExempt = isDailyHomeworkExempt(viewDate, exemptDates);

  const EXEMPT_UI_KEY = 'study-app-exempt-ui';
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(EXEMPT_UI_KEY);
      if (!raw) return;
      const { open, unlocked } = JSON.parse(raw) as { open?: boolean; unlocked?: boolean };
      if (open) setExemptOpen(true);
      if (unlocked) setExemptUnlocked(true);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        EXEMPT_UI_KEY,
        JSON.stringify({ open: exemptOpen, unlocked: exemptUnlocked }),
      );
    } catch { /* ignore */ }
  }, [exemptOpen, exemptUnlocked]);

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyAuthor, setReplyAuthor] = useState('');
  const [replyText, setReplyText] = useState('');

  // viewDate가 바뀔 때마다 해당 날짜의 공지/답변을 로드
  useEffect(() => {
    loadWbFromDb(viewDate).then(setWb);
    setWbEdit(false);
    const timer = setInterval(() => {
      loadWbFromDb(viewDate).then(setWb);
    }, 30_000);
    return () => clearInterval(timer);
  }, [viewDate]);

  function prevDay() {
    const d = new Date(viewDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    const prev = toLocalStr(d);
    // 이번 달 1일 이전으로는 이동 불가
    if (prev >= SERVICE_START_DATE) setViewDate(prev);
  }

  function nextDay() {
    if (viewDate >= todayStr) return;
    const d = new Date(viewDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    setViewDate(toLocalStr(d));
  }

  function formatViewDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${dayNames[d.getDay()]})`;
  }

  const isToday = viewDate === todayStr;


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
    router.push(`/${id}?date=${viewDate}`);
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="px-5 pt-14 pb-4" style={{ background: 'var(--surface)' }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-sub)', letterSpacing: '0.01em' }}>
          연호랑 세연이 기록장
        </p>

        {/* 날짜 네비게이터 */}
        <div className="flex items-center justify-between mt-3">
          <button
            onClick={prevDay}
            className="flex items-center justify-center rounded-full transition-opacity active:opacity-50"
            style={{ width: 36, height: 36, color: 'var(--text-sub)' }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 5L8 10l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <div className="flex flex-col items-center gap-1">
            <span className="font-bold" style={{ fontSize: 22, color: 'var(--text)', letterSpacing: '-0.02em' }}>
              {formatViewDate(viewDate)}
            </span>
            {isToday ? (
              <span
                className="rounded-full px-2.5 py-0.5 font-semibold"
                style={{ fontSize: 11, background: 'var(--primary-light)', color: 'var(--primary)' }}
              >
                오늘
              </span>
            ) : (
              <button
                onClick={() => setViewDate(todayStr)}
                style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}
              >
                오늘로 ↩
              </button>
            )}
            {viewExempt && (
              <span
                className="rounded-full px-2.5 py-0.5 font-semibold"
                style={{ fontSize: 11, background: '#E0F2FE', color: '#0369A1' }}
              >
                🏖️ 매일 숙제 면제
              </span>
            )}
          </div>

          <button
            onClick={nextDay}
            disabled={isToday}
            className="flex items-center justify-center rounded-full transition-opacity active:opacity-50"
            style={{ width: 36, height: 36, color: isToday ? 'var(--border)' : 'var(--text-sub)' }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <button
          onClick={() => setExemptOpen(v => !v)}
          className="mt-3 w-full rounded-xl py-2 font-semibold"
          style={{ fontSize: 12, background: 'var(--bg)', color: 'var(--text-sub)' }}
        >
          {exemptOpen ? '▲ 면제일 관리 닫기' : '🏖️ 매일 숙제 면제일 관리'}
        </button>

        {exemptOpen && (
          <div
            className="mt-2 rounded-2xl p-3"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
          >
            {!exemptUnlocked ? (
              <div className="flex gap-2">
                <input
                  type="password"
                  value={exemptPw}
                  onChange={e => setExemptPw(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && exemptPw === PARENT_PASSWORD) setExemptUnlocked(true);
                  }}
                  placeholder="비밀번호"
                  className="flex-1 rounded-xl px-3 py-2 outline-none"
                  style={{ fontSize: 13, background: 'var(--surface)', border: '1px solid var(--border)' }}
                />
                <button
                  onClick={() => { if (exemptPw === PARENT_PASSWORD) setExemptUnlocked(true); }}
                  className="rounded-xl px-3 py-2 font-bold"
                  style={{ fontSize: 12, background: 'var(--primary)', color: '#fff' }}
                >
                  확인
                </button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 8, lineHeight: 1.5 }}>
                  여행·소풍 등 매일 숙제를 하지 않는 날입니다. -500원·+500원 모두 적용되지 않아요.
                </p>
                <div className="flex gap-2 mb-2">
                  <input
                    value={exemptLabelDraft}
                    onChange={e => setExemptLabelDraft(e.target.value)}
                    placeholder="사유 (여행, 소풍…)"
                    className="flex-1 rounded-xl px-3 py-2 outline-none"
                    style={{ fontSize: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}
                  />
                  <button
                    onClick={() => {
                      if (viewExempt) removeExemptDate(viewDate);
                      else addExemptDate({ date: viewDate, label: exemptLabelDraft.trim() || '면제' });
                    }}
                    className="rounded-xl px-3 py-2 font-bold whitespace-nowrap"
                    style={{
                      fontSize: 12,
                      background: viewExempt ? 'var(--error)' : '#0369A1',
                      color: '#fff',
                    }}
                  >
                    {formatViewDate(viewDate)} {viewExempt ? '해제' : '면제'}
                  </button>
                </div>
                {exemptDates.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-sub)' }}>등록된 면제일이 없어요</p>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {exemptDates.map(e => (
                      <div
                        key={e.date}
                        className="flex items-center justify-between rounded-xl px-3 py-2"
                        style={{ background: 'var(--surface)' }}
                      >
                        <span style={{ fontSize: 12, color: 'var(--text)' }}>
                          {e.date.slice(5).replace('-', '/')} · {e.label}
                        </span>
                        <button
                          onClick={() => removeExemptDate(e.date)}
                          style={{ fontSize: 11, color: 'var(--text-sub)' }}
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* 화이트보드 */}
      <div className="px-4 pt-4 pb-0">
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)', border: '1.5px solid var(--border)' }}>
          {/* 상단 바 */}
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)', background: '#FFFBEB' }}>
            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: 14 }}>📌</span>
              <span className="font-bold" style={{ fontSize: 12, color: '#92400E' }}>우리가족 공지사항</span>
              {!isToday && (
                <span className="rounded-full px-1.5 py-0.5 font-semibold" style={{ fontSize: 9, background: '#FEF3C7', color: '#D97706' }}>과거 기록</span>
              )}
            </div>
            {/* 오늘만 작성/수정 가능 */}
            {isToday && (
              <button
                onClick={() => { setWbDraft(wb.notice); setWbEdit(true); }}
                style={{ fontSize: 11, color: '#D97706', fontWeight: 600 }}
              >
                {wb.notice ? '수정' : '작성'}
              </button>
            )}
          </div>

          {/* 공지 내용 */}
          {wbEdit && isToday ? (
            <div className="px-4 py-3">
              <textarea
                value={wbDraft}
                onChange={e => setWbDraft(e.target.value)}
                placeholder="아이들에게 전할 말을 적어봐요 ✏️"
                className="w-full outline-none resize-none"
                style={{ fontSize: 13, color: 'var(--text)', background: 'transparent', lineHeight: 1.6, minHeight: 56 }}
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setWbEdit(false)}
                  className="rounded-xl px-3 py-1.5 font-semibold"
                  style={{ fontSize: 12, background: 'var(--bg)', color: 'var(--text-sub)' }}
                >취소</button>
                <button
                  onClick={async () => {
                    const trimmed = wbDraft.trim();
                    const next = { ...wb, notice: trimmed };
                    setWb(next);
                    saveWbLocal(next, viewDate);
                    setWbEdit(false);
                    await saveNoticeToDb(trimmed, viewDate);
                  }}
                  className="rounded-xl px-3 py-1.5 font-semibold"
                  style={{ fontSize: 12, background: '#F59E0B', color: '#fff' }}
                >저장</button>
              </div>
            </div>
          ) : (
            <div className="px-4 py-3">
              {wb.notice ? (
                <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{wb.notice}</p>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--text-sub)' }}>
                  {isToday ? '아직 공지가 없어요' : '이 날 공지가 없어요'}
                </p>
              )}
            </div>
          )}

          {/* 답변 목록 */}
          {wb.replies.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)' }}>
              {wb.replies.map(r => (
                <div key={r.id} className="flex items-start gap-2 px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', flexShrink: 0, marginTop: 1 }}>{r.author}</span>
                  <p style={{ fontSize: 12, color: 'var(--text)', flex: 1, lineHeight: 1.5 }}>{r.text}</p>
                  {/* 오늘만 삭제 가능 */}
                  {isToday && (
                    <button
                      onClick={async () => {
                        const next = { ...wb, replies: wb.replies.filter(x => x.id !== r.id) };
                        setWb(next);
                        saveWbLocal(next, viewDate);
                        await deleteReplyFromDb(r.id);
                      }}
                      style={{ fontSize: 16, color: 'var(--text-sub)', flexShrink: 0, lineHeight: 1 }}
                    >×</button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 답변 달기 — 오늘만 표시 */}
          {isToday && (
            replyOpen ? (
              <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="flex flex-wrap gap-2 mb-2">
                  {[
                    ...data.students.map(s => ({ name: s.name, color: s.color })),
                    { name: '엄마', color: '#F472B6' },
                    { name: '아빠', color: '#60A5FA' },
                  ].map(({ name, color }) => (
                    <button
                      key={name}
                      onClick={() => setReplyAuthor(name)}
                      className="rounded-full px-3 py-1 font-semibold"
                      style={{
                        fontSize: 11,
                        background: replyAuthor === name ? color : 'var(--bg)',
                        color: replyAuthor === name ? '#fff' : 'var(--text-sub)',
                        border: `1.5px solid ${replyAuthor === name ? color : 'var(--border)'}`,
                      }}
                    >{name}</button>
                  ))}
                </div>
                <input
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="답변을 입력해요"
                  className="w-full outline-none rounded-xl px-3 py-2"
                  style={{ fontSize: 12, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => { setReplyOpen(false); setReplyText(''); setReplyAuthor(''); }}
                    className="rounded-xl px-3 py-1.5 font-semibold"
                    style={{ fontSize: 12, background: 'var(--bg)', color: 'var(--text-sub)' }}
                  >취소</button>
                  <button
                    onClick={async () => {
                      if (!replyText.trim() || !replyAuthor) return;
                      const msg: WbMessage = { id: Date.now().toString(), author: replyAuthor, text: replyText.trim(), ts: Date.now() };
                      const next = { ...wb, replies: [...wb.replies, msg] };
                      setWb(next);
                      saveWbLocal(next, viewDate);
                      setReplyOpen(false); setReplyText(''); setReplyAuthor('');
                      await addReplyToDb(msg);
                    }}
                    className="rounded-xl px-3 py-1.5 font-semibold"
                    style={{ fontSize: 12, background: 'var(--primary)', color: '#fff' }}
                  >남기기</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setReplyOpen(true)}
                className="w-full py-2.5 text-center"
                style={{ fontSize: 12, color: 'var(--text-sub)', borderTop: '1px solid var(--border)' }}
              >
                💬 답변 남기기
              </button>
            )
          )}
        </div>
      </div>

      {/* Student Cards */}
      <div className="px-4 py-4 space-y-3">
        {data.students.map((student, i) => {
          const pts = calcPoints(student.id, homework, homeworkHistory, exemptDates, data.students, viewDate, todayStr);
          const totalColor = pts.monthlyTotal > 0 ? 'var(--success)' : pts.monthlyTotal < 0 ? 'var(--error)' : 'var(--text-sub)';
          const dailyLaunch = isLaunchDailyCompleteDay(student.id, viewDate);
          const dailyExempt = !dailyLaunch && isDailyHomeworkExempt(viewDate, exemptDates);
          const dailyColor = dailyExempt ? '#0369A1' : pts.todayDaily > 0 ? 'var(--success)' : 'var(--text-sub)';
          const onedayColor = pts.todayOneday > 0 ? 'var(--success)' : 'var(--text-sub)';

          return (
          <div
            key={student.id}
            className="animate-slideup"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <button
              onClick={() => goToStudent(student.id)}
              className="w-full text-left rounded-2xl p-5 transition-all active:scale-[0.99]"
              style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}
            >
              {/* 학생 정보 + 이달 합계 */}
              <div className="flex items-center gap-3 mb-4">
                <AvatarDisplay photo={student.photo} avatar={student.avatar} color={student.color} size={48} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold" style={{ fontSize: 18, color: 'var(--text)' }}>
                      {student.name}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 font-semibold"
                      style={{ fontSize: 11, background: student.color + '18', color: student.color }}
                    >
                      {student.grade}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>숙제 현황 보기</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold" style={{ fontSize: 22, color: totalColor, letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {formatPoints(pts.monthlyTotal)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 3 }}>이달 합계</div>
                </div>
              </div>

              {/* 구분선 */}
              <div style={{ height: 1, background: 'var(--border)', marginBottom: 14 }} />

              {/* 포인트 내역 */}
              <div className="flex justify-between">
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 3 }}>
                    📅 매일 숙제
                  </div>
                  <div className="font-bold" style={{ fontSize: 16, color: dailyColor }}>
                    {dailyExempt ? '면제' : formatPointsShort(pts.todayDaily)}
                  </div>
                </div>
                <div style={{ width: 1, background: 'var(--border)' }} />
                <div className="text-right">
                  <div style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 3 }}>
                    ✨ 오늘만 숙제
                  </div>
                  <div className="font-bold" style={{ fontSize: 16, color: onedayColor }}>
                    {formatPointsShort(pts.todayOneday)}
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => startEdit(student.id)}
              className="mt-1 ml-1"
              style={{ fontSize: 12, color: 'var(--text-sub)' }}
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
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
