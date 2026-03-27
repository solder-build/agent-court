#!/usr/bin/env npx tsx
// =============================================================================
// Agent Court — Playwright Demo Recorder
// =============================================================================
// Records a 90-second walkthrough of the courtroom UI.
// Output: scripts/output/demo.webm (ready to upload to YouTube)
//
// Usage:
//   cd agent-court
//   npx tsx scripts/record-demo.ts
//
// Requirements: dev server must be running at localhost:3000
// =============================================================================

import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "output");
mkdirSync(OUTPUT_DIR, { recursive: true });

const BASE_URL = "http://localhost:3000/court";
const VIEWPORT = { width: 1920, height: 1080 };

// Pause helper
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("Launching browser...");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: {
      dir: OUTPUT_DIR,
      size: VIEWPORT,
    },
  });

  const page = await context.newPage();

  console.log(`Navigating to ${BASE_URL}...`);
  await page.goto(BASE_URL, { waitUntil: "networkidle" });

  // Wait for the live data fetch to complete (API call on mount)
  await wait(2000);

  // ── SCENE 1: Case Filing ────────────────────────────────────────────────────
  console.log("Scene 1: Case Filing...");

  // Pause on the filing phase — let the viewer read the case
  await wait(4000);

  // Scroll down slightly to show escrow card
  await page.evaluate(() => window.scrollBy(0, 100));
  await wait(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(1000);

  // ── SCENE 2: Evidence Gathering ────────────────────────────────────────────
  console.log("Scene 2: Evidence...");
  await page.getByRole("button", { name: /Begin Evidence Gathering/i }).click();
  await wait(500);

  // Let evidence panels animate in
  await wait(4000);

  // Scroll to show all 3 panels
  await page.evaluate(() => window.scrollBy(0, 200));
  await wait(2000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(500);

  // ── SCENE 3: Cross-Examination ─────────────────────────────────────────────
  console.log("Scene 3: Cross-Examination...");
  await page.getByRole("button", { name: /Proceed to Cross-Examination/i }).click();
  await wait(500);

  // Scroll through the cross-exam messages slowly
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 180));
    await wait(900);
  }
  await wait(1000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(500);

  // ── SCENE 4: Deliberation ──────────────────────────────────────────────────
  console.log("Scene 4: Deliberation...");
  await page.getByRole("button", { name: /Enter Deliberation/i }).click();
  await wait(500);

  // Let judge panels animate in one by one (1.2s delay each)
  await wait(5000);

  // Scroll to show all reasoning
  await page.evaluate(() => window.scrollBy(0, 150));
  await wait(2000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(500);

  // ── SCENE 5: Verdict ───────────────────────────────────────────────────────
  console.log("Scene 5: Verdict...");
  await page.getByRole("button", { name: /Deliver Verdict/i }).click();
  await wait(500);

  // Let verdict slam animation play
  await wait(4000);

  // Scroll to show full verdict + dissent
  await page.evaluate(() => window.scrollBy(0, 300));
  await wait(2500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(500);

  // ── SCENE 6: Settlement ────────────────────────────────────────────────────
  console.log("Scene 6: Settlement...");

  // Scroll down to find the settle button (it appears after verdict animation)
  await page.evaluate(() => window.scrollBy(0, 400));
  await wait(1000);

  // Click Execute Settlement button
  const settleButton = page.getByRole("button", { name: /Execute Settlement/i });
  await settleButton.waitFor({ timeout: 15000 });
  await settleButton.click();
  await wait(500);

  // Let settlement card animate in
  await wait(3000);

  // Scroll to show full settlement card
  await page.evaluate(() => window.scrollBy(0, 200));
  await wait(3000);

  // ── END ────────────────────────────────────────────────────────────────────
  console.log("Recording complete. Closing browser...");
  await wait(1000);

  const videoPath = await page.video()?.path();
  await context.close();
  await browser.close();

  if (videoPath) {
    console.log(`\nVideo saved to: ${videoPath}`);
    console.log(`\nTo convert to MP4 for YouTube:`);
    console.log(`  ffmpeg -i "${videoPath}" -c:v libx264 -pix_fmt yuv420p scripts/output/demo.mp4`);
  } else {
    console.log("Video path not available — check scripts/output/ for .webm file");
  }
}

main().catch((err) => {
  console.error("Recording failed:", err);
  process.exit(1);
});
