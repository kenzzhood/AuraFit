const path = require("path");
const fs = require("fs");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

// #region agent log — runs once at metro startup; stdout shows in EAS logs
try {
  const srcDir = path.join(projectRoot, "src");
  const screenTsx = path.join(srcDir, "components", "ui", "Screen.tsx");
  const lookFile = path.join(projectRoot, "app", "(app)", "look", "[id].tsx");
  console.log("[AURAFIT_DEBUG] projectRoot=", projectRoot);
  console.log("[AURAFIT_DEBUG] workspaceRoot=", workspaceRoot);
  console.log("[AURAFIT_DEBUG] cwd=", process.cwd());
  console.log("[AURAFIT_DEBUG] EAS_BUILD=", process.env.EAS_BUILD || "false");
  console.log("[AURAFIT_DEBUG] hasSrcDir=", fs.existsSync(srcDir));
  console.log("[AURAFIT_DEBUG] hasScreenTsx=", fs.existsSync(screenTsx));
  console.log("[AURAFIT_DEBUG] hasLookFile=", fs.existsSync(lookFile));
  if (fs.existsSync(srcDir)) {
    console.log("[AURAFIT_DEBUG] src/ entries=", fs.readdirSync(srcDir).join(","));
    const compUi = path.join(srcDir, "components", "ui");
    if (fs.existsSync(compUi)) {
      console.log("[AURAFIT_DEBUG] src/components/ui entries=", fs.readdirSync(compUi).join(","));
    } else {
      console.log("[AURAFIT_DEBUG] src/components/ui MISSING");
    }
  }
  // local POST (no-op on cloud)
  fetch("http://127.0.0.1:7717/ingest/8a77d6d8-834f-4f42-ac01-0cc8761305b6", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a5c909" },
    body: JSON.stringify({
      sessionId: "a5c909",
      runId: "metro-config-load-v2",
      hypothesisId: "H_FILE_MISSING",
      location: "apps/mobile/metro.config.js:load",
      message: "metro config loaded v2",
      data: {
        projectRoot,
        workspaceRoot,
        cwd: process.cwd(),
        hasSrcDir: fs.existsSync(srcDir),
        hasScreenTsx: fs.existsSync(screenTsx),
        env_EAS_BUILD: process.env.EAS_BUILD || null,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
} catch (e) {
  console.log("[AURAFIT_DEBUG] instrumentation error:", e.message);
}
// #endregion

const config = getDefaultConfig(projectRoot);

config.watchFolders = [...(config.watchFolders || []), workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// Required in this monorepo so Metro doesn't walk up from hoisted packages
// (e.g. expo-router) and lose track of mobile-only deps like
// react-native-safe-area-context. Local bundle fails without this.
config.resolver.disableHierarchicalLookup = true;

module.exports = withNativeWind(config, { input: "./global.css" });
