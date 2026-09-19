// GTA VI countdown widget
// 1. Install Scriptable (free, App Store)
// 2. New script, paste this, tap play once
// 3. Home screen: hold > + > Scriptable > medium > add
// 4. Hold the widget > Edit Widget > Script > GTA VI

const SRC = "https://raw.githubusercontent.com/rareshandrei/GTA-VI-widget-iOS/v1/widget.js";
const fm = FileManager.local();
const cache = fm.joinPath(fm.documentsDirectory(), "gta6-widget-src.js");

let src = null;
try { src = await new Request(SRC).loadString(); } catch (e) { console.warn(e); }

if (src) { await eval(src); fm.writeString(cache, src); }
else if (fm.fileExists(cache)) { await eval(fm.readString(cache)); }
else { throw new Error("No internet. Connect and run this once."); }
