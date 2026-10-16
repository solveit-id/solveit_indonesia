#!/bin/bash
# Creates the production database and its two least-privilege users for the bundled MySQL
# (infra/docker/compose.prod.yaml, profile bundled-db). The MySQL image runs it once, when the
# data volume is still empty. Passwords come from Docker secrets and never appear in output.
#   solveit_migrator  schema changes (DDL) and data, only on solveit_indonesia; used by `migrate`
#   solveit_app       SELECT, INSERT, UPDATE, DELETE only, on solveit_indonesia; used by `backend`
# The local development database is a different setup: backend/docker/mysql/.
(
  set -euo pipefail

  read_secret() {
    local value
    value="$(cat "/run/secrets/$1")"
    if [[ ! "$value" =~ ^[A-Za-z0-9]{32,}$ ]]; then
      echo "solveit: secret $1 must be at least 32 letters or digits" >&2
      exit 1
    fi
    printf '%s' "$value"
  }

  root_password="$(read_secret mysql_root_password)"
  migrator_password="$(read_secret db_migrator_password)"
  app_password="$(read_secret db_app_password)"

  # Escaped underscore: in database-level grants MySQL reads `_` as a wildcard.
  # log_bin_trust_function_creators: lets solveit_migrator (no SUPER) create the append-only
  # triggers of admin_audit_events while binary logging is on; persisted in the data volume.
  mysql --defaults-extra-file=<(printf '[client]\nuser=root\npassword=%s\n' "$root_password") --protocol=socket <<SQL
SET PERSIST log_bin_trust_function_creators = ON;
CREATE DATABASE IF NOT EXISTS solveit_indonesia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'solveit_migrator'@'%' IDENTIFIED BY '${migrator_password}';
ALTER USER 'solveit_migrator'@'%' IDENTIFIED BY '${migrator_password}';
GRANT ALL PRIVILEGES ON \`solveit\_indonesia\`.* TO 'solveit_migrator'@'%';
CREATE USER IF NOT EXISTS 'solveit_app'@'%' IDENTIFIED BY '${app_password}';
ALTER USER 'solveit_app'@'%' IDENTIFIED BY '${app_password}';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`solveit\_indonesia\`.* TO 'solveit_app'@'%';
SQL

  echo "solveit: database solveit_indonesia and users solveit_migrator, solveit_app are ready"
)
