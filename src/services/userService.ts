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
  // メールアドレスでユーザーを取得
  static async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email }
    })
  }

  // IDでユーザーを取得
  static async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id }
    })
  }

  // 全ユーザーを取得（管理者用）
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

  // 新しいユーザーを作成
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

  // ユーザーを更新
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

  // ユーザー情報を更新（パスワード込み）
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

  // ユーザーを削除
  static async delete(id: string): Promise<User> {
    return prisma.user.delete({
      where: { id }
    })
  }

  // パスワードを検証
  static async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password)
  }

  // パスワードを更新
  static async updatePassword(id: string, newPassword: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(newPassword, 12)
    
    return prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    })
  }

  // メールアドレス重複チェック（自分以外）
  static async checkEmailDuplication(email: string, excludeId?: string): Promise<boolean> {
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })
    
    return existingUser !== null && existingUser.id !== excludeId
  }
}