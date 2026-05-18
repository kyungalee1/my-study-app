import type { ExemptDate } from './types';

const EXEMPT_STORAGE_KEY = 'study-app-exempt-dates';

export function loadExemptDatesLocal(): ExemptDate[] {
  try {
    const raw = localStorage.getItem(EXEMPT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ExemptDate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveExemptDatesLocal(dates: ExemptDate[]): void {
  try {
    localStorage.setItem(EXEMPT_STORAGE_KEY, JSON.stringify(dates));
  } catch { /* ignore */ }
}

export function mergeExemptDates(a: ExemptDate[], b: ExemptDate[]): ExemptDate[] {
  const byDate = new Map<string, ExemptDate>();
  for (const d of a) byDate.set(d.date, d);
  for (const d of b) byDate.set(d.date, d);
  return Array.from(byDate.values()).sort((x, y) => x.date.localeCompare(y.date));
}

export function exemptDateSet(dates: ExemptDate[]): Set<string> {
  return new Set(dates.map(d => d.date));
}

export function isDailyHomeworkExempt(date: string, exemptDates: ExemptDate[]): boolean {
  return exemptDateSet(exemptDates).has(date);
}
