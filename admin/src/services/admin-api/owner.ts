/**
 * The owner administration API (B3.2c; docs/api/admin-users.md) on the console's one client.
 * Only owner screens and their components import this barrel, so this code and these types
 * travel in the lazy owner chunks (initial JavaScript budget, admin-dashboard.md section 8).
 */
import { createAdministrationApi } from "./administration";
import { adminApi } from "./index";

export {
  ADMIN_PAGE_SIZE,
  createAdministrationApi,
  type AdministrationApi,
  type PageRequest,
} from "./administration";
export * from "./owner-contracts";

export const administrationApi = createAdministrationApi(adminApi);
