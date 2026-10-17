import { createHmac } from "node:crypto";

/**
 * RFC 6238 TOTP (SHA-1, 6 digits, 30 s), as the synthetic person's authenticator app. Laravel
 * (Fortify, window 1) accepts the previous, current, and next step and refuses a code it has
 * already seen, so `freshTotp` hands out each step at most once per secret, waiting for the
 * next step only when both usable ones are spent.
 */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32(secret: string): Buffer {
  let bits = "";

  for (const character of secret.replace(/[\s=]/g, "").toUpperCase()) {
    const value = ALPHABET.indexOf(character);

    if (value === -1) {
      throw new Error("The setup key is not base32.");
    }

    bits += value.toString(2).padStart(5, "0");
  }

  const bytes = [];

  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }

  return Buffer.from(bytes);
}

export function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", base32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;

  return String(value).padStart(6, "0");
}

const currentStep = () => Math.floor(Date.now() / 30_000);
const spent = new Map<string, Set<number>>();

export async function freshTotp(secret: string): Promise<string> {
  for (;;) {
    const now = currentStep();
    const used = spent.get(secret) ?? new Set<number>();
    spent.set(secret, used);

    for (const step of [now, now + 1]) {
      if (!used.has(step)) {
        used.add(step);

        return totpAt(secret, step);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, (now + 1) * 30_000 - Date.now() + 250));
  }
}

/** A code that is certainly wrong for this secret right now. */
export function wrongTotp(secret: string): string {
  const now = currentStep();
  const valid = new Set([now - 1, now, now + 1, now + 2].map((step) => totpAt(secret, step)));
  let candidate = 0;

  while (valid.has(String(candidate).padStart(6, "0"))) {
    candidate += 1;
  }

  return String(candidate).padStart(6, "0");
}
