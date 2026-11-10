# DEVORA infrastructure decision — 2026-11-10

## Selected primary database: Aiven PostgreSQL Free

Aiven currently documents a $0 PostgreSQL Free plan with 1 dedicated VM, 1 CPU, 1 GB RAM, and 1 GB storage. It includes backups and monitoring, but it is a single-node service, has a 20-connection limit, no 99.99% SLA, and may be powered off after extended inactivity. It is suitable for integration and early testing, not a guarantee of production-grade always-on availability.

Official references:
- Free tier: https://aiven.io/docs/products/postgresql/concepts/pg-free-tier
- Create and connect: https://aiven.io/docs/products/postgresql/get-started
- Pricing: https://aiven.io/pricing/postgresql

Aiven states that a credit card is not required for the free tier. Its public documentation does not guarantee that every account or region will avoid phone or additional identity verification.

## Connect Aiven to DEVORA

1. In Aiven Console, create a PostgreSQL service and select the Free plan.
2. Open the service > Overview > Quick connect, then copy the PostgreSQL URI.
3. In Render, open the DEVORA web service > Environment.
4. Add/update `DATABASE_URL` with the complete URI. Keep its `sslmode=require` query parameter.
5. Save the environment changes and redeploy.
6. Render's configured start command runs `npm run db:migrate` before starting Next.js.
7. Check `/api/health` and Render logs. A successful connection should no longer report `DATABASE_URL is not configured` or database unavailable.

**Security:** Never put the URI, password, CA private material, or tokens in GitHub, source code, screenshots, or chat. Store the value only in Render Environment as a secret. Do not replace the existing database until its data has been backed up and a restore has been tested.

## Current service allocation

| Layer | Provider/technology | State |
|---|---|---|
| Frontend + product API | Next.js 15 / Node.js 22 | Existing code; Render deployment configured by render.yaml |
| Primary relational DB | Aiven PostgreSQL Free | Selected; awaiting service creation and secret configuration |
| Git repositories + Git protocol | Forgejo 17.0 | Adapter and Compose stack prepared; persistent host not connected |
| Forgejo metadata DB | PostgreSQL 16 dedicated container | Included in Compose |
| HTTPS proxy | Caddy | Included in Compose |
| Object storage | Cloudflare R2 | Candidate; adapter/bucket credentials not connected |
| Transactional email | Resend | Awaiting API key and verified sender |

## Operational constraints

- Aiven Free has 1 GB storage, 1 GB RAM, 1 CPU, and a 20-connection cap; this is not sized for a large Git hosting launch.
- Free services can be powered off after inactivity. Monitor service state and usage.
- Keep database credentials and API tokens in provider secret settings only.
- Do not use ephemeral app disk for Git objects, uploads, or backups.
- Keep relational product data separate from Forgejo Git object storage.
- Do not enable paid overages or add a payment method without the owner's explicit approval.
- Back up and test restore before migrating any existing production data.
- Aiven free tier is single-node and has no 99.99% SLA; do not describe this setup as permanent, highly available production hosting.

## Remaining external setup

1. Create the Aiven PostgreSQL Free service and configure Render's `DATABASE_URL`.
2. Confirm the migration runner completes and the health endpoint reports database availability.
3. Obtain a persistent Linux VM/volume for Forgejo, then configure `FORGEJO_BASE_URL` and server-only `FORGEJO_API_TOKEN`.
4. Create Cloudflare R2 bucket and configure its secrets for repository assets.
5. Configure transactional email for verification and password recovery.
6. Run full auth, permissions, clone/push/pull, backup/restore, and security tests.

## Implementation status

Branch `phase-1-platform-core` contains the PostgreSQL pool, migration runner, Render service configuration, Forgejo adapter, Git gateway, and setup documentation. This commit prepares verified TLS for hosted PostgreSQL and documents Aiven connection. The branch has not been merged to `main`, and no external Aiven service has yet been connected or tested. Public launch remains blocked by external service setup and end-to-end test gates.
