import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const TRIAL_RESULT_PATH = join(
  process.cwd(),
  "..",
  "agents",
  "judge",
  "output",
  "trial-result.json",
);

export async function GET() {
  if (existsSync(TRIAL_RESULT_PATH)) {
    try {
      const data = JSON.parse(readFileSync(TRIAL_RESULT_PATH, "utf-8"));
      return NextResponse.json({ source: "live", ...data });
    } catch {
      return NextResponse.json({ source: "mock" }, { status: 200 });
    }
  }
  return NextResponse.json({ source: "mock" }, { status: 200 });
}
