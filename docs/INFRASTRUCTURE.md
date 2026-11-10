# DEVORA infrastructure decision — 2026-11-10

## Goal
Launch a reliable, security-conscious developer platform while keeping recurring costs at zero where possible. Never treat a free trial, temporary credit, sleeping service, or ephemeral disk as production durability.

## Proposed service boundaries

| Capability | Candidate | Decision |
|---|---|---|
| Web frontend | Cloudflare Pages | Candidate for static frontend; validate Next.js routing/SSR requirements before migration. |
| Edge/API endpoints | Cloudflare Workers | Use only for stateless edge endpoints and lightweight integrations; Free limits include 100,000 requests/day and 10 ms CPU per invocation. |
| Primary relational database | Neon Postgres Free | Preferred first integration because the existing application uses PostgreSQL and node-postgres. Free currently includes 1 GB/project, 100 CU-hours/project/month, 5 GB public transfer/project/month; compute scales to zero after 5 minutes idle and suspends when monthly quota is exhausted. |
| Alternative relational database | TiDB Cloud PostgreSQL-compatible Starter | Experimental candidate only. Public Preview; current docs state up to 10 free PostgreSQL-compatible instances per organization, 50 GiB row storage and 500 million RUs/month per instance. Validate SQL, extensions, pooling, and migration compatibility before production. |
| Container/backend hosting | Hostless | Evaluation candidate, not yet approved for production. Free shared pool: 0.5 vCPU, 1 GiB RAM, 512 MiB database storage across all apps/workers/databases. Above allowance can be billed; payment method/credit is needed for extra capacity. |
| User uploads/assets | Cloudflare R2 or Hostless S3-compatible storage | Evaluate after account creation. Do not store user uploads on ephemeral app disk. |
| Git repository storage | Dedicated persistent-volume host required | NOT SOLVED. Forgejo needs durable repository storage and reliable SSH/HTTP Git transport. Do not assume Hostless temporary app disk or object storage is a drop-in replacement for Forgejo's repository filesystem. Validate persistent volumes and backup/restore before onboarding users. |
| Analytics/event warehouse | ClickHouse, later | Defer until traffic exists; not the source of truth for accounts, permissions, repositories, issues, or pull requests. |
| Distributed SQL alternative | CockroachDB | Not selected for a zero-cost permanent base: current new-account offer is a 30-day $400 trial; clusters pause after trial without payment method and are later deleted. |

## Critical constraints and safety
- Do not migrate production data or replace the current PostgreSQL configuration until the target account, database, backups, connection string, and restore test are confirmed.
- Do not put credentials, API keys, connection strings, or SMTP secrets in GitHub. Configure them only in provider secret/environment settings.
- Keep the existing Render deployment and PostgreSQL database untouched as a rollback path until the replacement is verified.
- Do not enable paid overages or add a payment method without the owner's explicit approval.
- Separate application relational data from Git object storage. Git repositories are large, binary, and require durable filesystem/object-storage semantics plus backup/restore.
- Use least-privilege database credentials, TLS, connection pooling, rate limits, email verification, secure password hashing, session rotation, CSRF protection where applicable, audit logs, and tested backups.
- Free-tier limits can suspend writes or compute. Add quota monitoring and user-facing degraded-mode handling.

## Immediate account/setup checklist
1. Create/verify Cloudflare account; confirm signup method and whether phone verification is requested for this account.
2. Create/verify Neon account; create a development-only PostgreSQL project in a region close to the application host. Do not use production data yet.
3. Create/verify Hostless account; inspect the selected region, persistent disk/volume availability, S3 bucket durability, free-pool meter, spend controls, and whether account verification requests a phone.
4. Create/verify TiDB account only as a compatibility benchmark; do not switch the existing pg driver until the PostgreSQL-compatible Starter preview passes integration tests.
5. Record service URLs, regions, free quotas, account recovery methods, backup/export paths, and verification requirements. Never paste secrets into chat.
6. Run migrations against an empty development database, then test register/login, workspace/repository metadata, transactions, concurrent connections, backup, and restore.
7. Resolve persistent Git repository storage and SSH/HTTP transport before claiming the GitHub-like service is launch-ready.

## Current implementation status
The Next.js app and PostgreSQL migration foundation exist in the repository. A first platform-core schema expansion is on branch `phase-1-platform-core`. This document is an infrastructure plan, not proof that any external account, service, database, or deployment has been created.
