// Paste this once into a new Scriptable script named "GTA VI"

const SRC = "https://raw.githubusercontent.com/rareshandrei/GTA-VI-widget-iOS/main/widget.js";

const fm = FileManager.local();
const cachePath = fm.joinPath(fm.documentsDirectory(), "gta6-widget-src.js");

let remote = null;
try {
  
  remote = await new Request(`${SRC}?t=${Date.now()}`).loadString();
} catch (e) {
  console.warn(`fetch failed, falling back to cached copy: ${e}`);
}

if (remote) {
  
  await eval(remote);
  fm.writeString(cachePath, remote);
} else if (fm.fileExists(cachePath)) {
  await eval(fm.readString(cachePath));
} else {
  throw new Error("No network, and no cached copy of widget.js yet. Run once while online.");
}
