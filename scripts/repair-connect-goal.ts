import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  getDailyGoalsState,
  repairTodayConnectGoalBaseline
} from "../lib/db/repository";

type ScriptMode = "dry-run" | "apply";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv: string[]) {
  let mode: ScriptMode = "dry-run";
  let target = 10;
  let count = 0;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--apply") {
      mode = "apply";
      continue;
    }

    if (value === "--dry-run") {
      mode = "dry-run";
      continue;
    }

    if (value === "--target") {
      const rawTarget = Number(argv[index + 1]);
      if (!Number.isNaN(rawTarget) && rawTarget > 0) {
        target = Math.trunc(rawTarget);
      }
      index += 1;
      continue;
    }

    if (value === "--count") {
      const rawCount = Number(argv[index + 1]);
      if (!Number.isNaN(rawCount) && rawCount >= 0) {
        count = Math.trunc(rawCount);
      }
      index += 1;
    }
  }

  return { mode, target, count };
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  const { mode, target, count } = parseArgs(process.argv.slice(2));

  const before = await getDailyGoalsState();
  const nextConnect = { count, target };

  if (mode === "dry-run") {
    console.log("Connect goal repair (DRY RUN)");
    console.log(`Date key: ${before.dateKey}`);
    console.log(
      `Current: ${before.goals.connect.count}/${before.goals.connect.target}`
    );
    console.log(`Planned: ${nextConnect.count}/${nextConnect.target}`);
    console.log("No changes applied.");
    return;
  }

  const after = await repairTodayConnectGoalBaseline(nextConnect);
  console.log("Connect goal repair (APPLY)");
  console.log(`Date key: ${after.dateKey}`);
  console.log(
    `Updated: ${after.goals.connect.count}/${after.goals.connect.target}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

