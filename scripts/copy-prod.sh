#!/usr/bin/env bash
# Copies the production database (myjobbot) into a local dev database, replacing every table
# there. Production is read with its own read-only login (MYJOBBOT_COPY_DB_USER/_PASSWORD); the
# target is written with the checkout's MYJOBBOT_DB_USER. Nothing from .env is ever printed.
set -euo pipefail
cd "$(dirname "$0")/.."

SOURCE=myjobbot

usage() {
  echo "usage: scripts/copy-prod.sh myjobbot_dev|myjobbot_dev_alt [--yes]" >&2
  exit 2
}

target=${1:-}
case "$target" in
  myjobbot_dev | myjobbot_dev_alt) ;;
  *) usage ;;
esac
[ $# -le 2 ] && { [ $# -lt 2 ] || [ "$2" = "--yes" ]; } || usage

env_value() {
  local line
  line=$(grep -m1 "^$1=" .env 2>/dev/null || true)
  line=${line#*=}
  line=${line%$'\r'}
  line=${line%\"}
  line=${line#\"}
  printf '%s' "$line"
}

need() {
  [ -n "$(env_value "$1")" ] || { echo "copy-prod: $1 is not set in .env" >&2; exit 1; }
}

for name in MYJOBBOT_DB_HOST MYJOBBOT_DB_USER MYJOBBOT_DB_PASSWORD MYJOBBOT_COPY_DB_USER MYJOBBOT_COPY_DB_PASSWORD; do need "$name"; done

# Passwords go in option files readable only by this user, never on a command line.
read_cnf=$(mktemp)
write_cnf=$(mktemp)
trap 'rm -f "$read_cnf" "$write_cnf"' EXIT

option_file() {
  local password=${3//\\/\\\\}
  printf '[client]\nhost=%s\nport=%s\nuser=%s\npassword="%s"\n' "$(env_value MYJOBBOT_DB_HOST)" "${port:-3306}" "$1" "${password//\"/\\\"}" > "$2"
}

port=$(env_value MYJOBBOT_DB_PORT)
option_file "$(env_value MYJOBBOT_COPY_DB_USER)" "$read_cnf" "$(env_value MYJOBBOT_COPY_DB_PASSWORD)"
option_file "$(env_value MYJOBBOT_DB_USER)" "$write_cnf" "$(env_value MYJOBBOT_DB_PASSWORD)"

if [ "${2:-}" != "--yes" ]; then
  read -r -p "Replace every table in $target with a copy of $SOURCE? Type $target to go on: " answer
  [ "$answer" = "$target" ] || { echo "copy-prod: nothing changed" >&2; exit 1; }
fi

# MySQL 8 clients ask a MariaDB server for column statistics and GTIDs it doesn't have.
dump_flags=(--single-transaction --no-tablespaces --default-character-set=utf8mb4)
if mysqldump --help 2>/dev/null | grep -q -- "--column-statistics"; then
  dump_flags+=(--skip-column-statistics --set-gtid-purged=OFF)
fi

# Tables a branch's newer migration added would otherwise survive with no migration record.
tables=$(mysql --defaults-extra-file="$write_cnf" -N -B -e "SELECT table_name FROM information_schema.tables WHERE table_schema = '$target'")
if [ -n "$tables" ]; then
  drops=$(printf 'DROP TABLE IF EXISTS `%s`;' $tables)
  mysql --defaults-extra-file="$write_cnf" "$target" -e "SET FOREIGN_KEY_CHECKS = 0; $drops"
fi

mysqldump --defaults-extra-file="$read_cnf" "${dump_flags[@]}" "$SOURCE" | mysql --defaults-extra-file="$write_cnf" --default-character-set=utf8mb4 "$target"

summary=$(mysql --defaults-extra-file="$write_cnf" -N -B "$target" -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE(); SELECT COUNT(*) FROM jobs; SELECT MAX(name) FROM kysely_migration" | tr '\n' ' ')
read -r table_count job_count last_step <<< "$summary"
echo "copied $SOURCE into $target: $table_count tables, $job_count jobs, last step $last_step"
echo "The copied Gmail connection only opens if this .env's MYJOBBOT_SECRET_KEY is the one production uses."
