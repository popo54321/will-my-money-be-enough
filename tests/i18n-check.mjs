// Checks the three language files: same keys everywhere, same {placeholders} for each key,
// and every key the page uses exists. Run with: npm run check
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('..', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');
const ctx = { window: {} };
ctx.window.MMA = { i18n: {} };
ctx.MMA = ctx.window.MMA;
vm.createContext(ctx);
for (const lang of ['en', 'th', 'zh']) vm.runInContext(read(`js/i18n/${lang}.js`), ctx);
const dicts = ctx.MMA.i18n;
const langs = Object.keys(dicts);
let problems = 0;
const fail = msg => { problems++; console.error('✗ ' + msg); };

const all = new Set(langs.flatMap(l => Object.keys(dicts[l])));
for (const key of all) {
  for (const l of langs) if (!(key in dicts[l])) fail(`"${key}" is missing in ${l}.js`);
  const ph = l => [...String(dicts[l][key] ?? '').matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
  const base = ph('en');
  for (const l of langs) if (key in dicts[l] && ph(l) !== base) fail(`"${key}" uses {${ph(l)}} in ${l}.js but {${base}} in en.js`);
}

// forever mode: any text that names the live-to age {L} needs a '.f' version, and every '.f' needs its base key
// ('q.f' is decision question F, not a forever version)
for (const key of Object.keys(dicts.en)) {
  if (/\{L\}/.test(dicts.en[key]) && !((key + '.f') in dicts.en)) fail(`"${key}" uses {L} but has no "${key}.f" version for "Keep going forever"`);
  if (key.endsWith('.f') && key !== 'q.f' && !(key.slice(0, -2) in dicts.en)) fail(`"${key}" has no base key "${key.slice(0, -2)}"`);
}

// keys used by the page
const code = read('js/app.js') + read('index.html');
const used = new Set();
for (const m of code.matchAll(/data-(?:t|l|h|ph)="([\w.]+)"/g)) used.add(m[1]);
for (const m of code.matchAll(/\bt\('([\w.]+)'/g)) used.add(m[1]);
for (const m of code.matchAll(/fld\('[^']+', '([\w.]+)', '([\w.]*)'/g)) { used.add(m[1]); if (m[2]) used.add(m[2]); }
for (const m of code.matchAll(/sel\('[^']+', '([\w.]+)'/g)) used.add(m[1]);
for (const m of code.matchAll(/\['\w+', '(x\.[\w.]+)'\]/g)) used.add(m[1]);
for (const m of code.matchAll(/ph: '([\w.]+)'/g)) used.add(m[1]);
for (const key of used) if (!key.endsWith('.') && !(key in dicts.en)) fail(`page uses "${key}" but it is not in en.js`);

if (problems) { console.error(`\n${problems} problem(s) found.`); process.exit(1); }
console.log(`✓ ${all.size} keys, identical across ${langs.join(', ')}; all ${used.size} keys used by the page exist.`);
