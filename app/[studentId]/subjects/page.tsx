'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApp } from '../../lib/store';
import type { StudentId, Subject } from '../../lib/types';

const SUBJECT_COLORS = [
  '#3182F6', '#00B493', '#FF6B35', '#9B59B6',
  '#E67E22', '#E74C3C', '#1ABC9C', '#F39C12',
  '#2ECC71', '#3498DB',
];

type FormState = {
  name: string;
  color: string;
};

const emptyForm: FormState = { name: '', color: SUBJECT_COLORS[0] };

export default function SubjectsPage() {
  const params = useParams();
  const studentId = params.studentId as StudentId;
  const router = useRouter();
  const { data, getStudentSubjects, addSubject, updateSubject, deleteSubject } = useApp();

  const student = data.students.find(s => s.id === studentId);
  const subjects = getStudentSubjects(studentId);

  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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
        <div className="flex items-center gap-2 mb-1">
          <span style={{ fontSize: 20 }}>{student?.avatar}</span>
          <h1 className="font-bold" style={{ fontSize: 22, color: 'var(--text)' }}>과목 관리</h1>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-sub)' }}>과목을 추가하고 숙제 현황을 확인하세요</p>
      </div>

      {/* Subject List */}
      <div className="px-4 py-5 space-y-3">
        {subjects.length === 0 && (
          <div className="rounded-2xl p-8 flex flex-col items-center" style={{ background: 'var(--surface)' }}>
            <span style={{ fontSize: 48, marginBottom: 12 }}>📚</span>
            <p className="font-bold mb-1" style={{ fontSize: 16, color: 'var(--text)' }}>아직 과목이 없어요</p>
            <p style={{ fontSize: 14, color: 'var(--text-sub)' }}>아래 버튼으로 과목을 추가해보세요</p>
          </div>
        )}

        {subjects.map((subj, i) => (
          <div
            key={subj.id}
            className="rounded-2xl p-4 animate-fadein"
            style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)', animationDelay: `${i * 0.05}s` }}
          >
            <div className="flex items-center gap-3">
              {/* 색상 인디케이터 */}
              <div
                className="rounded-xl flex-shrink-0"
                style={{ width: 10, height: 40, background: subj.color, borderRadius: 6 }}
              />
              <div className="flex-1 min-w-0">
                <span className="font-bold" style={{ fontSize: 16, color: 'var(--text)' }}>{subj.name}</span>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => openEdit(subj)}
                  className="rounded-xl px-3 py-2 text-sm font-medium"
                  style={{ background: 'var(--bg)', color: 'var(--text-sub)' }}
                >
                  수정
                </button>
                <button
                  onClick={() => setConfirmDelete(subj.id)}
                  className="rounded-xl px-3 py-2 text-sm font-medium"
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
          className="w-full rounded-2xl p-4 flex items-center justify-center gap-2 font-bold transition-all"
          style={{ background: 'var(--primary-light)', color: 'var(--primary)', fontSize: 15, border: '2px dashed var(--primary)' }}
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
