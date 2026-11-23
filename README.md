# NoContactSplit

Circle auto-settlement — Hassle-free splitting

Calculate splits by groups. Members settle within their group first; group leaders handle cross-group settlements. Payments work even if not everyone shares the same payment method.

The Chinese UI uses this copy: 圈子自動結算神器 / 零麻煩AA制. 可以根據人員圈子進行分帳計算，圈內成員優先互轉，圈主負責跨圈結算，即使沒有所有人員付款方式都可以付款。

Live site: <https://kelvinlamdev.github.io/interpersonal-relationship-expense-calculator/>

Settlement is a transfer plan (who pays whom). The app does not connect to payment apps or wallets. WhatsApp, LINE, and Signal are only used to share the result link.

## Features

- People list: add and remove people, with suggestions from names you typed recently.
- Expenses: payer, description, amount, and who to split among (select all or clear). Edit or delete an expense. The amount field has a small calculator.
- Each person shows the total they paid, and whether they should receive or pay a net amount.
- Groups: pick a leader, optional name, and members. Creating a group needs at least two people. You can calculate with no groups.
- Settlement plan: members transfer inside the group first, the leader absorbs what is left, then leaders settle across groups. Rows marked “Circle internal transfer” are inside a group. Rows without that label are cross-group, or between people who are not in a group.
- Decimal places: 1 or 2. Default is 2. The choice applies only to the current page and is not stored in the share link.
- After you calculate, a share link contains the people, groups, and expenses (`d` query parameter, compressed with lz-string). Older links that use `data` still open.
- Copy the link. If the browser supports native share, the page shows “More sharing options (app)”. Otherwise it shows WhatsApp, LINE, and Signal (Signal needs the app installed).
- Saved people and group combos stay in the browser (up to 20, no expenses). They are written when a settlement is calculated, including the automatic calculation after a share link opens.
- Languages: Traditional Chinese (default) and English, remembered in the browser.
- “Clear data” removes the current bill (people, groups, expenses, settlement, and share link). It does not remove the language, suggested names, or saved combos.
- Optional local `scenario.js` (listed in `.gitignore`). If it defines a global `SCENARIO_DATA` object with `people`, `groups`, and `expenses`, a load-scenario button appears in the header.

## Using the live site

Open the site above, add people, and record who paid, for what, and who shares the cost. Put people into groups and name a leader when you want transfers routed that way, then click “Calculate”. Copy the link from the share field before you send it. Opening that link removes the query from the address bar, and a refresh does not restore the bill on its own.

## Where data lives

The current bill stays in memory and is written into the share link when you calculate. It is not stored in `localStorage`. The browser only keeps three other things: the language (`ncs_lang`), recently typed names (`ncs_history_people`, up to 20), and saved people-and-group combos (`ncs_team_records`, up to 20).

## Run locally

There is no build step. Serve the repository root over HTTP. Locales are loaded with `fetch`, so opening `index.html` via `file://` will not load the interface text.

```bash
python3 -m http.server
```

Then open <http://localhost:8000/>.

`scenario.js` is an optional local sample. It is gitignored and is not in this repository. The page works without it.

## Tech

Static files. No build step and no package manifest.

- Vue 3 (`https://unpkg.com/vue@3/dist/vue.global.js`, major version only)
- Tailwind CSS (CDN script: `https://cdn.tailwindcss.com`)
- lz-string 1.5.0 (`https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js`)
- `index.html`, `app.js`, `style.css`
- `locales/zh-TW.json`, `locales/en.json`

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE). Copyright (c) 2026 Kelvin Lam.
