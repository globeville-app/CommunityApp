/**
 * Builds the clickable browser demo as ONE self-contained HTML file.
 *
 *   npm run demo:build            → writes web-demo/index.html
 *   npm run demo:build -- out.html
 *
 * The demo is the real app's screens running in a browser, with a pretend
 * backend (src/demo/fakeBackend.ts) because the browser can't reach your
 * Django server. Everything (JavaScript, images and fonts) is packed into the one
 * file so it can be opened or hosted anywhere.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mobileDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.resolve(process.argv[2] ?? path.join(mobileDir, "web-demo", "index.html"));
const appName = JSON.parse(fs.readFileSync(path.join(mobileDir, "..", "shared", "app_config.json"), "utf8")).app_name;

// 1. Let Expo build the web version into a temporary folder. --clear skips
//    Metro's cache so a renamed app (shared/app_config.json) is picked up.
const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), "web-export-"));
execSync(`npx expo export --platform web --clear --output-dir "${exportDir}"`, {
  cwd: mobileDir,
  stdio: "inherit",
  env: { ...process.env, CI: "1" },
});

// 2. Read the JavaScript bundle Expo produced.
const exportedHtml = fs.readFileSync(path.join(exportDir, "index.html"), "utf8");
const scriptPath = exportedHtml.match(/<script src="([^"]+)"/)[1];
let bundle = fs.readFileSync(path.join(exportDir, scriptPath), "utf8");

// 3. Images and fonts are referenced as "/assets/...png" or ".ttf". Embed each
//    one as a data URI so the page doesn't depend on where it's hosted.
const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", ttf: "font/ttf" };
bundle = bundle.replace(/"(\/assets\/[^"]+\.(png|jpg|jpeg|gif|ttf))"/g, (whole, assetPath, ext) => {
  const file = path.join(exportDir, assetPath);
  if (!fs.existsSync(file)) return whole;
  const mime = MIME[ext];
  return JSON.stringify(`data:${mime};base64,${fs.readFileSync(file).toString("base64")}`);
});

// A literal "</script" inside the bundle would end the inline <script> early.
bundle = bundle.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");

// 4. Denver's real neighborhood boundaries and aliases, for the demo's
//    neighborhood check (see src/demo/fakeBackend.ts). Coordinates are
//    rounded to 6 decimal places (about 10 cm) to keep the page smaller.
const dataDir = path.join(mobileDir, "..", "backend", "data");
const geojson = JSON.parse(fs.readFileSync(path.join(dataDir, "denver_statistical_neighborhoods.geojson"), "utf8"));
const round = (n) => Math.round(n * 1e6) / 1e6;
const demoData = {
  neighborhoods: geojson.features.map((f) => {
    const polygons = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates];
    return {
      id: Number(f.properties.NBHD_ID),
      name: String(f.properties.NBHD_NAME).trim(),
      rings: polygons.flat().map((ring) => ring.map(([lon, lat]) => [round(lon), round(lat)])),
    };
  }),
  aliases: JSON.parse(fs.readFileSync(path.join(dataDir, "neighborhood_aliases.json"), "utf8")),
};
const demoDataScript = `globalThis.__DEMO_DATA__ = ${JSON.stringify(demoData).replace(/</g, "\\u003c")};`;

// 5. Wrap it in a page: a phone-sized frame on wide screens, full screen on phones.
const page = `<meta charset="utf-8">
<title>${appName} Join Flow</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap">
<style>
  /* Layout: explainer on the left, the app in a phone frame on the right; app only on phones. */
  /* App palette (design/DESIGN.md): deep purple base, yellow accent. */
  :root {
    --bg: #1A0F3D;
    --fg: #FFFFFF;
    --muted: #D9D0F5;
    --accent: #FFF3A3;
    --bezel: #0B0620;
    --rule: rgba(255, 255, 255, 0.15);
    --font: "Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color-scheme: dark;
  }
  html, body { height: 100%; }
  body { margin: 0; color: var(--fg); font-family: var(--font); overflow: hidden;
    background: radial-gradient(60% 50% at 15% 20%, rgba(139, 92, 246, 0.35), transparent 70%),
      radial-gradient(50% 45% at 85% 85%, rgba(255, 62, 165, 0.18), transparent 70%), var(--bg); }
  .stage { height: 100%; display: grid; grid-template-columns: minmax(0, 420px) auto; justify-content: center;
    align-items: center; gap: 56px; padding-inline: 24px; box-sizing: border-box; }
  .about { display: grid; gap: 18px; max-width: 420px; min-width: 0; }
  .eyebrow { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); margin: 0; }
  h1 { font-size: 40px; font-weight: 600; line-height: 1.05; margin: 0; text-wrap: balance; letter-spacing: -0.01em; }
  .about p { margin: 0; font-size: 15px; line-height: 1.55; color: var(--muted); }
  .about ol { margin: 0; padding-left: 20px; display: grid; gap: 6px; font-size: 15px; line-height: 1.45; }
  .note { border-top: 1px solid var(--rule); padding-top: 14px; font-size: 13px !important; }
  .phone { width: 390px; height: min(820px, calc(100vh - 48px)); border-radius: 46px; background: var(--bezel);
    padding: 12px; box-sizing: border-box; box-shadow: 0 30px 80px -20px rgba(139, 92, 246, 0.45); }
  .screen { width: 100%; height: 100%; border-radius: 34px; overflow: hidden; background: var(--bg); display: flex; }
  #root { display: flex; flex: 1; height: 100%; }
  @media (max-width: 880px), (max-height: 620px) {
    .stage { display: block; padding: 0; }
    .about { display: none; }
    .phone { width: 100%; height: 100%; border-radius: 0; padding: 0; box-shadow: none; background: var(--bg); }
    .screen { border-radius: 0; }
  }
</style>
<div class="stage">
  <section class="about" aria-label="About this demo">
    <p class="eyebrow">Milestone 1 &middot; Demo</p>
    <h1>${appName}: join your Denver neighborhood</h1>
    <p>These are the real app screens, running in your browser. A pretend backend stands in for the server, so nothing you type leaves this page.</p>
    <ol>
      <li>Sign up with any email and a password of 8+ characters.</li>
      <li>Tap a sample address. It's checked against Denver's official neighborhood map.</li>
      <li>Try the LoHi sample to see the local-name choice.</li>
      <li>Set up your profile, then reload the page: you stay logged in.</li>
    </ol>
    <p class="note">The neighborhood check uses Denver's real boundaries. Only the address lookup is simulated: a web page can't reach the Census geocoder the real app uses, so the demo knows a few sample addresses and recognizes neighborhood names you type. Use Reset in the banner at the top to start over.</p>
  </section>
  <div class="phone"><div class="screen"><div id="root"></div></div></div>
</div>
<script>
  // The app picks its screen from the page's path; start it at "/".
  try { if (location.pathname !== "/") history.replaceState(null, "", "/"); } catch (e) {}
</script>
<script>
${demoDataScript}
</script>
<script>
${bundle}
</script>
`;

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, page);
fs.rmSync(exportDir, { recursive: true, force: true });
console.log(`Demo written to ${output} (${(page.length / 1024 / 1024).toFixed(1)} MB)`);
