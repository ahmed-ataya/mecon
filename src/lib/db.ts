import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

// Prisma 7 connects through a driver adapter rather than a url in the schema.
// timestampFormat 'iso8601' stores DateTime columns as readable ISO strings,
// per the project convention — you can open dev.db and read the dates.
function createClient() {
  const url = process.env.DATABASE_URL

  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.')
  }

  return new PrismaClient({
    adapter: new PrismaBetterSqlite3(
      { url: url.replace(/^file:/, '') },
      { timestampFormat: 'iso8601' },
    ),
  })
}

// Next.js hot-reloads modules in dev, which would otherwise open a new
// connection on every edit. Reuse a single client across reloads.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
