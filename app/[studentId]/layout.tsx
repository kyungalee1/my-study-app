'use client';

import { useParams, usePathname, useRouter } from 'next/navigation';
import { AppProvider, useApp } from '../lib/store';
import type { StudentId } from '../lib/types';

const navItems = [
  { path: '', label: '홈', icon: HomeIcon, rootNav: true },
  { path: '/subjects', label: '과목', icon: SubjectsIcon },
  { path: '/homework', label: '숙제', icon: HomeworkIcon },
  { path: '/stats', label: '통계', icon: StatsIcon },
];

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0}
      />
      <path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SubjectsIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="8" height="8" rx="2"
        fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0}
        stroke="currentColor" strokeWidth="2"/>
      <rect x="13" y="3" width="8" height="8" rx="2"
        fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0}
        stroke="currentColor" strokeWidth="2"/>
      <rect x="3" y="13" width="8" height="8" rx="2"
        fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0}
        stroke="currentColor" strokeWidth="2"/>
      <rect x="13" y="13" width="8" height="8" rx="2"
        fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0}
        stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
}

function HomeworkIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        opacity={active ? 1 : 0.6}/>
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function StatsIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="12" width="4" height="9" rx="1"
        fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.8 : 0}
        stroke="currentColor" strokeWidth="2"/>
      <rect x="10" y="7" width="4" height="14" rx="1"
        fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.8 : 0}
        stroke="currentColor" strokeWidth="2"/>
      <rect x="17" y="3" width="4" height="18" rx="1"
        fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.8 : 0}
        stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
}

function BottomNav({ studentId }: { studentId: StudentId }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useApp();
  const student = data.students.find(s => s.id === studentId);
  const color = student?.color ?? 'var(--primary)';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex">
        {navItems.map(item => {
          const href = item.rootNav ? '/' : `/${studentId}${item.path}`;
          const active = item.rootNav
            ? pathname === `/${studentId}`
            : pathname === `/${studentId}${item.path}`;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => router.push(href)}
              className="flex-1 flex flex-col items-center py-2 gap-0.5 transition-all"
              style={{ color: active ? color : 'var(--text-light)' }}
            >
              <Icon active={active} />
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function StudentLayoutContent({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const studentId = params.studentId as StudentId;
  const { loading } = useApp();

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

  return (
    <div className="min-h-screen pb-safe" style={{ background: 'var(--bg)' }}>
      <main>{children}</main>
      <BottomNav studentId={studentId} />
    </div>
  );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <StudentLayoutContent>{children}</StudentLayoutContent>
    </AppProvider>
  );
}
