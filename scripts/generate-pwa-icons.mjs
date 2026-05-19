/**
 * PWA 아이콘 PNG 일괄 생성
 * 원본 우선순위: icon-source.png > icon.svg
 * 실행: npm run icons  (Vercel build 시 자동)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const DEFAULT_OWL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#3182F6"/><ellipse cx="256" cy="268" rx="150" ry="160" fill="#F5E6D3"/><circle cx="256" cy="248" r="118" fill="#FFF8F0"/><ellipse cx="180" cy="210" rx="52" ry="58" fill="#E8C9A8"/><ellipse cx="332" cy="210" rx="52" ry="58" fill="#E8C9A8"/><circle cx="200" cy="235" r="28" fill="#2D3748"/><circle cx="312" cy="235" r="28" fill="#2D3748"/><circle cx="208" cy="228" r="10" fill="#FFF"/><circle cx="320" cy="228" r="10" fill="#FFF"/><polygon points="256,120 220,175 292,175" fill="#4A5568"/><rect x="238" y="165" width="36" height="12" rx="4" fill="#FFD93D"/></svg>`;

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'public', 'icons');
const svgPath = join(outDir, 'icon.svg');
const bundledSvg = join(__dirname, 'owl-icon.svg');

const CANDIDATES = [
  join(outDir, 'icon-source.png'),
  join(outDir, 'icon-source.jpg'),
  join(outDir, 'icon-source.webp'),
  svgPath,
  bundledSvg,
];

mkdirSync(outDir, { recursive: true });

if (!existsSync(svgPath)) {
  const svgContent = existsSync(bundledSvg)
    ? readFileSync(bundledSvg, 'utf8')
    : DEFAULT_OWL_SVG;
  writeFileSync(svgPath, svgContent, 'utf8');
  console.log('✓ public/icons/icon.svg 준비');
}

const sourcePath = CANDIDATES.find(p => existsSync(p));
if (!sourcePath) {
  console.error('아이콘 원본을 찾을 수 없습니다.');
  process.exit(1);
}

const SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512];
const THEME = '#3182F6';

console.log(`원본: ${sourcePath}\n`);

for (const size of SIZES) {
  const name = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`;
  await sharp(sourcePath).resize(size, size, { fit: 'cover' }).png().toFile(join(outDir, name));
  console.log(`✓ ${name}`);
}

// maskable 아이콘은 Android에서 깨져 검은 삼각형으로 보일 수 있어 생성하지 않음.
// PWA 아이콘은 app/icon.tsx, app/apple-icon.tsx (배포 시 자동 생성) 사용.
console.log('\n완료: public/icons/ (레거시 PNG)');
console.log('PWA 설치 아이콘: /icon, /apple-icon (Next.js 자동 생성)');
