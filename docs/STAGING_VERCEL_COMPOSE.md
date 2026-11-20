# Staging: Vercel frontend + Docker Compose backend

## Request path

The browser stays on the Vercel origin. Vercel rewrites `/api/*` to the HTTPS API origin; Caddy routes API paths to the internal Compose services. Only Caddy publishes internet-facing ports. App, SQL Server, Kafka, and Redis host ports bind to `127.0.0.1` for operator access and local development.

This keeps auth and CSRF cookies same-origin in the browser. Do not set a Vercel `VITE_API_BASE_URL` for this arrangement.

## Vercel project

Create the Vercel project with `frontend` as its Root Directory. Set `LIVINGDOCS_API_ORIGIN` separately for Preview and Production to the corresponding HTTPS Caddy hostname, for example `https://api.staging.example.com`. The value is read by `frontend/vercel.mjs` when Vercel evaluates its project routing config. Do not include a path or trailing slash.

Set the GitHub OAuth callback URI to the exact frontend URL plus `/auth/callback` in both the GitHub OAuth app and backend `GITHUB_REDIRECT_URI`. Configure the callback separately for staging and production.

## Docker Compose host

Use a Linux VM with Docker Engine and Compose v2. DNS for `API_DOMAIN` must point to the VM; inbound TCP 80/443 (and UDP 443 for HTTP/3) must reach Caddy. Keep the VM firewall closed for ports 1433, 6379, 8081–8090, and 9092.

1. Install Java 21, Docker Engine, and Compose v2 on the host.
2. Provision a staging-only SQL Server database and an application DB principal. Do not use `sa` for application connections. The checked-in SQL Server Developer container is for non-production staging only. The repository includes `infra/mssql/00_platform/011_provision_app_login.sql`, invoked by `./infra/db-compose.sh provision-app-user`; it grants workspace metadata read access and data/execute access on existing `ws_*` schemas. Run it after creating a workspace, then verify the resulting grants against the staging schema before exposing the app.
3. Create `backend/infra/docker/.env` on the host from the example. Populate strong, unique secrets from the host's secret manager; restrict the file to the deploy account. Never commit it or copy example values as credentials.
4. Set `API_DOMAIN`, `COOKIE_SECURE=true`, and `GITHUB_REDIRECT_URI=https://<vercel-host>/auth/callback`. Rotate every credential that has appeared in Git history, including database administrator and GitHub OAuth credentials, before deployment.
5. Build backend artifacts from the repository root with `cd backend && ./mvnw -DskipTests package` (PowerShell: `./mvnw.cmd -DskipTests package`).
6. Start services with `docker compose --env-file infra/docker/.env -f infra/docker/docker-compose.yml --profile full up -d --build` from `backend/`.
7. Initialize SQL Server and create workspaces with `./infra/db-compose.sh init`, `./infra/db-compose.sh tenant <code> "Staging Workspace"`, and optionally `./infra/db-compose.sh seed <code>` from `backend/`. After exporting `DB_USER` and `DB_PASSWORD` from the secret manager, run `./infra/db-compose.sh provision-app-user`. Provisioning uses `sa` only for this administrative step; API services use the application login. It grants read access to `platform.workspace` and data/execute access on each existing `ws_*` schema. Run it again after creating another workspace so the new schema receives grants.
8. Check health from the host with `docker compose --env-file infra/docker/.env -f infra/docker/docker-compose.yml --profile full ps` and `curl -f http://127.0.0.1:8081/actuator/health` (then the other service ports). Only Caddy's 80/443 ports are internet-facing.

## Required secrets and settings

- `MSSQL_SA_PASSWORD`: staging SQL Server administrator password, used only for provisioning and maintenance.
- `DB_USER` / `DB_PASSWORD`: least-privilege application login.
- `JWT_SECRET`: random signing key of at least 32 bytes, shared by services that verify the same tokens.
- `TOKEN_ENCRYPTION_KEY`: base64 encoded 32-byte key for GitHub credentials at rest.
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`: rotated OAuth app credentials.
- `GITHUB_WEBHOOK_SECRET`: independent random webhook signing secret.
- `GITHUB_REDIRECT_URI`: exact HTTPS callback configured in GitHub and Vercel.
- `API_DOMAIN`: DNS name covered by Caddy-managed TLS.

The repository does not know the chosen VM provider or its secret-manager product. The deploy operator must connect that provider's secret store before starting staging; a checked-in `.env.example` is documentation only.

## Smoke test

On Preview first, verify GitHub OAuth callback and cookie creation, then repository connection, document create/edit, Staff approval, Manager approval and direct commit to the connected repository's default branch. Reload the document and confirm immutable version history includes the GitHub commit SHA. Also verify an unauthorized role, cross-workspace resource ID, missing CSRF header, and failed GitHub write are rejected. Do not promote to Production until those checks pass.
