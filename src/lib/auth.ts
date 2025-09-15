import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'
import { UserService } from '@/services/userService'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      name: user.name, 
      role: user.role 
    },
    process.env.NEXTAUTH_SECRET!,
    { expiresIn: '7d' }
  )
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, process.env.NEXTAUTH_SECRET!) as AuthUser
  } catch {
    return null
  }
}

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  
  if (!token) {
    return null
  }

  const user = verifyToken(token)
  if (!user) {
    return null
  }

  const dbUser = await UserService.findById(user.id)

  return dbUser ? user : null
}

export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  const user = await getAuthUser(request)
  
  if (!user) {
    throw new Error('Unauthorized')
  }
  
  return user
}

export async function requireAdmin(request: NextRequest): Promise<AuthUser> {
  const user = await requireAuth(request)
  
  if (user.role !== 'ADMIN') {
    throw new Error('Admin access required')
  }
  
  return user
}
