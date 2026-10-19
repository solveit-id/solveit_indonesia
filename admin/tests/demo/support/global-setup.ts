import { startEdge } from "./edge";
import { assertDemoStack, demoTarget } from "./stack";

/**
 * Before any browser starts: the rehearsal stack must pass the demo guard (fail closed). In
 * tunnel mode the edge stand-in runs for the whole run and stops at teardown.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  assertDemoStack();
  const target = demoTarget();

  if (target.mode === "local") {
    return async () => undefined;
  }

  const edge = await startEdge(new URL(target.origin).hostname, target.edgePort, target.adminPort);

  return () => new Promise<void>((resolve) => edge.close(() => resolve()));
}
