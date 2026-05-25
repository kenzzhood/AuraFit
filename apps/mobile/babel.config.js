const path = require("path");
const fs = require("fs");

// #region agent log
try {
  const payload = {
    sessionId: "a5c909",
    runId: "babel-config-load",
    hypothesisId: "H_FIX_A",
    location: "apps/mobile/babel.config.js:load",
    message: "babel config loaded",
    data: {
      __dirname,
      cwd: process.cwd(),
      env_EAS_BUILD: process.env.EAS_BUILD || null,
    },
    timestamp: Date.now(),
  };
  try {
    fs.appendFileSync(
      path.join(__dirname, ".aurafit-debug.log"),
      JSON.stringify(payload) + "\n",
    );
  } catch {}
  fetch("http://127.0.0.1:7717/ingest/8a77d6d8-834f-4f42-ac01-0cc8761305b6", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a5c909" },
    body: JSON.stringify(payload),
  }).catch(() => {});
} catch {}
// #endregion

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: ["react-native-reanimated/plugin"],
  };
};
