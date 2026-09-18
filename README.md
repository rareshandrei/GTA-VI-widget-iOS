# GTA VI countdown widget

A medium iOS home screen widget showing the number of days until GTA VI releases on
**19 November 2026**, outlined over the Jason & Lucia artwork. Just the number — nothing else.

Runs on [Scriptable](https://scriptable.app) (free), so it needs no Mac, no Xcode, no Apple
Developer account, and never expires.

<!-- Assets are served straight from this repo, so it has to stay public. -->

## Setup

1. Install **Scriptable** from the App Store.
2. In Scriptable, tap **+** to create a new script and name it **GTA VI**.
3. Paste the contents of [`bootstrap.js`](bootstrap.js) into it and run it once while online.
   You should see the widget preview appear.
4. On the home screen: long-press → **+** → **Scriptable** → choose the **medium** size → add it.
5. Long-press the new widget → **Edit Widget** → set *Script* to **GTA VI**.

That is the only time anything is typed on the phone. Everything after that is edited here and
picked up automatically.

## How it works

`bootstrap.js` is a ten-line loader: it fetches `widget.js` from this repo, caches it, and
`eval`s it. `widget.js` draws the background and composites the digits, then hands the result to
WidgetKit as the widget's background image.

The day count uses **calendar-day arithmetic** rather than dividing milliseconds, so a DST change
or "23 hours left" can't cause an off-by-one. The widget asks to refresh just after local
midnight, which is the only moment the number changes, and recomputes on every run regardless.

### Why the digits are images

Scriptable can only draw **filled** text and cannot load font files. An outlined non-system
typeface therefore can't be rendered on the phone, so `tools/gen-assets.ps1` pre-renders digits
0–9 as outlined transparent PNGs. `widget.js` lays them out by stepping each glyph's advance
width, which reproduces exactly what the font does with the string itself.

Everything is cached into Scriptable's local documents directory on first run, so after that the
widget works with no network at all.

## Editing the design

`bg.jpg` and `digits/` are generated. To change the artwork, font, size or stroke weight:

1. Put `Jason_and_Lucia_Robbery_landscape.jpg` back in the repo root (it is gitignored).
2. Edit the constants at the top of `tools/gen-assets.ps1`.
3. Run it:

```bash
pwsh -File tools/gen-assets.ps1
```

4. Check the result in `preview.html` — serve the folder over HTTP rather than opening the file
   directly, or the relative image paths won't resolve:

```bash
python -m http.server 8777
```

5. To move the number, edit `CONFIG.number` in `widget.js` (and the matching `CENTER_X` /
   `CENTER_Y` in `preview.html`).
6. **Bump `CONFIG.assetVersion` in `widget.js`**, otherwise phones keep serving the old cached
   assets, then commit and push.

## Layout constants

| | |
|---|---|
| Canvas | 1014 × 474 (medium widget @3x) |
| Crop | 3840×2160 → 2.139:1, trimmed 25px off the top and the rest off the bottom |
| Digit cap height | 180px |
| Outline weight | 6px |
| Number centre | x 190, y 150 |

## Credits

Digits are set in [Chakra Petch](https://fonts.google.com/specimen/Chakra+Petch) by Cadson Demak,
used under the SIL Open Font License — see `tools/ChakraPetch-OFL.txt`.

The real GTA VI wordmark is a bespoke typeface Rockstar commissioned from Colophon Foundry and is
not publicly available; Chakra Petch is a lookalike. Artwork is © Rockstar Games, used here for a
personal fan project.
