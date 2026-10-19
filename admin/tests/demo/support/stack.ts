import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The running demo rehearsal stack under test (playwright.demo.config.ts, B5a): the stack that
 * infra/docker/scripts/manage-demo.sh started, in local mode (TLS listener on
 * https://admin.<project>.localhost:<port>) or tunnel mode (ADMIN_URL a Quick Tunnel host,
 * reached here through the edge stand-in in edge.ts, never through Cloudflare).
 *
 * It bootstraps an owner, so it refuses the owner's own demo project `solveit-demo`: only a
 * rehearsal project `solveit-demo-<suffix>` with its own state folder. manage-demo.sh runs the
 * demo guard (check-demo-stack.sh) before it acts.
 */
const REHEARSAL_PROJECT = /^solveit-demo-[a-z0-9]+$/;
const TUNNEL_ORIGIN = /^https:\/\/[a-z0-9]+(-[a-z0-9]+)+\.trycloudflare\.com$/;

export interface DemoTarget {
  project: string;
  home: string;
  origin: string;
  mode: "local" | "tunnel";
  adminPort: number;
  tlsPort: number;
  /** The loopback port of the edge stand-in (tunnel mode). */
  edgePort: number;
}

export function demoTarget(): DemoTarget {
  const project = process.env.SOLVEIT_DEMO_PROJECT ?? "";
  const home = process.env.SOLVEIT_DEMO_HOME ?? "";

  if (!REHEARSAL_PROJECT.test(project)) {
    throw new Error(
      `SOLVEIT_DEMO_PROJECT must be a rehearsal project solveit-demo-<suffix>, got "${project}"; the owner's demo is never used by a test.`,
    );
  }

  if (home === "") {
    throw new Error("SOLVEIT_DEMO_HOME is not set: the rehearsal stack's state folder.");
  }

  const origin =
    readFileSync(`${home}/demo.env`, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.startsWith("ADMIN_URL="))
      .pop()
      ?.slice("ADMIN_URL=".length) ?? "";
  const local = new RegExp(`^https://admin\\.${project}\\.localhost:\\d+$`);

  if (!TUNNEL_ORIGIN.test(origin) && !local.test(origin)) {
    throw new Error(`demo.env holds no demo admin origin ("${origin}").`);
  }

  return {
    project,
    home,
    origin,
    mode: TUNNEL_ORIGIN.test(origin) ? "tunnel" : "local",
    adminPort: Number(process.env.SOLVEIT_DEMO_ADMIN_PORT ?? 8190),
    tlsPort: Number(process.env.SOLVEIT_DEMO_TLS_PORT ?? 8543),
    edgePort: Number(process.env.SOLVEIT_DEMO_EDGE_PORT ?? 8643),
  };
}

const repository = fileURLToPath(new URL("../../../../", import.meta.url));

function manageDemo(args: string[]): string {
  return execFileSync("bash", [`${repository}infra/docker/scripts/manage-demo.sh`, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** The demo guard on the running stack; throws with its reason when it refuses. */
export function assertDemoStack(): void {
  demoTarget();

  try {
    execFileSync("bash", [`${repository}infra/docker/scripts/check-demo-stack.sh`, "stack"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const reason = String((error as { stderr?: unknown }).stderr ?? "")
      .split("\n")
      .find((line) => line.startsWith("REFUSED:"));

    throw new Error(`The demo guard refused: ${reason ?? "no readable reason"}`);
  }
}

/**
 * The owner's real command (`manage-demo owner <email>`), as the runbook tells the owner to run
 * it. Returns the activation link in memory; errors never include the output, which holds it.
 */
export function bootstrapDemoOwner(email: string): string {
  const { origin } = demoTarget();
  let output: string;

  try {
    output = manageDemo(["owner", email]);
  } catch {
    throw new Error("manage-demo owner failed (output withheld: it may hold a link).");
  }

  const link = output
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith(`${origin}/access#token=`));

  if (link === undefined) {
    throw new Error("manage-demo owner printed no activation link for the demo origin.");
  }

  return link;
}
