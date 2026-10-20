// Opens the page in a headless browser, switches through every language and both tabs, with the live-to
// slider at 90 and at "Keep going forever", checks the answer-everything rule and the God Emperor,
// and fails on script errors or untranslated keys. Run with: npm test
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const url = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
// fonts and libraries come from the internet; a blocked download isn't a fault in the page
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

await page.goto(url);
await page.waitForTimeout(1500);
// fill in enough for every section to have something to show
for (const [id, v] of Object.entries({ spend: '1,500', sIncome: '3,000', sSpend: '1,800', sCash: '6,000' })) await page.fill('#' + id, v);
await page.selectOption('#sHouse', 'rent');
await page.waitForTimeout(4000);

let problems = 0;
const fail = msg => { problems++; console.error('✗ ' + msg); };
const rpgName = () => page.evaluate(() => document.getElementById('rpgName').textContent);
const setLive = v => page.evaluate(v => { const l = document.getElementById('live'); l.value = v; l.dispatchEvent(new Event('input', {bubbles: true})); }, v);
const checkText = async label => {
  const text = await page.evaluate(() => document.querySelector('main').innerText);
  const raw = [...new Set(text.match(/\b(?:[a-z]+\.){1,2}[a-zA-Z0-9]+\b/g) || [])].filter(k => !k.startsWith('e.g'));
  if (raw.length) fail(`${label}: untranslated keys ${raw.join(', ')}`);
  if (/\{\w+\}/.test(text)) fail(`${label}: unfilled {placeholder} in the text`);
  if (/Infinity|NaN|undefined/.test(text)) fail(`${label}: Infinity, NaN or undefined in the text`);
};

// no adventurer until every question is answered, and follow-ups wait for their question
if (await rpgName() !== await page.evaluate(() => MMA.i18n.en['adv.unknown'])) fail('an adventurer was given before every question was answered');
if (!(await page.evaluate(() => document.getElementById('fdBigPay').classList.contains('locked')))) fail('the follow-up to big spending is not greyed out');
const answers = {sCar: 'none', sDeps: 'no', sKids: 'no', sBig: 'no', sWill: 'yes', sHealth: 'yes', sHomeIns: 'contents', sIncomeIns: 'yes', sCritical: 'yes', sAccident: 'yes'};
for (const [id, v] of Object.entries(answers)) await page.selectOption('#' + id, v);
await page.waitForTimeout(3000);
if (await rpgName() === await page.evaluate(() => MMA.i18n.en['adv.unknown'])) fail('no adventurer after every question was answered');

for (const live of [90, 121]) {
  await setLive(live);
  await page.waitForTimeout(2500);
  for (const lang of ['en', 'th', 'zh']) {
    await page.click(`#langSeg button[data-v=${lang}]`);
    for (const tab of ['tabCalc', 'tabSum']) {
      await page.click('#' + tab);
      await page.waitForTimeout(600);
      await checkText(`${lang}/${tab}/live ${live === 121 ? 'forever' : live}`);
    }
  }
}
await page.click('#langSeg button[data-v=en]');

// the God Emperor: everything healthy and a pot that never shrinks, even at 5 times the spending
await page.click('#tabCalc');
for (const [id, v] of Object.entries({start: '20,000,000', monthly: '5,000', sIncome: '30,000', sCash: '60,000'})) await page.fill('#' + id, v);
await page.selectOption('#sHouse', 'own'); await page.selectOption('#sHomeIns', 'yes');
await page.waitForTimeout(5000);
if (await rpgName() !== 'God Emperor') fail(`expected the God Emperor, got ${await rpgName()}`);
await page.selectOption('#sWill', 'no');
await page.waitForTimeout(4000);
if (await rpgName() !== 'The Emperor') fail(`one Okay answer should drop to The Emperor, got ${await rpgName()}`);

const rank = await page.evaluate(() => document.getElementById('rpgName').textContent);
console.log('Adventurer shown:', rank);
if (errors.length) fail('script errors:\n  ' + errors.join('\n  '));
await browser.close();
if (problems) process.exit(1);
console.log('✓ smoke test passed');
