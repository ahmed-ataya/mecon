# Deploying

The app runs on Vercel with a Neon Postgres database. Both have free tiers that
comfortably cover a review deployment.

You need to do the account steps yourself — they involve signing in and handling
credentials.

## 1. Create the database (Neon)

1. Sign up at [neon.tech](https://neon.tech) and create a project.
2. Copy the **pooled** connection string. It looks like:

   ```
   postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require
   ```

   Use the pooled URL (the one with `-pooler`), not the direct one — serverless
   opens and drops connections constantly and will exhaust a direct connection
   limit.

Treat that string as a password. It grants full read/write to the database.

## 2. Deploy (Vercel)

1. Sign up at [vercel.com](https://vercel.com) with your GitHub account.
2. **Add New → Project**, import the `mecon` repository.
3. Before clicking Deploy, add two environment variables:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Neon pooled connection string |
   | `SITE_PASSWORD` | a long password you choose |

   Add both to **all** environments (Production, Preview, Development).
4. Deploy.

The build command is `prisma generate && prisma migrate deploy && next build`,
so the database schema is created automatically on the first deploy. You do not
need to run migrations by hand.

## 3. Load the sample data (once)

The deployed database starts empty. To load the sample records, point a local
`.env` at the **Neon** database and run the seed once:

```bash
npm run db:seed
```

Then remove that line from `.env` again, or keep a separate local database, so
you do not develop against the live data.

> The seed **deletes every record** before inserting. It refuses to run if the
> target database already has customers — override with `FORCE_SEED=1` only if
> you genuinely mean to wipe it. Once real data has been entered, do not run it.

## 4. Access

The site is behind a shared password (`src/middleware.ts`). The browser prompts
for a username and password — **any username works**, only the password is
checked against `SITE_PASSWORD`.

This is a review gate, not authentication. There are no accounts, no roles and
no audit trail, so everyone past the gate is indistinguishable and has full
edit rights. Phase 4 replaces it with real user accounts.

If `SITE_PASSWORD` is unset the gate is skipped entirely — that is intentional
for local development, but it means **forgetting to set it in Vercel leaves the
site fully open**.

## Local development after the move

Local development also needs Postgres now. Either run one locally, or create a
second free Neon database and use that as your dev database.

Never point local development at the database the deployed site uses — the
reset and seed scripts are destructive.

```bash
cp .env.example .env      # then edit DATABASE_URL
npm run db:migrate        # apply migrations
npm run db:seed           # load sample data
npm run dev
```
