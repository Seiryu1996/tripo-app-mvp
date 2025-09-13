import { prisma } from '@/lib/prisma'
import { User } from '@prisma/client'
import bcrypt from 'bcryptjs'

export type UserRole = 'ADMIN' | 'USER'

export interface CreateUserData {
  email: string
  password: string
  name: string
  role?: UserRole
}

export interface UpdateUserData {
  email?: string
  name?: string
  role?: UserRole
}

export interface PublicUserData {
  id: string
  email: string
  name: string
  role: UserRole
  createdAt: Date
  updatedAt: Date
}

export class UserService {
  static async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email }
    })
  }

  static async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id }
    })
  }

  static async findAll(): Promise<PublicUserData[]> {
    return prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  static async create(data: CreateUserData): Promise<User> {
    const hashedPassword = await bcrypt.hash(data.password, 12)
    
    return prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
        role: data.role || 'USER'
      }
    })
  }

  static async update(id: string, data: UpdateUserData): Promise<PublicUserData> {
    return prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    })
  }

  static async updateWithPassword(id: string, data: UpdateUserData & { password?: string }): Promise<PublicUserData> {
    const updateData: any = { ...data }
    
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 12)
    }

    return prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    })
  }

  static async delete(id: string): Promise<User> {
    return prisma.user.delete({
      where: { id }
    })
  }

  static async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password)
  }

  static async updatePassword(id: string, newPassword: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(newPassword, 12)
    
    return prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    })
  }

  static async checkEmailDuplication(email: string, excludeId?: string): Promise<boolean> {
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })
    
    return existingUser !== null && existingUser.id !== excludeId
  }
}