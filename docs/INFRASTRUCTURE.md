# DEVORA infrastructure decision — 2026-11-10

## Verified free tiers and signup requirements

| Provider | Free allowance (official docs) | Signup/verification conclusion | Decision |
|---|---|---|---|
| Neon | Free PostgreSQL: 100 projects, 1 GB storage/project, 100 CU-hours/project/month; compute scales to zero after 5 minutes idle. | Neon states no credit card is required. Public docs do not guarantee no phone/identity checks for every account or region. Email/account checks may apply. | Preferred PostgreSQL primary for first integration. |
| Cloudflare | Free plan $0; Workers 100,000 requests/day and 10 ms CPU/invocation; R2 Standard includes 10 GB-month, 1M Class A and 10M Class B operations/month. | Official account setup documents email + password and email verification. No universal no-phone guarantee found. | DNS/CDN/R2/edge utilities; do not move current Next.js SSR app until compatibility is tested. |
| TiDB Cloud Starter | Official pricing page currently shows $0 with 25 GiB row + 25 GiB columnar + 250M RUs/month across up to 5 eligible instances. | Official docs say no credit card required for free quota. No guarantee that signup will never request phone or additional verification. PostgreSQL-compatible option remains preview/compatibility caveat. | Benchmark only; not primary until pg migrations/integration tests pass. |
| Hostless | Free pool depends on account cohort/policy; current docs describe 0.5 vCPU, 1 GiB RAM and 512 MiB database storage shared across account projects. Capacity above entitlement requires payment method or qualifying credit. | Free tier is not the same as unconditional free usage. No public guarantee of signup without phone or identity checks. | Do not rely on it for Git storage until persistent volume and backup/restore are proven. |
| Forgejo | Open-source software; no software license fee. | Hosting, persistent storage, bandwidth, backups, domain and email are separate costs/requirements. | Selected Git engine; requires persistent host. |

Official sources:
- Neon: https://neon.com/pricing
- Cloudflare: https://www.cloudflare.com/plans/ and https://developers.cloudflare.com/fundamentals/account/create-account/
- TiDB: https://www.pingcap.com/pricing/ and https://docs.pingcap.com/tidbcloud/select-cluster-tier/
- Hostless: https://docs.hostless.cloud/plans/free-tier
- Forgejo releases: https://forgejo.org/releases/

**Important:** No provider can be certified as “signup without any verification” from its public pricing page. The verifiable conclusions are limited to the explicit card/email requirements above. Actual phone prompts are account-, risk-, and region-dependent and must be checked during signup.

## Service allocation

| Layer | Provider/technology | State |
|---|---|---|
| Frontend + product API | Next.js 15 / Node.js 22 | Existing code; deploy target still to be selected |
| Primary relational DB | Neon PostgreSQL | Preferred candidate; no account connected yet |
| Git repositories + Git protocol | Forgejo 17.0 | Adapter and Compose stack prepared; persistent host not connected |
| Forgejo metadata DB | PostgreSQL 16 dedicated container | Included in Compose |
| HTTPS proxy | Caddy | Included in Compose |
| Object storage | Cloudflare R2 | Candidate; adapter/bucket credentials not connected |
| Edge/CDN/DNS | Cloudflare | Candidate |
| Alternative DB benchmark | TiDB Cloud PostgreSQL-compatible | Optional compatibility test only |
| Container host | Hostless | Unapproved until persistent storage, actual account pool, and verification are checked |
| Analytics | ClickHouse | Defer until real traffic exists |

## Critical constraints

- Never assume free tier means 24/7 compute, durable disk, no verification, or no billing risk.
- Never enable paid overages or add a payment method without the owner's explicit approval.
- Keep database credentials and API tokens in provider secret settings only.
- Do not use ephemeral app disk for Git objects, uploads, or backups.
- Keep relational product data separate from Forgejo Git object storage.
- Do not migrate existing production data before backup and restore testing.
- TiDB PostgreSQL compatibility must be tested against every migration, transaction, index, and query.
- Cloudflare Workers are for lightweight/stateless edge endpoints, not the Forgejo Git smart HTTP server.

## Next external setup steps

1. Create Neon project in a region near the Node host; copy the pooled PostgreSQL URL into the host's `DATABASE_URL` secret.
2. Create Cloudflare account (verify email), zone/domain, and R2 bucket; add R2 secrets to the Node host.
3. Obtain a persistent Linux VM/volume for Forgejo. Hostless is not approved until persistence and restore are validated.
4. Deploy Compose from `infra/forgejo`, create a Forgejo admin/service account, then set `FORGEJO_BASE_URL` and server-only `FORGEJO_API_TOKEN`.
5. Add SMTP provider credentials for verification and password recovery email.
6. Run migrations on an empty development DB, then run full auth, permissions, clone/push/pull, backup/restore, and abuse/security tests.

## Implementation status

The branch `phase-1-platform-core` contains the core schema expansion, migration runner, CI workflow, Forgejo adapter, Git health route, Forgejo 17 Compose/Caddy deployment, and setup documentation. It has **not** been merged to `main`, deployed, or connected to any external provider. Public launch remains blocked by authentication/authorization, persistent Git hosting, email, object storage, and test gates.
