// GTA VI countdown — Scriptable medium widget.
//
// Shows one thing: the number of days left until release, outlined over the artwork.
// Nothing else is drawn.
//
// The digits are pre-rendered PNGs rather than text because Scriptable can only draw
// FILLED text and cannot load font files, so an outlined non-system face has to be
// baked in advance (see tools/gen-assets.ps1). Everything is cached on first run, so
// after that the widget works with no network at all.
//
// The whole file is one async IIFE: bootstrap.js loads this over the network and
// eval()s it, and eval cannot handle top-level await. Returning the promise lets the
// loader await completion.

(async () => {
  const CONFIG = {
    // Release date, as local midnight.
    target: { year: 2026, month: 11, day: 19 },

    repo: "https://raw.githubusercontent.com/rareshandrei/GTA-VI-widget-iOS/main",

    // Bump this after regenerating assets to invalidate the on-device cache.
    assetVersion: 1,

    // Must match the constants in tools/gen-assets.ps1.
    canvas: { width: 1014, height: 474 },

    // Centre of the number, in canvas pixels — sits in the open sky left of Lucia.
    number: { centerX: 190, centerY: 150 },

    // Set to a number to preview a different day count; leave null in production.
    debugDays: null,
  };

  // -------------------------------------------------------------- day count

  // Calendar-day arithmetic, not millisecond division, so a DST change or "23 hours
  // left" can never produce an off-by-one.
  function daysUntilRelease(now) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const release = new Date(CONFIG.target.year, CONFIG.target.month - 1, CONFIG.target.day);
    return Math.round((release - today) / 86400000);
  }

  function nextRefreshDate(now) {
    // Just after the next local midnight, the only moment the number changes.
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 2, 0);
  }

  // -------------------------------------------------------------- assets

  const fm = FileManager.local();

  function cacheDir() {
    const dir = fm.joinPath(fm.documentsDirectory(), `gta6-widget-v${CONFIG.assetVersion}`);
    if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
    return dir;
  }

  async function cachedImage(name) {
    // Digit paths contain a slash; flatten so everything sits in one cache folder.
    const path = fm.joinPath(cacheDir(), name.replace("/", "_"));
    if (fm.fileExists(path)) {
      const cached = fm.readImage(path);
      if (cached) return cached;
    }
    const img = await new Request(`${CONFIG.repo}/${name}`).loadImage();
    fm.writeImage(path, img);
    return img;
  }

  async function cachedMetrics() {
    const path = fm.joinPath(cacheDir(), "digits.json");
    if (fm.fileExists(path)) {
      try {
        return JSON.parse(fm.readString(path));
      } catch (e) {
        // Corrupt cache — fall through and refetch.
      }
    }
    const meta = await new Request(`${CONFIG.repo}/digits.json`).loadJSON();
    fm.writeString(path, JSON.stringify(meta));
    return meta;
  }

  // -------------------------------------------------------------- rendering

  // Steps each digit by its advance width, which reproduces exactly what the font
  // does when laying out the string itself (verified against a native render).
  function drawNumber(dc, text, digits, meta) {
    let total = 0;
    for (const ch of text) total += meta.advance[ch];

    const top = CONFIG.number.centerY - meta.capHeight / 2 - meta.stroke / 2;
    let x = CONFIG.number.centerX - total / 2;

    for (const ch of text) {
      const img = digits[ch];
      if (img) {
        dc.drawImageInRect(
          img,
          new Rect(x - meta.stroke / 2, top, meta.canvasWidth[ch], meta.canvasHeight)
        );
      }
      x += meta.advance[ch];
    }
  }

  async function buildImage(text) {
    const dc = new DrawContext();
    dc.size = new Size(CONFIG.canvas.width, CONFIG.canvas.height);
    dc.respectScreenScale = false;
    dc.opaque = true;

    const background = await cachedImage("bg.jpg");
    dc.drawImageInRect(background, new Rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height));

    const meta = await cachedMetrics();

    // Fetch the digits actually needed first, so a slow link still renders correctly.
    const digits = {};
    for (const ch of new Set(text)) digits[ch] = await cachedImage(`digits/${ch}.png`);

    drawNumber(dc, text, digits, meta);

    // Then warm the rest, so every later day works with no network.
    for (let d = 0; d <= 9; d++) {
      if (digits[d] === undefined) {
        try {
          await cachedImage(`digits/${d}.png`);
        } catch (e) {
          // Not needed today; a later run can retry.
        }
      }
    }

    return dc.getImage();
  }

  // Only reached if the very first run has no network and nothing is cached yet.
  function fallbackImage(text) {
    const dc = new DrawContext();
    dc.size = new Size(CONFIG.canvas.width, CONFIG.canvas.height);
    dc.respectScreenScale = false;
    dc.opaque = true;
    dc.setFillColor(new Color("#2b1b4d"));
    dc.fillRect(new Rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height));
    dc.setTextColor(Color.white());
    dc.setFont(Font.boldSystemFont(180));
    dc.setTextAlignedCenter();
    dc.drawTextInRect(text, new Rect(0, 130, CONFIG.canvas.width, 220));
    return dc.getImage();
  }

  // -------------------------------------------------------------- main

  const now = new Date();
  const days = CONFIG.debugDays !== null ? CONFIG.debugDays : daysUntilRelease(now);
  const text = String(Math.max(0, days));

  let image;
  try {
    image = await buildImage(text);
  } catch (e) {
    console.error(`asset load failed: ${e}`);
    image = fallbackImage(text);
  }

  const widget = new ListWidget();
  widget.setPadding(0, 0, 0, 0);
  widget.backgroundImage = image;
  widget.refreshAfterDate = nextRefreshDate(now);

  if (config.runsInWidget) {
    Script.setWidget(widget);
  } else {
    await widget.presentMedium();
  }
  Script.complete();
})();
