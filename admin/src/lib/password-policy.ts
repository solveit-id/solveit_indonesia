/**
 * The backend's password rule for admin accounts (backend/app/Providers/AppServiceProvider.php,
 * App\Rules\MaxBytes): at least 12 characters, at most 72 bytes in UTF-8 (bcrypt reads no
 * further), confirmed. Checked here only to answer sooner; Laravel decides, and its 422 wins.
 */
export const PASSWORD_MIN_CHARACTERS = 12;
export const PASSWORD_MAX_BYTES = 72;

export type PasswordProblem = "too-short" | "too-long" | "mismatch";

/** Characters as Laravel's `min` counts them (code points, like mb_strlen). */
export const characterCount = (value: string): number => [...value].length;

export const byteCount = (value: string): number => new TextEncoder().encode(value).length;

export function newPasswordProblem(password: string, confirmation: string): PasswordProblem | null {
  if (characterCount(password) < PASSWORD_MIN_CHARACTERS) {
    return "too-short";
  }

  if (byteCount(password) > PASSWORD_MAX_BYTES) {
    return "too-long";
  }

  return password === confirmation ? null : "mismatch";
}

/** Six digits, after removing the spaces and dashes some authenticator apps show or paste. */
export function normaliseTotp(value: string): string | null {
  const digits = value.replace(/[\s-]/g, "");

  return /^\d{6}$/.test(digits) ? digits : null;
}
