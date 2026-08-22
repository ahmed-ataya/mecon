/**
 * Create or reset a user account — needed once to bootstrap the first Admin
 * (the database starts with zero users), and reusable afterward for
 * resetting anyone's password directly, since there's no email-based
 * "forgot password" flow (no email-sending infrastructure in this app).
 *
 * Idempotent on email: re-running with the same email updates that user's
 * name/password/role rather than erroring, the same "safe to re-run"
 * pattern scripts/import-employees.ts already follows.
 *
 *   npx tsx scripts/create-user.ts "Full Name" email@example.com "password" ADMIN
 */
import 'dotenv/config' // runs as its own process, so it loads .env itself
import { db } from '../src/lib/db'
import { hashPassword } from '../src/lib/auth/password'
import { USER_ROLES, type UserRole } from '../src/lib/enums'

async function main() {
  const [name, email, password, role] = process.argv.slice(2)

  if (!name || !email || !password || !role) {
    console.error(
      'Usage: npx tsx scripts/create-user.ts "Full Name" email@example.com "password" ROLE',
    )
    console.error(`ROLE must be one of: ${USER_ROLES.join(', ')}`)
    process.exit(1)
  }

  if (!USER_ROLES.includes(role as UserRole)) {
    console.error(`Invalid role "${role}". Must be one of: ${USER_ROLES.join(', ')}`)
    process.exit(1)
  }

  const passwordHash = hashPassword(password)

  const user = await db.user.upsert({
    where: { email: email.toLowerCase() },
    update: { name, passwordHash, role },
    create: { name, email: email.toLowerCase(), passwordHash, role },
  })

  console.log(`OK: ${user.name} <${user.email}> — ${user.role}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
