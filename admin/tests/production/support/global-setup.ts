import { assertSyntheticStack } from "./stack";

/** Before any browser starts: the stack must pass the synthetic-stack guard (fail closed). */
export default function globalSetup(): void {
  assertSyntheticStack();
}
