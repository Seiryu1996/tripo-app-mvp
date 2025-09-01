import { prisma } from '@/lib/prisma'
import { Model } from '@prisma/client'

export type ModelStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
export type InputType = 'TEXT' | 'IMAGE'

export interface CreateModelData {
  userId: string
  title: string
  description?: string
  inputType: InputType
  inputData: string
}

export interface UpdateModelData {
  status?: ModelStatus
  tripoTaskId?: string
  modelUrl?: string
  previewUrl?: string
}

export class ModelService {
  // ユーザーの全モデルを取得
  static async findByUserId(userId: string): Promise<Model[]> {
    return prisma.model.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })
  }

  // モデルをIDで取得
  static async findById(id: string): Promise<Model | null> {
    return prisma.model.findUnique({
      where: { id }
    })
  }

  // 新しいモデルを作成
  static async create(data: CreateModelData): Promise<Model> {
    return prisma.model.create({
      data: {
        ...data,
        description: data.description || null,
        status: 'PENDING'
      }
    })
  }

  // モデルを更新
  static async update(id: string, data: UpdateModelData): Promise<Model> {
    return prisma.model.update({
      where: { id },
      data
    })
  }

  // モデルを削除
  static async delete(id: string): Promise<Model> {
    return prisma.model.delete({
      where: { id }
    })
  }

  // ステータスを更新
  static async updateStatus(id: string, status: ModelStatus): Promise<Model> {
    return prisma.model.update({
      where: { id },
      data: { status }
    })
  }

  // 完了時にURLを設定
  static async completeModel(id: string, modelUrl: string, previewUrl?: string): Promise<Model> {
    return prisma.model.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        modelUrl,
        previewUrl
      }
    })
  }

  // TripoタスクIDを設定
  static async setTripoTaskId(id: string, taskId: string): Promise<Model> {
    return prisma.model.update({
      where: { id },
      data: { 
        tripoTaskId: taskId,
        status: 'PROCESSING'
      }
    })
  }
}