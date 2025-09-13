import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { Role } from '@prisma/client'

export const TEST_USER_EMAIL = 'jest.user@example.com'
export const TEST_ADMIN_EMAIL = 'jest.admin@example.com'
export const TEST_USER_PASSWORD = 'P@ssw0rd!'

const hasDb = !!process.env.DATABASE_URL

async function safe<T>(fn: () => Promise<T>): Promise<T | undefined> {
  if (!hasDb) return undefined as any
  try {
    return await fn()
  } catch {
    return undefined as any
  }
}

export async function deleteUserByEmail(email: string): Promise<void> {
  await safe(() => prisma.user.deleteMany({ where: { email } }))
}

export async function createUser(opts: { email: string; password: string; name: string; role?: Role }): Promise<void> {
  const hashed = await bcrypt.hash(opts.password, 12)
  await safe(() =>
    prisma.user.create({
      data: {
        email: opts.email,
        name: opts.name,
        password: hashed,
        role: opts.role ?? 'USER',
      },
    })
  )
}

export async function createTestUser(): Promise<void> {
  await deleteUserByEmail(TEST_USER_EMAIL)
  await createUser({ email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD, name: 'Jest User', role: 'USER' })
}

export async function createTestAdmin(): Promise<void> {
  await deleteUserByEmail(TEST_ADMIN_EMAIL)
  await createUser({ email: TEST_ADMIN_EMAIL, password: TEST_USER_PASSWORD, name: 'Jest Admin', role: 'ADMIN' })
}

export async function cleanupTestUsers(): Promise<void> {
  await safe(() => prisma.user.deleteMany({ where: { email: { in: [TEST_USER_EMAIL, TEST_ADMIN_EMAIL] } } }))
}
