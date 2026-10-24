# Notes for Claude Code

## What this is
A static, no-build web app: "Will My Money Be Enough?", a gamified retirement and money-health planner in English, Thai and Simplified Chinese. It's plain HTML, CSS and vanilla JavaScript; there are no frameworks and no bundler. Read `README.md` first.

## Commands
- `npm start`: serve locally.
- `npm run check`: language files must have identical keys and identical `{placeholders}` per key, and every key the page uses must exist. Run it after any text change.
- `npm test`: the check above plus a headless browser smoke test across all languages and all three tabs. It fails on script errors, untranslated keys or unfilled placeholders.

## Where things are
- `index.html`: markup only. Static text uses `data-t="key"` (textContent), `data-l="key"` + `data-h="hintKey"` (labels with hints) and `data-ph="key"` (placeholders). `applyStatic()` in `app.js` fills them.
- `js/i18n/{en,th,zh}.js`: all text, as `MMA.i18n.<lang> = { key: 'text {placeholder}' }`. They load before `app.js`.
- `js/icons.js`: `MMA.icons`, 64×64 SVG strings for the 22 adventurer classes (Level 0 The Labourer to 21 God Emperor) plus `unknown`.
- `js/app.js`: one IIFE. The main parts, in order:
  - `parse()`: raw inputs to numbers.
  - `makeModel()` and `run()`: the month-by-month model in today's prices.
  - `compute()` and `computeMore()`: deterministic results.
  - `foreverOut()`: the long-run maths for "Keep going forever" (live-to value `FOREVER`, 121): after `FH` months past retirement the pot follows P → P(1+r) − w, so it either never runs out or runs out at a month worked out exactly.
  - `monteCarlo()`: 1,000 seeded random possible futures for the markets.
  - `godTest()`: the God Emperor check, 5× spending, pot never shrinks after retirement.
  - `payFor()` and `payToLast()`: searches for the monthly amount needed.
  - `render*()`: one function per section.
  - `renderSummary()` and `renderAdventurer()`: the Result tab (`pageSum`, `ui.tab = 'sum'`) and ranks.
  - `buildImage()`: the shareable PNG.
  - `render()`: the main loop. It runs everything quick straight away, then the market simulation and searches after a 180 ms pause.

## Rules to keep
1. **Every visible string goes through `t('key', {vars})`.** Add the key to all three language files. Thai and Chinese must be *localised*, not translated: use the phrases people actually use. Examples: ตลาดซบเซา / 行情低迷时 for "rainy years", ประกันสังคม / 医保 for public healthcare, กองทุนสำรองเลี้ยงชีพ, RMF, ThaiESG / 企业年金, 个人养老金 for workplace and tax-relief schemes.
2. **Thai: "today’s prices" is มูลค่าวันนี้, never ราคาวันนี้.** **Proportions use ใน ("3 ใน 4"), never จาก;** "เลเวล {n} จาก {total}" keeps จาก. **Thai spacing follows the owner's style:** no space where a clause carries on (before และ, แต่, ถ้า, หรือ, จึง, เพราะ, ซึ่ง, โดย, ก็, แล้ว, เพื่อ); keep spaces only between separate sentences, after ๆ, around numbers and {placeholders}, between items in a list, and after a one-word answer such as "ได้ แต่…". The owner is a native speaker, so follow their edits.
2b. **English is British English and plain English.** No jargon unless there's no everyday word for it ("growth 2% lower", never "2 points"). The market test's runs are "possible futures" (Thai แบบจำลอง, Chinese 次模拟), never "histories". Rank names and descriptions follow the Thai ones, localised.
3. **Three tabs: Calculator (`pageCalc`), Details (`pageDet`) and Result (`pageSum`).** The Calculator holds every question; the Details tab holds the maths after retirement (retirement, scenarios, markets, retirement ages, how much to invest, keep investing?, compare plans, method), with only what-if controls such as the sliders and market settings; the Result tab shows results only. Summary rows have `rw<Key>`, `pt<Key>`, `av<Key>` and `at<Key>` ids. Their inputs live on the Calculator with `fd<Key>` field ids.
4. **The shared image must never show level-up amounts.** `buildImage()` strips `.quest .qa` (when the quest has a target) and `.privrow`. Keep that when you change the Summary.
5. **Blank boxes that show "None" count as 0.** Take-home pay and spending now show "–" because they're needed.
6. **Colours come from CSS variables** in `css/styles.css`: `--keep`, `--keep-soft`, `--s1/s2/s3`, `--coast` and their `-ink` versions. Cream is the default look; Night is opt-in via `html[data-look="night"]`. Don't follow `prefers-color-scheme`; the owner wants cream by default.
7. **Defaults:** live-to age 100 (`ui.live`; saves still on the old 90 move to 100 unless `ui.liveSet`), the stop slider at the earliest age you can stop adding money and still be on track (`R.coast`), or at retirement if never, inflation 3% (about the world average; World Bank world consumer prices rose about 3.5% a year on average since 2000, most countries a little less) and growth after retirement 5%, which leans cautious. Optional extras default to blank (none).
8. **Keep the "not financial advice" note** (`heads` key) under the title and in the shared image.
9. **Forever mode text:** `t()` swaps any key for its `key.f` version while `inForever` is on. Any text with `{L}` (the live-to age) must have a `.f` version; `npm run check` enforces it.
10. **Ranks:** no adventurer until every Summary question is answered (`missing` in `renderSummary()`). Follow-up questions are greyed out until the question they follow is answered. Level 21 (God Emperor) is never reached through the ladders alone. Ticking “I’ll retire when I die” (`noRetire`) models retirement in the year before the live-to age and always gives Level 0, The Labourer (`LABOUR`), with a kind note.
11. **Emotional flow (the owner audited this; keep it):** the Calculator asks every question (Your numbers, Your money today, Life checklist, Insurance), then offers “See my result” and “See the details after you retire”; the Details tab ends with “See my result”. The Summary shows the result before Save/Share. Each result opens with the verdict sentence. Don't pile on: amounts above take-home pay get `over.pay` (or `over.payUp` once on track); the “never shrinks” amount, the slower-growth option and the rainy-years fix only show once the plan works; scenarios reached after the money has run out say they don't apply; the market test swaps its big % for “fix the plan first” when steady growth already fails; “Keep investing?” shrinks to one line when it doesn't apply; next-step suggestions never cut retirement spending by more than half. Kind words match the level (`cheer.t` for Not on track, `cheer.ok` for Close, but fragile), appear once per screen, and come with a “what's going well” line; several “Needs attention” items get a “Start here” top three.

## Gotchas
- **Ad blockers:** never start a class or id with `adv`, `ad-`, `ads`, `banner` or `sponsor`. Ad-block lists (EasyList, built into Edge and others) hide them; `.advtop` once made the rank vanish on phones. The rank block uses `rpg…` names.
- **Rows you can add:** other income (`in<N>…`) and one-off amounts (`on<N>…`) are built by `buildRows()`; their counts sit in the hidden inputs `nInc` and `nOne`, so saves and plans remember them. `rowCount()` reads older saves that always had 3 rows.
- **Amounts shown:** actual future amounts are the default (`ui.unit = 'cash'`); a saved "today's prices" choice is kept only when `ui.unitSet` says the person picked it.
- **Saved data:** `localStorage` keys are `paying-in-stop-v4` (inputs and UI state) and `paying-in-plans-v1` (saved plans). Bump the version if the saved shape changes.
- **Inside claude.ai:** `window.claude.use('downloads')` provides saving, and `navigator.share` is blocked. Standalone, `saveBlob()` uses a normal download link and Share uses `navigator.share`. `IN_CLAUDE` switches between the two.
- **Sharing needs a fresh tap:** `navigator.share` must be called directly from the tap, before any `await`. That's why `scheduleImage()` pre-builds the PNG. Shared images are always the short, money-free one (`buildImage(true, true)`); the short image leaves out the Your future table.
- **Market test growth:** `monteCarlo()` reads the growth rate as the typical compound yearly growth (draws centred v²/2 higher), so average years end close to steady growth. Don't undo that without changing `m.p8`.
- **Installable app:** `manifest.webmanifest`, `sw.js` and `icons/` make the hosted page installable and offline-capable. `sw.js` is network first; add any new file the page loads to `CORE` there and bump `VERSION` when that list changes. It registers only over http(s) and never inside claude.ai.
- **Two people:** `blendGrowth()` in `parse()` folds the partner's growth and ups and downs (only when “Same growth as yours”, `pSame`, is unticked) into one growth rate and one volatility per phase, so the rest of the model stays single-pot.
- **Market test speed:** the market test and the `payFor()` searches are the slow parts. Keep them in the delayed job in `render()`, never in the instant part.
