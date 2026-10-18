#!/usr/bin/env node
// Starts Laravel for the real-browser tests, in this order, failing closed at each step:
// 1. the safety gate (backend/tests/E2E/harness.php gate): APP_ENV=testing, the database
//    solveit_indonesia_testing selected by the server, a user limited to it, no DB_URL;
// 2. migrate:fresh on that database only;
// 3. the PHP built-in server on 127.0.0.1:8100 with the gated router (backend/tests/E2E/
//    server.php), which repeats the gate on every request.
// Started by playwright.integration.config.ts; output is the gate summary, never a secret.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  BACKEND_DIR,
  CLOCK_FILE,
  HARNESS,
  LARAVEL_HOST,
  LARAVEL_PORT,
  ROUTER,
  harnessEnvironment,
} from "./env.mjs";

const env = harnessEnvironment();
const php = process.env.SOLVEIT_E2E_PHP ?? "php";

function harness(command) {
  let output;

  try {
    output = execFileSync(php, [HARNESS, command], { cwd: BACKEND_DIR, env, encoding: "utf8" });
  } catch (error) {
    output = String(error.stdout ?? "");
  }

  const answer = JSON.parse(output.trim().split("\n").pop() || "{}");

  if (answer.ok !== true) {
    console.error(`E2E harness "${command}" refused: ${answer.reason ?? "no answer"}`);
    process.exit(1);
  }

  return answer;
}

const gate = harness("gate");
console.log(
  `E2E safety gate passed: APP_ENV=${gate.environment}, database ${gate.database}, MySQL ${gate.mysql}, grants ${gate.grants}`,
);
harness("fresh");
console.log("E2E database migrated fresh (testing database only)");

mkdirSync(dirname(CLOCK_FILE), { recursive: true });
writeFileSync(CLOCK_FILE, JSON.stringify({ offset_seconds: 0 }));

const server = spawn(
  php,
  ["-S", `${LARAVEL_HOST}:${LARAVEL_PORT}`, "-t", join(BACKEND_DIR, "public"), ROUTER],
  { cwd: join(BACKEND_DIR, "public"), env, stdio: ["ignore", "ignore", "inherit"] },
);

const stop = () => server.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("exit", stop);
server.on("exit", (code) => process.exit(code ?? 0));
