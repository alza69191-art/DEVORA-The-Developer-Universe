# DEVORA Git engine

## Engine choice

DEVORA uses **Forgejo** as its Git transport and repository engine instead of reimplementing the Git smart-HTTP/SSH protocols. Forgejo provides Git repositories, HTTP/SSH clone/push/pull, branches, tags, webhooks, and collaboration APIs. The DEVORA Next.js application remains the product UI and PostgreSQL remains the source of truth for DEVORA users, workspaces, permissions, issues, and product metadata.

Official Forgejo docs:
- Installation: https://forgejo.org/docs/latest/admin/installation/
- API authentication and usage: https://forgejo.org/docs/latest/user/api/usage/
- Releases: https://forgejo.org/releases/

## Deployment

The Docker Compose stack in this folder runs:
- Forgejo 17.0 (Git server and web UI/API)
- PostgreSQL 16 dedicated to Forgejo's internal metadata
- Caddy reverse proxy with automatic HTTPS
- Named persistent volumes for Forgejo data/repositories and its database

Deploy only on a host with **persistent disk/volumes**, public HTTPS ingress, and inbound SSH access if SSH clone URLs are enabled. A temporary/ephemeral filesystem is not acceptable. Back up both named volumes and test restoration before accepting user repositories.

1. Point DNS A/AAAA record for `FORGEJO_DOMAIN` to the host.
2. Copy `infra/forgejo/.env.forgejo.example` to `infra/forgejo/.env` and set strong unique secrets.
3. From the repository root, run `docker compose --env-file infra/forgejo/.env -f infra/forgejo/docker-compose.yml up -d`.
4. Open `https://$FORGEJO_DOMAIN` and create the initial administrator account.
5. Create a dedicated API service account and a scoped token. Store it as `FORGEJO_API_TOKEN` only in the DEVORA server environment.
6. Set `FORGEJO_BASE_URL=https://$FORGEJO_DOMAIN` in DEVORA.
7. Check `/api/git/health` and confirm it reports `reachable: true`.

## Git transport

- HTTPS: `https://$FORGEJO_DOMAIN/{owner}/{repo}.git`
- SSH: `ssh://git@$FORGEJO_DOMAIN:2222/{owner}/{repo}.git`

The browser should receive only the clone URLs returned for public repositories. Never send the Forgejo API token to client components. Private repository access must be checked by DEVORA before issuing metadata or redirecting a user to Forgejo.

## DEVORA integration

`src/lib/forgejo.ts` is a server-side REST adapter for health checks, repository provisioning, repository metadata, branches, trees, files, and commits. It intentionally does not expose an unauthenticated repository-creation endpoint. Wire its functions into authenticated DEVORA service actions only after the session and repository authorization middleware are implemented.

Git smart HTTP is proxied through the DEVORA Node route `/git/{forgejo-owner}/{repo}.git`. Git clients authenticate with a DEVORA personal access token (DEVORA username as Basic-auth username, token as password). The gateway hashes and validates the token, checks repository read/write permissions and token scopes, then forwards the stream to the private Forgejo service account. The Forgejo token is never sent to the client. SSH is disabled until per-user SSH key registration is implemented.

## Current limitations

This establishes the engine integration boundary, not a complete public GitHub replacement. Before launch, implement and test:
- DEVORA authentication, email verification, password reset, session rotation, CSRF protections, and rate limits.
- Atomic DEVORA repository record + Forgejo provisioning with retry/reconciliation.
- Per-request repository visibility and collaborator authorization.
- SSH key registration, large-push streaming tests, Git LFS, and quotas.
- LFS/object storage, quotas, abuse controls, webhook validation, backup/restore.
- Forgejo Actions runners and isolated build execution. Never run untrusted repository code on the main web host.
- Migration and integration tests for clone, fetch, push, branches, tags, and large repositories. Configure R2 bucket CORS to allow PUT from the DEVORA app origin and allow the `Content-Type` request header. Upload metadata is only marked complete after a signed HEAD check verifies the actual size and media type.
