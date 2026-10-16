#!/bin/bash
# Creates the two Solveit databases and their least-privilege users (backend/README.md,
# Database MySQL), and lets those users create triggers. The MySQL image runs it once, when the
# volume is still empty. Running it again is safe: it only resets the two users' passwords to
# the current secrets and re-applies the server setting below:
#   docker exec solveit-mysql bash -c 'bash /docker-entrypoint-initdb.d/10-solveit-databases.sh'
# Passwords come from the Docker secrets and never appear in arguments or output.
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
  dev_password="$(read_secret solveit_dev_password)"
  test_password="$(read_secret solveit_test_password)"

  # Underscores are escaped in the grants: in database-level grants MySQL reads `_` as a
  # wildcard, and tests/Support/TestDatabaseGuard.php rejects an unescaped grant.
  # log_bin_trust_function_creators: with binary logging on (the MySQL 8.4 default), only this
  # lets the non-SUPER users create the append-only triggers of admin_audit_events (B3.1a).
  # SET PERSIST survives restarts (stored in the data volume, mysqld-auto.cnf).
  mysql --defaults-extra-file=<(printf '[client]\nuser=root\npassword=%s\n' "$root_password") --protocol=socket <<SQL
SET PERSIST log_bin_trust_function_creators = ON;
CREATE DATABASE IF NOT EXISTS solveit_indonesia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS solveit_indonesia_testing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'solveit_dev'@'%' IDENTIFIED BY '${dev_password}';
ALTER USER 'solveit_dev'@'%' IDENTIFIED BY '${dev_password}';
GRANT ALL PRIVILEGES ON \`solveit\_indonesia\`.* TO 'solveit_dev'@'%';
CREATE USER IF NOT EXISTS 'solveit_test'@'%' IDENTIFIED BY '${test_password}';
ALTER USER 'solveit_test'@'%' IDENTIFIED BY '${test_password}';
GRANT ALL PRIVILEGES ON \`solveit\_indonesia\_testing\`.* TO 'solveit_test'@'%';
SQL

  echo "solveit: databases solveit_indonesia, solveit_indonesia_testing and users solveit_dev, solveit_test are ready"
)
