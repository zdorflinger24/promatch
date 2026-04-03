# ProMatch Deploy Runbook

## Environments

| Environment | URL | Database | Deploy Trigger |
|-------------|-----|----------|----------------|
| Production  | Vercel production | Neon main branch | Push to `main` |
| Preview     | Vercel preview URL | Neon PR branch | PR opened/updated |
| Local       | http://localhost:3000 | Docker Postgres | Manual |

## Local Development

```bash
# 1. Start the database
docker compose up -d

# 2. Copy environment variables
cp .env.example .env
# Edit .env with your local values

# 3. Run database migrations
npx drizzle-kit push

# 4. Start the dev server
npm run dev
```

## Production Deploy

Production deploys are **automated** via GitHub Actions on merge to `main`.

Pipeline: `lint → typecheck → test → build → deploy`

1. Merge PR to `main`
2. GitHub Actions runs CI checks
3. Drizzle migrations run against production Neon DB
4. Vercel deploys the new build
5. Sentry source maps are uploaded

## Manual Deploy (Emergency)

```bash
# 1. Verify the build locally
npm run build

# 2. Run migrations manually
DATABASE_URL="<production-url>" npx drizzle-kit push

# 3. Trigger Vercel deploy
npx vercel --prod
```

## Rollback

```bash
# Option 1: Revert the commit and push
git revert HEAD
git push origin main

# Option 2: Redeploy previous Vercel deployment
npx vercel rollback

# Option 3: Database rollback (if migration was destructive)
# Use Neon's point-in-time restore from the dashboard
```

## Preview Deploys

Every PR automatically gets:
- A Vercel preview deployment
- An isolated Neon database branch (auto-cleaned on PR close)
- Migrations run against the branch DB

## Secrets & Configuration

All secrets are stored in GitHub repository secrets and Vercel environment variables:

| Secret | Where | Purpose |
|--------|-------|---------|
| `DATABASE_URL` | GitHub Secrets + Vercel | Neon production connection string |
| `NEXTAUTH_SECRET` | GitHub Secrets + Vercel | Auth session encryption |
| `NEXTAUTH_URL` | GitHub Secrets + Vercel | Auth callback URL |
| `NEON_API_KEY` | GitHub Secrets | Neon branching API |
| `NEON_PROJECT_ID` | GitHub Secrets | Neon project for branching |
| `SENTRY_AUTH_TOKEN` | GitHub Secrets | Source map uploads |
| `SENTRY_ORG` | GitHub Variables | Sentry organization slug |
| `SENTRY_PROJECT` | GitHub Variables | Sentry project slug |
| `NEXT_PUBLIC_SENTRY_DSN` | Vercel | Client-side error reporting |
| `STRIPE_*` | Vercel | Payment processing |
| `R2_*` | Vercel | Photo storage |
| `TWILIO_*` | Vercel | SMS notifications |
| `RESEND_API_KEY` | Vercel | Transactional email |

## Monitoring

- **Errors:** Sentry dashboard — alerts on new/regression errors
- **Performance:** Vercel Analytics — Core Web Vitals, server timing
- **Uptime:** Configure via Vercel or external service (e.g., Better Uptime)
- **Database:** Neon dashboard — connection pooling, query performance

## Setup Checklist (First Deploy)

- [ ] Create Vercel project and connect GitHub repo
- [ ] Create Neon project with PostGIS extension
- [ ] Create Sentry project
- [ ] Add all secrets to GitHub repository settings
- [ ] Add all env vars to Vercel project settings
- [ ] Run initial migration: `DATABASE_URL=<url> npx drizzle-kit push`
- [ ] Verify CI pipeline runs on first PR
