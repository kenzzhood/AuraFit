import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const wasmSrc = path.join(root, "node_modules/@mediapipe/tasks-vision/wasm");
const wasmDst = path.join(root, "public/mediapipe/wasm");
const files = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

if (existsSync(wasmSrc)) {
  mkdirSync(wasmDst, { recursive: true });
  for (const file of files) {
    const from = path.join(wasmSrc, file);
    if (existsSync(from)) cpSync(from, path.join(wasmDst, file));
  }
} else {
  console.warn("MediaPipe wasm was not found. Run npm install first.");
}

const model = path.join(root, "public/mediapipe/hand_landmarker.task");
if (!existsSync(model)) {
  console.warn("Missing public/mediapipe/hand_landmarker.task — hand tracking needs that file.");
}

process.env.STALL_MODE = "true";
process.env.ALLOW_UNAUTHENTICATED_DEV = "true";
process.env.NEXT_TELEMETRY_DISABLED = "1";

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(command, ["next", "dev", "-p", "3000"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

child.on("exit", (code) => process.exit(code ?? 0));
