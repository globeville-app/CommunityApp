/**
 * Android 11+ only lets an app ask "is Google Maps / Waze installed?" for
 * apps it lists under <queries> in AndroidManifest.xml. This adds them, to
 * match iPhone's LSApplicationQueriesSchemes in app.config.ts.
 */
const { withAndroidManifest } = require("@expo/config-plugins");

const SCHEMES = ["comgooglemaps", "waze"];

module.exports = function withMapAppQueries(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const queries = (manifest.queries ??= [{}])[0];
    queries.intent ??= [];
    for (const scheme of SCHEMES) {
      const exists = queries.intent.some((intent) => intent.data?.some((d) => d.$["android:scheme"] === scheme));
      if (!exists) {
        queries.intent.push({
          action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
          data: [{ $: { "android:scheme": scheme } }],
        });
      }
    }
    return mod;
  });
};
