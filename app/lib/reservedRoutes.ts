/** [studentId] 동적 라우트가 가로채면 안 되는 경로 (PWA·메타데이터 등) */
export const RESERVED_STUDENT_SLUGS = new Set([
  'icon',
  'apple-icon',
  'icons',
  'manifest',
  'manifest.webmanifest',
  'sw.js',
  'favicon.ico',
  '_next',
]);

export function isReservedStudentSlug(slug: string): boolean {
  return RESERVED_STUDENT_SLUGS.has(slug);
}
