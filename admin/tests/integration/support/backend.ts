import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { BACKEND_DIR, CLOCK_FILE, HARNESS, harnessEnvironment } from "./env.mjs";

/**
 * The PHP side of the harness (backend/tests/E2E/harness.php). Each call passes the safety
 * gate again. Links come back in memory and are never printed: errors name the command only.
 */
function harness(command: string, argument?: string): Record<string, unknown> {
  const args = [HARNESS, command, ...(argument === undefined ? [] : [argument])];
  let output: string;

  try {
    output = execFileSync(process.env.SOLVEIT_E2E_PHP ?? "php", args, {
      cwd: BACKEND_DIR,
      env: harnessEnvironment(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    output = String((error as { stdout?: unknown }).stdout ?? "");
  }

  let answer: Record<string, unknown> = {};

  try {
    answer = JSON.parse(output.trim().split("\n").pop() ?? "{}") as Record<string, unknown>;
  } catch {
    // Reported below without the output, which could hold a link.
  }

  if (answer.ok !== true) {
    throw new Error(
      `E2E harness "${command}" failed: ${String(answer.reason ?? "no readable answer")}`,
    );
  }

  return answer;
}

/** Empty the testing database (sessions, limiters, used-code cache included) and the clock. */
export function resetBackend(): void {
  setServerClock(0);
  harness("reset");
}

/** `admin:bootstrap-owner`, the real shell command. Returns the one-time activation link. */
export function bootstrapOwner(email: string): string {
  return String(harness("bootstrap-owner", email).url);
}

/** `admin:reset-credentials`, the real emergency shell command. Returns the reset link. */
export function resetCredentials(email: string): string {
  return String(harness("reset-credentials", email).url);
}

/** Move Laravel's clock `seconds` ahead of real time (0 restores it). TOTP keeps real time. */
export function setServerClock(seconds: number): void {
  writeFileSync(CLOCK_FILE, JSON.stringify({ offset_seconds: Math.round(seconds) }));
}

export const tokenOf = (link: string): string => new URL(link).hash.replace(/^#token=/, "");
