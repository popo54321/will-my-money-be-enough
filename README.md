# Will My Money Be Enough?

A friendly, gamified money planner in three tabs: **Calculator** (every question), **Details** (the maths after retirement) and **Result** (your adventurer and levels). You enter your numbers, and it shows:

- **Whether your retirement money will last**: when your monthly investing stops mattering, what happens if you stop early, how long the pot lasts in retirement (to any age up to 120, or "Keep going forever"), and how it holds up when markets go up and down.
- **How healthy your money is today**: money left each month, debt, emergency savings, a life checklist (steady income, home and home loan, car, car loan and whether you really need a car, children, big plans) and insurance. Home and car loans are checked against take-home pay, with advice on keeping, refinancing or selling and renting.
- **Which adventurer you are**: 20 fantasy ranks, from Lost Traveller to The Emperor, made by combining the two answers above, with "next quests" to level up. Above them sits a secret 21st rank, the God Emperor. Below them is Level 0, The Labourer, for anyone who ticks “I’ll retire when I die”. You meet your adventurer once every question is answered, and you can tap any rank to read about it.

It runs in English, Thai and Simplified Chinese (for mainland China). The Thai and Chinese are localised, not translated word for word.

It's for fun and exploring, not financial advice. The maths is real, but it runs on guesses about the future that the user chooses.

## Run it

There's no build step. Either open `index.html` in a browser, or serve the folder:

```bash
npm start          # serves the folder at http://localhost:3000
```

Hosting it anywhere static works: GitHub Pages, Netlify or Vercel. On GitHub Pages, push to `main` and turn on Pages for the repo root.

Hosted over HTTPS, it can be added to a phone's home screen (Safari: Share → Add to Home Screen; Chrome: menu → Install app). It then opens full screen and works offline after the first visit (`manifest.webmanifest`, `sw.js`, `icons/`). The service worker always tries the network first, so online visitors get the newest version.

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
| `index.html` | The page structure: Calculator, Details and Result tabs, all sections |
| `css/styles.css` | All styles: cream and night colour looks, layout and print-free design |
| `js/i18n/en.js`, `th.js`, `zh.js` | Every piece of text, one file per language |
| `js/icons.js` | The 22 adventurer symbols, Level 0 to 21 (original SVG drawings) |
| `js/app.js` | Everything else: inputs, the money model, the market simulation, rendering, charts, the Result tab and adventurer ranks, and image export |
| `manifest.webmanifest`, `sw.js`, `icons/` | The installable app: name and icons, and offline support |
| `tests/` | The language check and the browser smoke test |

Libraries load from a CDN, with versions pinned: Chart.js 4.4.1 (jsDelivr), html2canvas 1.4.1 (cdnjs, loaded only when saving an image), and the Nunito, Noto Sans Thai and Noto Sans SC fonts from Google Fonts.

## How the maths works (short version)

- **Today's prices:** everything runs month by month, in today's prices. The page shows actual future amounts by default, because that's what people expect to see; "What it buys today" is one tap away. Growth before and after retirement, and fees, are turned into a monthly rate after inflation.
- **Paying in:** your monthly investing is a fixed cash amount unless you set a yearly raise, so inflation shrinks it over time.
- **Retirement:** each month you take out your spending, minus other income, plus tax if you set it.
- **Other income and one-off amounts:** add or remove rows as needed, up to 10 of each.
- **Defaults:** live to 100, inflation 3% (about the world average), growth 7% before and 5% after retirement, ups and downs 15% and 10%. The stop slider starts at the earliest age you could stop adding money and still be on track, or at retirement if that never happens.
- **Two people:** both pots are added together. If you invest differently, untick “Same growth as yours” and add your partner's growth and ups and downs; they're combined into one rate that gives the same pot at your retirement as growing each person's money separately.
- **Market test:** 1,000 seeded random possible futures, built from your growth rates and yearly ups and downs. The growth rate is read as the typical compound yearly growth, so an average future ends close to steady growth. They're the same every run, so results don't jump about as you type.
- **Keep going forever:** the live-to slider runs to 120, then one more step means forever. The page follows the money for 100 years after retirement; by then nothing changes, so the rest is worked out exactly: the money never runs out if the pot earns at least what you take out each month, otherwise the page gives the age it runs out, however far away.
- **Adventurer rank:** two ladders put together.
  - Retirement ladder: Runs out, Fragile, Secure, Unshakeable.
  - Health ladder: In crisis, Struggling, Stretched, Steady, Thriving.
  - At a glance: each card has "See all levels", listing every level from the top down, with where you are and how many steps are left. Your future: Dynastic Generational Wealth (the God Emperor's money test), Rock solid, On track, Close but fragile, Not on track yet. Your money today: Everything healthy, Looking healthy, Mostly fine, A few things need attention.
  - Your future rows each say which kind of market they assume: steady growth, markets going up and down, or a bad run of markets (worse than 9 in 10 possible futures).
  - No rank until every question is answered. Follow-up questions (for example "Do you have enough money for it?" after big spending) stay greyed out until the question they follow is answered.
  - God Emperor (level 21): The Emperor, plus every check on the Result tab Healthy (so renting, which counts as Okay, rules it out), plus a pot that, with steady growth, never gets smaller in any month of retirement even at 5 times your planned spending, up to 120 and forever after.

## Privacy

Everything stays in the user's browser (`localStorage`). Nothing is sent anywhere. The shareable image deliberately leaves out the amounts needed to level up, and a tick box leaves out every money amount.

## Known issues and next steps

- **Share inside claude.ai:** the claude.ai viewer blocks the phone share sheet, so Share is hidden there and only the two save buttons show. Hosted on its own over HTTPS, Share opens the native share sheet on phones. The image is built about 1.5 seconds after the Result tab settles, because browsers only allow sharing straight after a tap.
- **Social buttons:** hosted on its own, the Result tab shows Facebook and X buttons. On a phone they open the share menu with the money-free image, the caption and a link; on a computer they save that image and open the post window with the link and caption, since no app lets a web page attach an image. They're hidden inside claude.ai, where the page can't know its own shareable address. Facebook and X are blocked in mainland China, so people there use the Share button (WeChat and others appear in the phone's share menu).
- **Native-speaker review:** the owner, a native Thai speaker, reviews the Thai; the Chinese still needs a native speaker's read, especially the money terms and the newer text (Level 0, the Result tab notes, the Start here box).
- **"Unshakeable":** this currently means the money lasts in 99 of every 100 possible futures and survives a 30% fall in the first year of retirement. Tune it if it feels too easy or too hard.
- **Two people's ups and downs:** they're combined as if both pots rise and fall together, which is the cautious reading; two different portfolios usually smooth each other out a little.
