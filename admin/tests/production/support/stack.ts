import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * The running production Docker stack under test (playwright.production.config.ts). The admin
 * origin must equal ADMIN_URL in the stack's env file; CI and the local guide use
 * https://admin.solveit.test:8443, a reserved test name that never resolves on the internet.
 */
export const PRODUCTION_ADMIN_ORIGIN =
  process.env.SOLVEIT_ADMIN_URL ?? "https://admin.solveit.test:8443";

export const productionAdminHost = () => new URL(PRODUCTION_ADMIN_ORIGIN).hostname;

const repository = fileURLToPath(new URL("../../../../", import.meta.url));

/** `docker compose` on the stack's project, files, and profiles; environment inherited. */
function compose(args: string[]): string {
  return execFileSync(
    "docker",
    [
      "compose",
      "-p",
      process.env.SOLVEIT_PROD_PROJECT ?? "solveit-indonesia-prod",
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
 * says, and returns the activation link in memory. Errors never include the command output,
 * which holds the link.
 */
export function bootstrapOwner(email: string): string {
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
    .find((line) => line.startsWith(`${PRODUCTION_ADMIN_ORIGIN}/access#token=`));

  if (link === undefined) {
    throw new Error("admin:bootstrap-owner printed no activation link for the admin origin.");
  }

  return link;
}
