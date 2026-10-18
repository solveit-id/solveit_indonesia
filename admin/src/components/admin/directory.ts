import { useEffect, useState } from "react";
import type { OwnerCopy } from "~/i18n/owner";
import { type AdminUser, administrationApi } from "~/services/admin-api/owner";

/**
 * How an account is named on screen. An invited account has no name until the person accepts
 * and sets it (Laravel stores an empty string), so its address stands in; never a blank link.
 */
export const accountName = (account: { name: string; email: string }): string =>
  account.name.trim() === "" ? account.email : account.name;

/** The largest page Laravel serves; the directory reads one page and says nothing beyond it. */
const DIRECTORY_SIZE = 100;

export type AccountDirectory = ReadonlyMap<number, Pick<AdminUser, "id" | "name" | "email">>;

/**
 * Names for the account IDs the API returns (`issued_by_user_id`, audit actors and subjects):
 * the first 100 admin accounts from `GET users`, read when the screen opens and kept in that
 * screen's memory only. While it loads, if it fails, or for an ID beyond it, the ID is shown
 * as "Account #7": never a guessed name. Accounts without a role are never listed by Laravel.
 */
export function useAccountDirectory(enabled = true): AccountDirectory | null {
  const [directory, setDirectory] = useState<AccountDirectory | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const controller = new AbortController();

    administrationApi.listUsers({}, { perPage: DIRECTORY_SIZE, signal: controller.signal }).then(
      (page) =>
        setDirectory(
          new Map(
            page.data.map(
              (entry) =>
                [entry.id, { id: entry.id, name: accountName(entry), email: entry.email }] as const,
            ),
          ),
        ),
      () => undefined,
    );

    return () => controller.abort();
  }, [enabled]);

  return directory;
}

/** How an account ID reads on screen: "You", its name, or "Account #7". */
export function accountLabel(
  id: number,
  directory: AccountDirectory | null,
  currentId: number,
  t: OwnerCopy,
): string {
  if (id === currentId) {
    return t.owner.you;
  }

  return directory?.get(id)?.name ?? t.owner.accountNumber(id);
}
