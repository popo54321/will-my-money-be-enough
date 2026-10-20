# Notes for Claude Code

## What this is
A static, no-build web app: "Will My Money Be Enough?", a gamified retirement and money-health planner in English, Thai and Simplified Chinese. It's plain HTML, CSS and vanilla JavaScript; there are no frameworks and no bundler. Read `README.md` first.

## Commands
- `npm start`: serve locally.
- `npm run check`: language files must have identical keys and identical `{placeholders}` per key, and every key the page uses must exist. Run it after any text change.
- `npm test`: the check above plus a headless browser smoke test across all languages and both tabs. It fails on script errors, untranslated keys or unfilled placeholders.

## Where things are
- `index.html`: markup only. Static text uses `data-t="key"` (textContent), `data-l="key"` + `data-h="hintKey"` (labels with hints) and `data-ph="key"` (placeholders). `applyStatic()` in `app.js` fills them.
- `js/i18n/{en,th,zh}.js`: all text, as `MMA.i18n.<lang> = { key: 'text {placeholder}' }`. They load before `app.js`.
- `js/icons.js`: `MMA.icons`, 64×64 SVG strings for the 21 adventurer classes plus `unknown`.
- `js/app.js`: one IIFE. The main parts, in order:
  - `parse()`: raw inputs to numbers.
  - `makeModel()` and `run()`: the month-by-month model in today's prices.
  - `compute()` and `computeMore()`: deterministic results.
  - `foreverOut()`: the long-run maths for "Keep going forever" (live-to value `FOREVER`, 121): after `FH` months past retirement the pot follows P → P(1+r) − w, so it either never runs out or runs out at a month worked out exactly.
  - `monteCarlo()`: 1,000 seeded random market histories.
  - `godTest()`: the God Emperor check, 5× spending, pot never shrinks after retirement.
  - `payFor()` and `payToLast()`: searches for the monthly amount needed.
  - `render*()`: one function per section.
  - `renderSummary()` and `renderAdventurer()`: the Summary tab and ranks.
  - `buildImage()`: the shareable PNG.
  - `render()`: the main loop. It runs everything quick straight away, then the market simulation and searches after a 180 ms pause.

## Rules to keep
1. **Every visible string goes through `t('key', {vars})`.** Add the key to all three language files. Thai and Chinese must be *localised*, not translated: use the phrases people actually use. Examples: ตลาดซบเซา / 行情低迷时 for "rainy years", ประกันสังคม / 医保 for public healthcare, กองทุนสำรองเลี้ยงชีพ, RMF, ThaiESG / 企业年金, 个人养老金 for workplace and tax-relief schemes.
2. **English is British English and plain English.** No jargon unless there's no everyday word for it ("growth 2% lower", never "2 points").
3. **The Calculator tab holds every input; the Summary tab shows results only.** Summary rows have `rw<Key>`, `pt<Key>`, `av<Key>` and `at<Key>` ids. Their inputs live on the Calculator with `fd<Key>` field ids.
4. **The shared image must never show level-up amounts.** `buildImage()` strips `.quest .qa` (when the quest has a target) and `.privrow`. Keep that when you change the Summary.
5. **Blank boxes that show "None" count as 0.** Take-home pay and spending now show "–" because they're needed.
6. **Colours come from CSS variables** in `css/styles.css`: `--keep`, `--keep-soft`, `--s1/s2/s3`, `--coast` and their `-ink` versions. Cream is the default look; Night is opt-in via `html[data-look="night"]`. Don't follow `prefers-color-scheme`; the owner wants cream by default.
7. **Defaults lean cautious on purpose:** inflation 3.5% and growth after retirement 5%. Optional extras default to blank (none).
8. **Keep the "not financial advice" note** (`heads` key) under the title and in the shared image.
9. **Forever mode text:** `t()` swaps any key for its `key.f` version while `inForever` is on. Any text with `{L}` (the live-to age) must have a `.f` version; `npm run check` enforces it.
10. **Ranks:** no adventurer until every Summary question is answered (`missing` in `renderSummary()`). Follow-up questions are greyed out until the question they follow is answered. Level 21 (God Emperor) is never reached through the ladders alone.

## Gotchas
- **Saved data:** `localStorage` keys are `paying-in-stop-v4` (inputs and UI state) and `paying-in-plans-v1` (saved plans). Bump the version if the saved shape changes.
- **Inside claude.ai:** `window.claude.use('downloads')` provides saving, and `navigator.share` is blocked. Standalone, `saveBlob()` uses a normal download link and Share uses `navigator.share`. `IN_CLAUDE` switches between the two.
- **Sharing needs a fresh tap:** `navigator.share` must be called directly from the tap, before any `await`. That's why `scheduleImage()` pre-builds the PNG.
- **Market test speed:** the market test and the `payFor()` searches are the slow parts. Keep them in the delayed job in `render()`, never in the instant part.
