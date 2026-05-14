'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApp } from '../../lib/store';
import type { StudentId, Subject } from '../../lib/types';

const SUBJECT_COLORS = [
  '#3182F6', '#00B493', '#FF6B35', '#9B59B6',
  '#E67E22', '#E74C3C', '#1ABC9C', '#F39C12',
  '#2ECC71', '#3498DB',
];

const PASSWORD = '2925';

type FormState = {
  name: string;
  color: string;
};

const emptyForm: FormState = { name: '', color: SUBJECT_COLORS[0] };

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function handleSubmit() {
    if (input === PASSWORD) {
      onUnlock();
    } else {
      setError(true);
      setShake(true);
      setInput('');
      setTimeout(() => setShake(false), 500);
    }
  }

  return (
    <div className="flex items-center justify-center px-5" style={{ height: '100dvh', background: 'var(--bg)' }}>
      <div
        className="w-full rounded-3xl flex flex-col items-center"
        style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)', maxWidth: 360, padding: '28px 24px' }}
      >
        <div
          className="rounded-2xl flex items-center justify-center mb-4"
          style={{ width: 52, height: 52, background: 'var(--primary-light)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="11" width="18" height="11" rx="2" stroke="var(--primary)" strokeWidth="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <h2 className="font-bold mb-1" style={{ fontSize: 18, color: 'var(--text)' }}>과목 관리</h2>
        <p className="mb-5 text-center" style={{ fontSize: 13, color: 'var(--text-sub)' }}>비밀번호를 입력해주세요</p>

        <div
          className="w-full rounded-2xl px-4 flex items-center mb-2"
          style={{
            border: `1.5px solid ${error ? 'var(--error)' : 'var(--border)'}`,
            background: 'var(--bg)',
            animation: shake ? 'shake 0.4s ease' : undefined,
          }}
        >
          <input
            ref={inputRef}
            type="password"
            value={input}
            onChange={e => { setInput(e.target.value); setError(false); }}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            className="flex-1 py-3 outline-none font-bold text-center tracking-widest"
            style={{ background: 'transparent', fontSize: 20, color: 'var(--text)', letterSpacing: 10 }}
            placeholder="••••"
            maxLength={10}
          />
        </div>

        {error && (
          <p className="mb-2 font-semibold" style={{ fontSize: 12, color: 'var(--error)' }}>
            비밀번호가 틀렸습니다
          </p>
        )}

        <button
          onClick={handleSubmit}
          className="w-full py-3.5 rounded-2xl font-bold mt-1"
          style={{ background: 'var(--primary)', color: '#fff', fontSize: 15 }}
        >
          확인
        </button>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}

export default function SubjectsPage() {
  const params = useParams();
  const studentId = params.studentId as StudentId;
  const router = useRouter();
  const { data, getStudentSubjects, addSubject, updateSubject, deleteSubject } = useApp();

  const student = data.students.find(s => s.id === studentId);
  const subjects = getStudentSubjects(studentId);

  const [unlocked, setUnlocked] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;

  function openAdd() { setForm(emptyForm); setEditId(null); setShowAdd(true); }

  function openEdit(subj: Subject) {
    setForm({ name: subj.name, color: subj.color });
    setEditId(subj.id);
    setShowAdd(true);
  }

  function saveForm() {
    if (!form.name.trim()) return;
    if (editId) {
      updateSubject(editId, { name: form.name.trim(), color: form.color });
    } else {
      const newSubj: Subject = {
        id: `${studentId}-${Date.now()}`,
        studentId,
        name: form.name.trim(),
        color: form.color,
        weeklyTargetMinutes: 0,
      };
      addSubject(newSubj);
    }
    setShowAdd(false);
    setEditId(null);
  }

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: 'var(--bg)' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-14 pb-4" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}>
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center rounded-full mb-3 active:opacity-50 transition-opacity"
          style={{ width: 36, height: 36, background: 'var(--bg)', color: 'var(--text-sub)' }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 5L8 10l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="flex items-center gap-2 mb-0.5">
          <span style={{ fontSize: 20 }}>{student?.avatar}</span>
          <h1 className="font-bold" style={{ fontSize: 20, color: 'var(--text)' }}>과목 관리</h1>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-sub)' }}>과목을 추가하고 숙제 현황을 확인하세요</p>
      </div>

      {/* Subject List — 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
        {subjects.length === 0 && (
          <div className="rounded-2xl p-6 flex flex-col items-center" style={{ background: 'var(--surface)' }}>
            <span style={{ fontSize: 40, marginBottom: 8 }}>📚</span>
            <p className="font-bold mb-1" style={{ fontSize: 15, color: 'var(--text)' }}>아직 과목이 없어요</p>
            <p style={{ fontSize: 13, color: 'var(--text-sub)' }}>아래 버튼으로 과목을 추가해보세요</p>
          </div>
        )}

        {subjects.map((subj, i) => (
          <div
            key={subj.id}
            className="rounded-2xl px-4 py-3 animate-fadein"
            style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)', animationDelay: `${i * 0.05}s` }}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-full flex-shrink-0" style={{ width: 8, height: 36, background: subj.color, borderRadius: 4 }} />
              <div className="flex-1 min-w-0">
                <span className="font-bold" style={{ fontSize: 15, color: 'var(--text)' }}>{subj.name}</span>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => openEdit(subj)}
                  className="rounded-xl px-3 py-1.5 text-sm font-medium"
                  style={{ background: 'var(--bg)', color: 'var(--text-sub)' }}
                >
                  수정
                </button>
                <button
                  onClick={() => setConfirmDelete(subj.id)}
                  className="rounded-xl px-3 py-1.5 text-sm font-medium"
                  style={{ background: '#FEE2E2', color: 'var(--error)' }}
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Add Button */}
        <button
          onClick={openAdd}
          className="w-full rounded-2xl py-3 flex items-center justify-center gap-2 font-bold transition-all"
          style={{ background: 'var(--primary-light)', color: 'var(--primary)', fontSize: 14, border: '2px dashed var(--primary)' }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          과목 추가
        </button>
      </div>

      {/* Add/Edit Sheet */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full rounded-t-3xl p-6 animate-slideup" style={{ background: 'var(--surface)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--border)' }} />
            <h2 className="font-bold mb-5" style={{ fontSize: 18, color: 'var(--text)' }}>
              {editId ? '과목 수정' : '과목 추가'}
            </h2>

            {/* Name */}
            <label className="block mb-1 text-sm font-semibold" style={{ color: 'var(--text-sub)' }}>과목명</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full rounded-xl px-4 py-3 mb-5 outline-none font-medium"
              style={{ background: 'var(--bg)', fontSize: 16, color: 'var(--text)', border: '1.5px solid var(--border)' }}
              placeholder="예: 수학, 영어, 과학..."
              maxLength={20}
              autoFocus
            />

            {/* Color */}
            <label className="block mb-2 text-sm font-semibold" style={{ color: 'var(--text-sub)' }}>색상</label>
            <div className="flex flex-wrap gap-2 mb-6">
              {SUBJECT_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setForm(f => ({ ...f, color }))}
                  className="rounded-full transition-all"
                  style={{
                    width: 36, height: 36,
                    background: color,
                    outline: form.color === color ? `3px solid ${color}` : '3px solid transparent',
                    outlineOffset: 2,
                    transform: form.color === color ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowAdd(false); setEditId(null); }}
                className="flex-1 py-4 rounded-2xl font-bold"
                style={{ background: 'var(--bg)', color: 'var(--text-sub)', fontSize: 16 }}
              >
                취소
              </button>
              <button
                onClick={saveForm}
                className="flex-1 py-4 rounded-2xl font-bold"
                style={{ background: form.name.trim() ? form.color : 'var(--border)', color: '#fff', fontSize: 16 }}
                disabled={!form.name.trim()}
              >
                {editId ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full rounded-3xl p-6 animate-scalein" style={{ background: 'var(--surface)', maxWidth: 340 }}>
            <h2 className="font-bold text-center mb-2" style={{ fontSize: 18, color: 'var(--text)' }}>과목 삭제</h2>
            <p className="text-center mb-6" style={{ fontSize: 14, color: 'var(--text-sub)' }}>
              이 과목을 삭제할까요? 관련 숙제 기록은 유지됩니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-3.5 rounded-2xl font-bold"
                style={{ background: 'var(--bg)', color: 'var(--text-sub)', fontSize: 15 }}
              >
                취소
              </button>
              <button
                onClick={() => { deleteSubject(confirmDelete); setConfirmDelete(null); }}
                className="flex-1 py-3.5 rounded-2xl font-bold"
                style={{ background: 'var(--error)', color: '#fff', fontSize: 15 }}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
