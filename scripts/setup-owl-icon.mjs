/**
 * Cursor에서 생성한 부엉이 icon-source.png → public/icons 복사 후 PWA PNG 생성
 * 실행: npm run setup-icon
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'public', 'icons');
const dest = join(outDir, 'icon-source.png');

/** Cursor가 이미지를 저장한 경로 (대화에서 생성된 부엉이) */
const CURSOR_OWL = join(
  process.env.USERPROFILE ?? '',
  '.cursor',
  'projects',
  'C-Users-10124-AppData-Local-Temp-2c3a5e9f-fcda-4336-b607-b1c9c1ed82c7',
  'assets',
  'icon-source.png',
);

mkdirSync(outDir, { recursive: true });

if (existsSync(dest)) {
  console.log('이미 icon-source.png 가 있습니다. 그대로 PNG를 다시 생성합니다.\n');
} else if (existsSync(CURSOR_OWL)) {
  copyFileSync(CURSOR_OWL, dest);
  console.log('✓ 부엉이 원본을 public/icons/icon-source.png 로 복사했습니다.\n');
} else {
  console.error(`
❌ 부엉이 원본을 찾지 못했습니다.

다음 중 하나를 해 주세요:
  1) npm run setup-icon 을 Cursor 채팅에서 이미지를 만든 직후에 실행
  2) 채팅에 보이는 부엉이 이미지를 저장해 다음 경로에 넣기:
     public/icons/icon-source.png
  3) 그다음: npm run icons
`);
  process.exit(1);
}

const gen = spawnSync(process.execPath, ['scripts/generate-pwa-icons.mjs'], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(gen.status ?? 1);
