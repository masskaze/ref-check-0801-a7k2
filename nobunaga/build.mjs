/* =========================================================================
 *  戦国風雲録  —  単一HTMLへの結合
 *    node nobunaga/build.mjs
 *      dist/sengoku-fuunroku.html   … そのまま開ける完全な1ファイル
 *      dist/artifact.html           … <body> の中身だけ（Artifact 公開用）
 * ========================================================================= */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(root, f), 'utf8');
const html = read('index.html');

const FONTS = html.match(/<link rel="preconnect"[\s\S]*?display=swap">/)[0];
const css = read('css/style.css');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const body = html
  .slice(html.indexOf('<div id="app">'), html.indexOf('<script src='))
  .trimEnd();

const guard = s => s.replace(/<\/script>/gi, '<\\/script>');
const code = scripts.map(f => '/* ==== ' + f + ' ==== */\n' + guard(read(f))).join('\n');
const stamp = new Date().toISOString().slice(0, 10);

const inner = `<title>戦国風雲録</title>
${FONTS}
<style>
${css}</style>
${body}
<script>
${code}
</script>
`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/artifact.html'), inner);
writeFileSync(join(root, 'dist/sengoku-fuunroku.html'),
  `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<!-- 戦国風雲録 — nobunaga/build.mjs が生成（${stamp}）。編集は nobunaga/js, nobunaga/css へ -->
${inner}</body>
</html>
`);
const size = f => (readFileSync(join(root, f)).length / 1024).toFixed(0) + 'KB';
console.log('dist/sengoku-fuunroku.html', size('dist/sengoku-fuunroku.html'));
console.log('dist/artifact.html       ', size('dist/artifact.html'));
console.log('inlined scripts:', scripts.length);
