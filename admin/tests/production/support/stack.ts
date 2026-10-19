import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * The running production Docker stack under test (playwright.production.config.ts). It must be
 * a throwaway stack with synthetic data: this harness bootstraps the first owner there. Nothing
 * has a default. SOLVEIT_PROD_PROJECT names the project; SOLVEIT_ADMIN_URL is the admin origin,
 * on a reserved .test host that never resolves on the internet (CI and the local guide use
 * https://admin.solveit.test:8443) and must equal the backend's ADMIN_URL.
 * infra/docker/scripts/check-synthetic-stack.sh decides the rest (fail closed).
 */
const TEST_ORIGIN = /^https:\/\/[a-z0-9.-]+\.test(:\d+)?$/;

export function productionTarget(): { project: string; origin: string } {
  const project = process.env.SOLVEIT_PROD_PROJECT ?? "";
  const origin = process.env.SOLVEIT_ADMIN_URL ?? "";

  if (project === "") {
    throw new Error("SOLVEIT_PROD_PROJECT is not set: name the throwaway stack explicitly.");
  }

  if (!TEST_ORIGIN.test(origin)) {
    throw new Error(
      `SOLVEIT_ADMIN_URL must be an https origin on a reserved .test host, got "${origin}".`,
    );
  }

  return { project, origin };
}

const repository = fileURLToPath(new URL("../../../../", import.meta.url));

/**
 * Runs the read-only guard (throwaway project, temporary env file and secrets, the project's
 * own MySQL volume, test origins, loopback ports, synthetic data). Throws with the guard's
 * reason when it refuses; its output names Docker objects and origins only, never secrets.
 */
export function assertSyntheticStack(): void {
  productionTarget();

  try {
    execFileSync("bash", [`${repository}infra/docker/scripts/check-synthetic-stack.sh`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const reason = String((error as { stderr?: unknown }).stderr ?? "")
      .split("\n")
      .find((line) => line.startsWith("REFUSED:"));

    throw new Error(`The synthetic-stack guard refused: ${reason ?? "no readable reason"}`);
  }
}

/** `docker compose` on the stack's project, files, and profiles; environment inherited. */
function compose(args: string[]): string {
  return execFileSync(
    "docker",
    [
      "compose",
      "-p",
      productionTarget().project,
      "-f",
      `${repository}infra/docker/compose.prod.yaml`,
      "-f",
      `${repository}infra/docker/compose.prod.admin-tls.yaml`,
      "--profile",
      "bundled-db",
      "--profile",
      "admin",
      ...args,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}

/**
 * Creates the first owner with the real command on the server shell, as the deployment guide
 * says, and returns the activation link in memory. The guard runs again right before, so a
 * stack that changed since the global setup is refused too. Errors never include the command
 * output, which holds the link.
 */
export function bootstrapOwner(email: string): string {
  assertSyntheticStack();
  const { origin } = productionTarget();
  let output: string;

  try {
    output = compose([
      "exec",
      "-T",
      "backend",
      "php",
      "artisan",
      "admin:bootstrap-owner",
      email,
      "--force",
      "--no-interaction",
    ]);
  } catch {
    throw new Error("admin:bootstrap-owner failed (output withheld: it may hold a link).");
  }

  const link = output
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith(`${origin}/access#token=`));

  if (link === undefined) {
    throw new Error("admin:bootstrap-owner printed no activation link for the admin origin.");
  }

  return link;
}
