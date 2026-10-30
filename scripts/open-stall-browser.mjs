import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const url = "http://localhost:3000/stall";
const probe = "http://127.0.0.1:3000/stall";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForStall() {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(probe, { redirect: "follow" });
      if (response.status < 500) return true;
    } catch {
      // Server is still starting.
    }
    await sleep(1000);
  }
  return false;
}

function chromePaths() {
  if (process.platform !== "win32") return [];
  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const localAppData = process.env.LocalAppData || "";
  const candidates = [
    path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
  ];
  if (localAppData) {
    candidates.push(path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"));
  }
  return candidates;
}

function openDetached(command, args) {
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

function openBrowser() {
  const chrome = chromePaths().find((file) => existsSync(file));
  if (chrome) {
    const profile = path.join(process.env.TEMP || process.env.TMP || ".", "autofit-stall-chrome");
    openDetached(chrome, [
      `--user-data-dir=${profile}`,
      "--kiosk",
      "--no-first-run",
      "--disable-session-crashed-bubble",
      "--disable-features=Translate",
      url,
    ]);
    console.log("Opened Chrome in kiosk mode.");
    return;
  }
  if (process.platform === "win32") {
    openDetached("cmd.exe", ["/c", "start", "", url]);
    console.log("Chrome was not found. Opened the default browser.");
    return;
  }
  const command = process.platform === "darwin" ? "open" : "xdg-open";
  openDetached(command, [url]);
}

const ready = await waitForStall();
if (!ready) {
  console.error("The stall did not respond at " + url + ". Check the server window.");
  process.exit(1);
}
openBrowser();
