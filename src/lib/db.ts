import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Prisma 7 connects through a driver adapter rather than a url in the schema.
//
// Postgres, not SQLite: the app is deployed on serverless, where the
// filesystem is ephemeral and a SQLite file would be wiped on every deploy
// (and not shared between instances). See NOTES.md.
//
// Tried Neon's own WebSocket driver (@prisma/adapter-neon) here on
// 2026-08-28 to cut serverless connection-setup latency — reverted the same
// day after live testing surfaced a real "Connection terminated
// unexpectedly" error: its pooled connection can get silently dropped
// during an idle gap between requests (exactly Vercel Fluid Compute's warm-
// reuse pattern) and the next query fails outright instead of just being
// slow. A hard error is worse than the latency it was meant to fix. See
// ROADMAP.md for the full account.
function createClient() {
  const url = process.env.DATABASE_URL

  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.')
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  })
}

// Next.js hot-reloads modules in dev, which would otherwise open a new
// connection on every edit. Reuse a single client across reloads.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
