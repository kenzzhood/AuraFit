const path = require("path");
const fs = require("fs");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

// #region agent log
try {
  const payload = {
    sessionId: "a5c909",
    runId: "metro-config-load",
    hypothesisId: "H_FIX_A",
    location: "apps/mobile/metro.config.js:load",
    message: "metro config loaded",
    data: {
      projectRoot,
      workspaceRoot,
      cwd: process.cwd(),
      hasMobileSrc: fs.existsSync(path.join(projectRoot, "src", "components", "ui", "Screen.tsx")),
      hasRootNextJsSrcApp: fs.existsSync(path.join(workspaceRoot, "src", "app")),
      env_EXPO_USE_METRO_WORKSPACE_ROOT: process.env.EXPO_USE_METRO_WORKSPACE_ROOT || null,
      env_EAS_BUILD: process.env.EAS_BUILD || null,
    },
    timestamp: Date.now(),
  };
  // Try local file write first (works on cloud builder filesystem)
  try {
    fs.appendFileSync(
      path.join(projectRoot, ".aurafit-debug.log"),
      JSON.stringify(payload) + "\n",
    );
  } catch {}
  // Also POST when running locally (cloud builder won't reach 127.0.0.1:7717 — that's fine)
  fetch("http://127.0.0.1:7717/ingest/8a77d6d8-834f-4f42-ac01-0cc8761305b6", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a5c909" },
    body: JSON.stringify(payload),
  }).catch(() => {});
} catch {}
// #endregion

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = withNativeWind(config, { input: "./global.css" });
