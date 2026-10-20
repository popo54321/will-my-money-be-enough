# Will My Money Be Enough?

A friendly, gamified money planner. You enter your numbers, and it shows:

- **Whether your retirement money will last**: when your monthly investing stops mattering, what happens if you stop early, how long the pot lasts in retirement (to any age up to 120, or "Keep going forever"), and how it holds up when markets go up and down.
- **How healthy your money is today**: money left each month, debt, emergency savings, a life checklist (home, car, children, big plans) and insurance.
- **Which adventurer you are**: 20 fantasy ranks, from Lost Wanderer to The Emperor, made by combining the two answers above, with "next quests" to level up. Above them sits a secret 21st rank, the God Emperor. You meet your adventurer once every question is answered, and you can tap any rank to read about it.

It runs in English, Thai and Simplified Chinese (for mainland China). The Thai and Chinese are localised, not translated word for word.

It's for fun and exploring, not financial advice. The maths is real, but it runs on guesses about the future that the user chooses.

## Run it

There's no build step. Either open `index.html` in a browser, or serve the folder:

```bash
npm start          # serves the folder at http://localhost:3000
```

Hosting it anywhere static works: GitHub Pages, Netlify or Vercel. On GitHub Pages, push to `main` and turn on Pages for the repo root.

## Check it

```bash
npm install                      # first time only
npx playwright install chromium  # first time only, for the browser test
npm run check                    # language files: same keys, same {placeholders}
npm test                         # language check + headless browser smoke test
```

## Files

| File | What it holds |
|---|---|
| `index.html` | The page structure: Calculator tab, Summary tab, all sections |
| `css/styles.css` | All styles: cream and night colour looks, layout and print-free design |
| `js/i18n/en.js`, `th.js`, `zh.js` | Every piece of text, one file per language |
| `js/icons.js` | The 21 adventurer symbols (original SVG drawings) |
| `js/app.js` | Everything else: inputs, the money model, the market simulation, rendering, charts, the Summary and adventurer ranks, and image export |
| `tests/` | The language check and the browser smoke test |

Libraries load from a CDN, with versions pinned: Chart.js 4.4.1 (jsDelivr), html2canvas 1.4.1 (cdnjs, loaded only when saving an image), and the Nunito, Noto Sans Thai and Noto Sans SC fonts from Google Fonts.

## How the maths works (short version)

- **Today's prices:** everything runs month by month, in today's prices. The page shows actual future amounts by default, because that's what people expect to see; "What it buys today" is one tap away. Growth before and after retirement, and fees, are turned into a monthly rate after inflation.
- **Paying in:** your monthly investing is a fixed cash amount unless you set a yearly raise, so inflation shrinks it over time.
- **Retirement:** each month you take out your spending, minus other income, plus tax if you set it.
- **Other income and one-off amounts:** add or remove rows as needed, up to 10 of each.
- **Market test:** 1,000 seeded random histories, built from your growth rates and yearly ups and downs. They're the same every run, so results don't jump about as you type.
- **Keep going forever:** the live-to slider runs to 120, then one more step means forever. The page follows the money for 100 years after retirement; by then nothing changes, so the rest is worked out exactly: the money never runs out if the pot earns at least what you take out each month, otherwise the page gives the age it runs out, however far away.
- **Adventurer rank:** two ladders put together.
  - Retirement ladder: Runs out, Fragile, Secure, Unshakeable.
  - Health ladder: In crisis, Struggling, Stretched, Steady, Thriving.
  - At a glance: each card has "See all levels", listing every level from the top (Rock solid / Everything healthy) down, with where you are and how many steps are left.
  - No rank until every question is answered. Follow-up questions (for example "Do you have enough money for it?" after big spending) stay greyed out until the question they follow is answered.
  - God Emperor (level 21): The Emperor, plus every check in the Summary Healthy (so renting, which counts as Okay, rules it out), plus a pot that, with steady growth, never gets smaller in any month of retirement even at 5 times your planned spending, up to 120 and forever after.

## Privacy

Everything stays in the user's browser (`localStorage`). Nothing is sent anywhere. The shareable image deliberately leaves out the amounts needed to level up, and a tick box leaves out every money amount.

## Known issues and next steps

- **Share inside claude.ai:** the claude.ai viewer blocks the phone share sheet, so Share is hidden there and only "Save as image" shows. Hosted on its own over HTTPS, Share opens the native share sheet on phones. The image is built about 1.5 seconds after the Summary settles, because browsers only allow sharing straight after a tap.
- **Social buttons:** hosted on its own, the Summary shows X, Facebook and LINE (English and Thai) or Weibo (Chinese) buttons that open each app's post window with a link and the rank. None of them can attach an image from a web page, so the note asks people to save the image first. They're hidden inside claude.ai, where the page can't know its own shareable address. WeChat has no web share link.
- **Native-speaker review:** have the Thai and Chinese read by native speakers, especially the money terms and the new "forever" and God Emperor text.
- **"Unshakeable":** this currently means the money lasts in 99 of 100 histories and survives a 30% fall in the first year of retirement. Tune it if it feels too easy or too hard.
- **Retirement age cap:** the model plans at most 80 years from today to retirement, so very young ages with a very late retirement are quietly shortened.
