import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const WASM_FILES = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

/** Copied into public/ so the browser loads MediaPipe with no CDN. */
function copyMediaPipeWasm() {
  const wasmSrc = path.join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
  const wasmDst = path.join(root, "public", "mediapipe", "wasm");
  if (!existsSync(wasmSrc)) {
    console.warn("MediaPipe wasm was not found. Run npm install in this folder first.");
    return false;
  }
  mkdirSync(wasmDst, { recursive: true });
  let copied = 0;
  for (const file of WASM_FILES) {
    const from = path.join(wasmSrc, file);
    if (!existsSync(from)) continue;
    cpSync(from, path.join(wasmDst, file));
    copied += 1;
  }
  if (copied === 0) {
    console.warn("MediaPipe wasm folder was empty. Run npm install again.");
    return false;
  }
  return true;
}

function stallEnv() {
  const env = { ...process.env };
  env.STALL_MODE = "true";
  env.ALLOW_UNAUTHENTICATED_DEV = "true";
  env.NEXT_TELEMETRY_DISABLED = "1";
  // A copied .env.example contains placeholder service URLs. Empty values win
  // over .env, so the stall does not dial Postgres, Redis, Clerk, or analytics.
  for (const key of [
    "DATABASE_URL",
    "DIRECT_URL",
    "REDIS_URL",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "INNGEST_EVENT_KEY",
    "INNGEST_SIGNING_KEY",
    "NEXT_PUBLIC_GA_MEASUREMENT_ID",
    "NEXT_PUBLIC_CLARITY_PROJECT_ID",
    "NEXT_PUBLIC_MIXPANEL_TOKEN",
    "NEXT_PUBLIC_POSTHOG_KEY",
    "NEXT_PUBLIC_POSTHOG_HOST",
  ]) {
    env[key] = "";
  }
  return env;
}

const prepareOnly = process.argv.includes("--prepare-only");
const wasmOk = copyMediaPipeWasm();
const model = path.join(root, "public", "mediapipe", "hand_landmarker.task");
if (!existsSync(model)) {
  console.warn("Missing public/mediapipe/hand_landmarker.task — hand tracking needs that file.");
}
if (prepareOnly) {
  process.exit(wasmOk && existsSync(model) ? 0 : 1);
}

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
if (!existsSync(nextBin)) {
  console.error("Next.js is not installed. In this folder run: npm install");
  process.exit(1);
}

console.log("Autofit stall: http://localhost:3000/stall");
console.log("Clerk, Postgres, and Redis are not used. Close this window to stop.");

const child = spawn(process.execPath, [nextBin, "dev", "--hostname", "127.0.0.1", "--port", "3000"], {
  cwd: root,
  env: stallEnv(),
  stdio: "inherit",
  windowsHide: false,
});

child.on("error", (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

function stopChild() {
  if (!child.killed) child.kill();
}

process.on("SIGINT", () => {
  stopChild();
});
process.on("SIGTERM", () => {
  stopChild();
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
