import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { Role } from '@prisma/client'

export const TEST_USER_EMAIL = 'jest.user@example.com'
export const TEST_ADMIN_EMAIL = 'jest.admin@example.com'
export const TEST_USER_PASSWORD = 'P@ssw0rd!'

export async function deleteUserByEmail(email: string): Promise<void> {
  await prisma.user.deleteMany({ where: { email } })
}

export async function createUser(opts: { email: string; password: string; name: string; role?: Role }) {
  const hashed = await bcrypt.hash(opts.password, 12)
  return prisma.user.create({
    data: {
      email: opts.email,
      name: opts.name,
      password: hashed,
      role: opts.role ?? 'USER',
    },
  })
}

export async function createTestUser() {
  await deleteUserByEmail(TEST_USER_EMAIL)
  return createUser({ email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD, name: 'Jest User', role: 'USER' })
}

export async function createTestAdmin() {
  await deleteUserByEmail(TEST_ADMIN_EMAIL)
  return createUser({ email: TEST_ADMIN_EMAIL, password: TEST_USER_PASSWORD, name: 'Jest Admin', role: 'ADMIN' })
}

export async function cleanupTestUsers() {
  await prisma.user.deleteMany({ where: { email: { in: [TEST_USER_EMAIL, TEST_ADMIN_EMAIL] } } })
}

