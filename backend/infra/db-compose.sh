#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

infra_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mssql_dir="$infra_dir/mssql"
container="livingdocs-mssql"
sqlcmd="/opt/mssql-tools18/bin/sqlcmd"

run_sql() {
  local file="$1" database="$2"
  shift 2
  docker exec "$container" "$sqlcmd" -S localhost -U sa -C -I -b -f 65001 -d "$database" "$@" -i "/scripts/$file"
}

require_container() {
  docker inspect "$container" >/dev/null 2>&1 || {
    echo "SQL container '$container' is not running. Start the Compose mssql service first." >&2
    exit 1
  }
}

run_tenant_migrations() {
  local code="$1" schema="ws_$1" file relative
  for file in "$mssql_dir"/0[1-9]_*/migrations/*.sql; do
    [[ -f "$file" ]] || continue
    relative="${file#"$mssql_dir/"}"
    run_sql "$relative" livingdocs -v "SchemaName=$schema"
  done
}

case "${1:-}" in
  init)
    require_container
    run_sql "00_platform/001_create_database.sql" master
    run_sql "00_platform/002_workspace.sql" livingdocs
    run_sql "00_platform/003_sp_create_workspace.sql" livingdocs
    run_sql "00_platform/004_sp_purge_expired_audit_log.sql" livingdocs
    if ! run_sql "00_platform/005_agent_jobs.sql" master; then
      echo "SQL Server Agent job setup was skipped; the server may have Agent disabled." >&2
    fi
    ;;
  tenant)
    code="${2:-}"
    name="${3:-}"
    [[ "$code" =~ ^[a-z0-9_]{2,30}$ ]] || { echo "Usage: $0 tenant <lowercase-tenant-code> <simple workspace name>" >&2; exit 2; }
    [[ -n "$name" && "$name" != *"'"* && "$name" != *'$('* ]] || { echo "Workspace name must be nonempty and cannot contain quotes or SQLCMD variable syntax." >&2; exit 2; }
    require_container
    schema="ws_$code"
    run_sql "00_platform/010_provision_tenant.sql" livingdocs -v "Code=$code" "TenantName=$name"
    for phase in tables.sql indexes.sql procedures.sql triggers.sql; do
      for file in "$mssql_dir"/0[1-9]_*/"$phase"; do
        [[ -f "$file" ]] || continue
        relative="${file#"$mssql_dir/"}"
        run_sql "$relative" livingdocs -v "SchemaName=$schema"
      done
    done
    run_tenant_migrations "$code"
    ;;
  migrate)
    code="${2:-}"
    [[ "$code" =~ ^[a-z0-9_]{2,30}$ ]] || { echo "Usage: $0 migrate <lowercase-tenant-code>" >&2; exit 2; }
    require_container
    run_tenant_migrations "$code"
    ;;
  seed)
    code="${2:-}"
    [[ "$code" =~ ^[a-z0-9_]{2,30}$ ]] || { echo "Usage: $0 seed <lowercase-tenant-code>" >&2; exit 2; }
    require_container
    for file in "$mssql_dir"/99_seed/*.sql; do
      run_sql "99_seed/${file##*/}" livingdocs -v "SchemaName=ws_$code"
    done
    ;;
  test)
    code="${2:-demo}"
    [[ "$code" =~ ^[a-z0-9_]{2,30}$ ]] || { echo "Usage: $0 test [lowercase-tenant-code]" >&2; exit 2; }
    require_container
    run_tenant_migrations "$code"
    for file in "$mssql_dir"/tests/*.sql; do
      run_sql "tests/${file##*/}" livingdocs -v "SchemaName=ws_$code"
    done
    ;;
  provision-app-user)
    [[ -n "${DB_USER:-}" && -n "${DB_PASSWORD:-}" ]] || {
      echo "Export DB_USER and DB_PASSWORD from the deployment secret store before provisioning." >&2
      exit 2
    }
    [[ "$DB_USER" =~ ^[A-Za-z][A-Za-z0-9_]{2,29}$ ]] || { echo "DB_USER has an invalid format." >&2; exit 2; }
    [[ "$DB_PASSWORD" =~ ^[A-Za-z0-9!_-]{16,128}$ ]] || { echo "DB_PASSWORD must contain 16-128 letters, digits, or !_- characters." >&2; exit 2; }
    require_container
    {
      printf ':setvar AppUser "%s"\n' "$DB_USER"
      printf ':setvar AppPassword "%s"\n' "$DB_PASSWORD"
      printf ':r /scripts/00_platform/011_provision_app_login.sql\n'
    } | docker exec -i "$container" "$sqlcmd" -S localhost -U sa -C -I -b -f 65001 -d master
    ;;
  *)
    echo "Usage: $0 {init|tenant <code> <name>|migrate <code>|seed <code>|test [code]|provision-app-user}" >&2
    exit 2
    ;;
esac
