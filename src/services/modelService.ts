import { prisma } from '@/lib/prisma'
import { Model } from '@prisma/client'

export type ModelStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'BANNED'
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
  static async findByUserId(userId: string): Promise<Model[]> {
    return prisma.model.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })
  }

  static async findById(id: string): Promise<Model | null> {
    return prisma.model.findUnique({
      where: { id }
    })
  }

  static async create(data: CreateModelData): Promise<Model> {
    return prisma.model.create({
      data: {
        ...data,
        description: data.description || null,
        status: 'PENDING'
      }
    })
  }

  static async update(id: string, data: UpdateModelData): Promise<Model> {
    const { status, ...rest } = data
    const updateData: any = { ...rest }
    if (status) {
      updateData.status = status
    }

    return prisma.model.update({
      where: { id },
      data: updateData,
    })
  }

  static async delete(id: string): Promise<Model> {
    return prisma.model.delete({
      where: { id }
    })
  }

  static async updateStatus(id: string, status: ModelStatus): Promise<Model> {
    return prisma.model.update({
      where: { id },
      data: { status }
    })
  }

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
