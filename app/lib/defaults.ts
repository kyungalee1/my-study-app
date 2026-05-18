import type { AppData } from './types';

export const defaultData: AppData = {
  students: [
    { id: 'student1', name: '첫째', grade: '중1', avatar: '🦁', color: '#3182F6' },
    { id: 'student2', name: '둘째', grade: '중1', avatar: '🐯', color: '#00B493' },
  ],
  subjects: [
    { id: 's1-math', studentId: 'student1', name: '수학', color: '#3182F6', weeklyTargetMinutes: 300 },
    { id: 's1-eng', studentId: 'student1', name: '영어', color: '#FF6B35', weeklyTargetMinutes: 240 },
    { id: 's1-kor', studentId: 'student1', name: '국어', color: '#00B493', weeklyTargetMinutes: 180 },
    { id: 's1-sci', studentId: 'student1', name: '과학', color: '#9B59B6', weeklyTargetMinutes: 180 },
    { id: 's2-math', studentId: 'student2', name: '수학', color: '#3182F6', weeklyTargetMinutes: 300 },
    { id: 's2-eng', studentId: 'student2', name: '영어', color: '#FF6B35', weeklyTargetMinutes: 240 },
    { id: 's2-sci', studentId: 'student2', name: '과학', color: '#9B59B6', weeklyTargetMinutes: 180 },
    { id: 's2-soc', studentId: 'student2', name: '사회', color: '#E67E22', weeklyTargetMinutes: 150 },
  ],
  sessions: [],
  homework: [],
  homeworkHistory: [],
  exemptDates: [],
};
