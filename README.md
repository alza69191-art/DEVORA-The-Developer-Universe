# DEVORA — The Developer Universe

DEVORA is an independent developer platform. The web application uses Next.js and PostgreSQL; **Forgejo is the Git engine** for Git storage and metadata. DEVORA proxies Git HTTPS requests and enforces its own token scopes and repository ACLs.

## Current delivery

This repository contains the DEVORA branded web shell, PostgreSQL schema/migrations, migration runner, health endpoints, CI workflow, Forgejo REST adapter, and a Docker Compose stack for Forgejo + PostgreSQL + Caddy with persistent named volumes.

**This is an integration foundation, not a production-ready GitHub replacement.** The current branch now contains account flows, email verification/reset, API-token Git authentication, a permission-checking smart-HTTP gateway for HTTPS clone/fetch/push, repository CRUD, and R2 upload plumbing with post-upload object verification. Production launch still requires external services, successful CI, SSH/LFS, isolated CI runners, backup/restore, and end-to-end verification on the deployed stack.

## Infrastructure decisions

- **Primary DB:** Neon PostgreSQL Free is the preferred first integration because the code uses `pg` and PostgreSQL migrations.
- **Alternative DB:** TiDB PostgreSQL-compatible Starter is experimental/public-preview; test compatibility before use.
- **Web/API:** Keep Next.js on a Node host that supports its runtime. Cloudflare Workers/Pages are not assumed to run the current Next.js app without adaptation.
- **Git engine:** Forgejo 17 on a host with persistent volumes. Do not put Git repositories on Render's ephemeral filesystem.
- **Object storage:** Cloudflare R2 is the first candidate for user uploads and Git LFS after its bucket and credentials are created.
- **Hostless:** candidate only after confirming persistent disk semantics, actual free pool, region, and account verification. Do not deploy repository data there until persistence and restore are proven.

See [infrastructure decisions](docs/INFRASTRUCTURE.md) and [Git engine setup](docs/GIT-ENGINE.md).

## Deploy DEVORA web app

1. Create a Render Web Service or another Node.js 22 host from this repository.
2. Set build command: `npm install && npm run build`.
3. Set start command: `npm run db:migrate && npm start`.
4. Set `DATABASE_URL` to the Neon PostgreSQL connection string (pooled connection if offered).
5. Set a unique `AUTH_SECRET` (32+ random bytes) and `APP_URL`.
6. Add `FORGEJO_BASE_URL` and `FORGEJO_API_TOKEN` only after the Git host is ready.
7. Never put secrets in Git, browser code, public build variables, or chat messages.

## Deploy Forgejo

Read [docs/GIT-ENGINE.md](docs/GIT-ENGINE.md). The Compose stack expects a persistent Linux host, DNS, and public ports 80/443; port 2222 is used for SSH Git transport. It creates persistent named volumes for Forgejo data and its PostgreSQL database. Back up both and test restore.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Apply schema to a development database with `npm run db:migrate`. Do not run migrations against any external/production database until its owner approves and a backup exists.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Server-only auth secret |
| `APP_URL` | Canonical DEVORA URL |
| `FORGEJO_BASE_URL` | Forgejo base URL |
| `FORGEJO_API_TOKEN` | Server-only Forgejo API token |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` | Optional Cloudflare R2 storage |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Optional transactional email |

## Release gates

Before public signup: implement password hashing, verification/recovery email, secure sessions, CSRF protection, rate limiting, role and repository ACL checks, audit logs, abuse reporting, quotas, secret scanning, isolated CI runners, object storage, backup/restore tests, and end-to-end Git tests for clone/fetch/push/branches/tags/private repositories.

**Brand:** DEVORA — The Developer Universe · Build. Collaborate. Create.
