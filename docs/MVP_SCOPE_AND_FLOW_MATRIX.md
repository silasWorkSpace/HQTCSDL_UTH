# LivingDocs MVP scope and flow matrix

## MVP goal

Deliver the SRS M-priority scope across the web, mobile, GitHub integration, AST/RAG/LLM analysis, document workflow, and audit/versioning. The authenticated workspace flow remains the end-to-end release gate: OAuth identity → GitHub App repository access → baseline index → grounded generation → Developer → Staff → Manager → documentation publish → merge confirmation → Published.

The previous MVP exclusions for RAG, semantic drift, broader generation scopes, and mobile workflows conflict with M-priority requirements in `LivingDocs_SRS.docx`. They are not scope decisions for this implementation. Each M requirement is tracked in `REQUIREMENTS_TRACEABILITY.md`; S-priority work remains a separate backlog. Runtime claims require the integration checks listed in that traceability baseline.

## Screen to API to database map

| Screen / action | Frontend route and current implementation | API contract | Database / status | MVP decision |
|---|---|---|---|---|
| GitHub sign-in | `/login`, `/auth/callback`; real OAuth URL and callback, one-time server state in Redis; errors fail visibly | Identity `GET /api/v1/auth/github/url`, `POST /api/v1/auth/github/callback`; GitHub `/user` and verified `/user/emails` | `ws_<tenant>.app_user`, `role_assignment`; Redis OAuth state and refresh sessions | Implemented at source level; OAuth provider, Redis and registered callback still need deployed verification. |
| Repository selection and baseline indexing | Document list completes GitHub App installation callback, connects an accessible repository, and queues a baseline `analysis_run`; the AI consumer reads immutable Java/Python snapshots and persists parsed entities | Integration App installation and repository APIs; `GET /api/v1/analysis-runs?repositoryId=...`; internal snapshot endpoint is service-token protected | `github_connection`, `repository`, `analysis_run`, `code_entity` in tenant schema | Source flow implemented; App setup URL, installation permissions, schema migration, Kafka, Integration, and SQL Server need runtime verification. |
| Document list / filter | `/documents`; shared client uses real APIs by default; mock mode requires explicit Vite dev setting | Document `GET /api/v1/documents`; Integration `GET /api/v1/repositories` | `document`, `document_version`, `repository` in tenant schema | Real API source path; no backend runtime verification yet. |
| Generate document | Developer may scope generation to a file, module/package, or repository; optionally narrow by entity; generated content includes code links, commit grounding, and confidence | Integration snapshot/entity APIs; Document `POST /api/v1/documents/generate`; Kafka `ld.ai-jobs` / `ld.ai-results` | `code_entity`, `document`, `document_version`, `doc_code_link`, `update_suggestion` | API and UI now resolve selected scope against the exact completed commit and validate any entity narrowing; template/coverage behavior and model capacity still need review and runtime verification. |
| Edit draft | `/documents/:id/edit`; sends `baseVersionNo`, backend rejects stale edits | Document `PUT /api/v1/documents/{id}/draft` | `document`, immutable `document_version` | Optimistic concurrency implemented at source level; DB procedure contract needs runtime verification. |
| Submit for review | Detail page submits to workflow endpoint; errors are surfaced | Workflow `POST /api/v1/documents/{id}/submit` | `review_task`, `document`, audit tables | Real API source path; review transition depends on existing DB procedures. |
| Staff / Manager review | `/reviews`, `/reviews/:taskId`; UI role comes from issued JWT claims and workflow actions call real APIs | Workflow `GET /api/v1/reviews/queue?level=...`, `GET /api/v1/reviews/{id}`, `POST /api/v1/reviews/{id}/decisions` | `review_task`, `review_decision`, `review_comment`, audit tables | Real API source path; service runtime and reviewer separation need verification. |
| Publish | After Manager approval, Integration opens a documentation PR using GitHub App write permission; the document remains pending until a verified merged webhook completes publication | Workflow decision API → Integration publish API; GitHub pull request API and signed webhook | `document`, `document_version.source_commit_sha`, source event records | Source flow implemented; GitHub App permission, webhook delivery/signature, and merged-state transition need runtime verification. |
| Version history / diff | Detail and diff pages exist and use the shared authenticated API client | Document `GET /api/v1/documents/{id}/versions`, `GET /api/v1/documents/{id}/versions/{n}`, `GET /api/v1/documents/{id}/diff` | `document_version` with content/hash chain | Real API source path; verify persisted versions on a running database. |
| Source-change suggestions | Source PR/push events create analysis runs, index exact base/head snapshots, and analyze only explicit `doc_code_link` mappings; unrelated or bot documentation PRs do not generate drift | GitHub webhook → Integration `analysis_run` → AI source consumer → drift events | `source_event`, `analysis_run`, `code_entity`, `drift_alert`, `update_suggestion` | Source flow implemented; full authenticated runtime and real mapped-change scenario still need verification. |
| Semantic drift / knowledge retrieval | Compare linked document content with changed code using grounded retrieval and an LLM; return repeatable evidence and confidence | Source event → AI Engine retrieval/LLM provider → drift event → Workflow | Indexed code snapshots, document content/version, document-code links, analysis evidence | Current drift module still exposes a mock semantic provider and does not retrieve document context; FR-DR-04 and FR-KB-04 remain open. |
| PR feedback and source artifacts | Post findings and status checks to source PRs; use GitHub Issue/PR ticket context as evidence; ingest direct repository document edits | GitHub Actions and webhook APIs; Integration event queue; GitHub Checks/Comments API | Delivery/event records, ticket references, external document versions | Webhook HMAC/idempotency and analysis queue exist in source. Actions installation, Issue evidence, PR feedback, and direct-edit version capture need requirement-level implementation/runtime review. |
| Mobile workflows | React Native iOS/Android experience for Developer, Staff, and Manager, with shared API authorization and push registration | Shared authenticated APIs; device registration and push provider integrations | User/device notification registrations and existing workflow/version data | No React Native application was found in the repository inventory; FR-MOB-01..03 and 05..11 remain open. |
| Templates / governance | Template authoring and governance surfaces | Governance APIs and persisted template contract | Governance tables | M-priority template requirements FR-TPL-01, 02, 03, and 08 remain in scope; S-priority template versioning and governance capabilities are tracked separately. |

## Security and delivery gates

1. OAuth state is an unpredictable, short-lived, one-time value bound server-side to the requested workspace. Callback consumes it exactly once; redirect URI is server configured.
2. Missing OAuth client credentials, invalid secrets, or missing JWT signing keys fail closed. No mock identities/tokens/repos are returned by a deployed profile.
3. API role and tenant come from a verified JWT. Client role selectors and tenant headers are never authorization sources.
4. Every integration, document, workflow, governance, and notification endpoint requires authentication except health, API docs where intentionally enabled, and the signed GitHub webhook endpoint. Webhook delivery is separately HMAC validated.
5. **Deployment blocker:** Compose now requires explicit secret values and the repository contains placeholders only, but no cloud secret-manager provider is wired because the target host/provider has not been selected. Production deployment must inject OAuth, JWT, database, Redis, encryption, and webhook secrets from its secret store; never copy `.env.example` values as credentials.
6. GitHub access tokens stay server-side and are encrypted before database storage; the app JWT is delivered only in HttpOnly cookies and JavaScript receives the non-secret connection ID.
7. Workspace membership policy is closed by default. New GitHub identities can be provisioned only when the workspace config explicitly sets `github_signup` to `open`; otherwise an administrator must pre-provision the account.
8. App access and refresh JWTs use HttpOnly, SameSite cookies; unsafe cookie-authenticated requests require a matching CSRF cookie/header. Production must set `COOKIE_SECURE=true` and serve HTTPS.
9. **Deployment blocker:** the deployed browser app must be served over HTTPS with a same-origin API route. CORS, OAuth callback URI, least-privilege database login, health checks, backups, and startup migrations still need configuration and verification on the chosen host.

To allow self-registration in a workspace, an administrator must explicitly opt that workspace in:

```sql
UPDATE platform.workspace
SET config = JSON_MODIFY(COALESCE(config, N'{}'), '$.github_signup', 'open')
WHERE code = 'your_workspace_code' AND status = 'active';
```

Leave the setting absent for invitation/pre-provision-only access.

## Current acceptance criteria

- A newly provisioned GitHub user receives only the default Developer role; elevated roles require an authorized administrator action.
- OAuth state binds the callback to one workspace. New identities are rejected unless that workspace explicitly enables `github_signup: open`.
- A Developer can create/edit a persisted draft, submit it, and cannot approve their own submission.
- A different Staff user can approve to the Manager queue; a different Manager can approve and publish it.
- The author can see immutable versions and compare two versions after reload.
- Any API failure is visible in the UI; the client never converts a failed request into a successful state transition.
- Repository connection queues an observable baseline analysis; a Developer can choose only code entities indexed at a completed full commit SHA.
- Generated drafts retain selected entity IDs and source commit; the backend rejects IDs from other repositories or snapshots.
- Manager approval opens a documentation PR, and the document does not become published until the merged webhook is processed.
- Production configuration cannot enter mock auth, mock repository, mock document, mock template, or dev-token behavior.
