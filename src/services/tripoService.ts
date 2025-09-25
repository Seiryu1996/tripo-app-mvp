import { Buffer } from 'buffer'
import { ModelService } from './modelService'
import { StorageService } from './storageService'

export interface TripoTaskResult {
  pbr_model?: { url: string }
  model?: string
  model_url?: string
  rendered_image?: { url: string }
  preview_image?: string
  preview_url?: string
  generated_image?: string
}

export interface TripoTaskData {
  task_id: string
  status: string
  result?: TripoTaskResult
}

export interface TripoResponse {
  code: number
  data: TripoTaskData
}

interface TripoUploadResponse {
  code: number
  data?: {
    image_token?: string
  }
}

export class TripoService {
  private static apiKey = process.env.TRIPO_API_KEY
  private static apiUrl = process.env.TRIPO_API_URL

  static async startGeneration(
    modelId: string,
    inputType: 'TEXT' | 'IMAGE',
    inputData: string,
    options?: { texture?: boolean; imageFile?: { url?: string; type?: string; fileToken?: string } }
  ): Promise<boolean> {
    try {
      await ModelService.updateStatus(modelId, 'PROCESSING')

      if (!this.apiKey || !this.apiUrl) {
        console.error('[Tripo] Missing API configuration')
        await ModelService.updateStatus(modelId, 'FAILED')
        return false
      }

      let response: Response
      let data: TripoResponse | null = null

      const payload: Record<string, any> = {
        type: inputType === 'TEXT' ? 'text_to_model' : 'image_to_model',
      }

      if (inputType === 'TEXT') {
        payload.prompt = inputData
      } else {
        const file = options?.imageFile ?? {}
        payload.file = {}

        if (file.fileToken) {
          payload.file.file_token = file.fileToken
        } else if (file.url && (file.url.startsWith('http://') || file.url.startsWith('https://'))) {
          payload.file.url = file.url
        } else if (inputData.startsWith('http://') || inputData.startsWith('https://')) {
          payload.file.url = inputData
        } else {
          throw new Error('Image generation requires an accessible image URL or file_token')
        }

        if (file.type) {
          payload.file.type = file.type
        }
      }

      if (options?.texture !== undefined) {
        payload.texture = options.texture
      }

      const taskResult = await this.createTaskWithRetry(payload)
      response = taskResult.response
      data = taskResult.data
      if (!response.ok && taskResult.rawText) {
        console.error('[Tripo] Raw response text:', taskResult.rawText)
      }

      if (response.ok && data?.code === 0 && data.data?.task_id) {
        const taskId = data.data.task_id
        await ModelService.setTripoTaskId(modelId, taskId)
        this.pollTask(modelId, taskId)
        return true
      } else {
        console.error(`[Tripo] Task creation failed:`, data)
        try {
          console.error('[Tripo] Task failure raw:', JSON.stringify(data))
        } catch {}
        await ModelService.updateStatus(modelId, 'FAILED')
        return false
      }

    } catch (error) {
      console.error('[Tripo] Generation error:', error)
      await ModelService.updateStatus(modelId, 'FAILED')
      return false
    }

    return false
  }

  private static async createTaskWithRetry(
    payload: Record<string, any>,
    attempt = 1
  ): Promise<{ response: Response; data: TripoResponse | null; rawText?: string }> {
    try {
      const response = await fetch(`${this.apiUrl}/task`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      let data: TripoResponse | null = null
      let rawText: string | undefined
      try {
        rawText = await response.text()
        data = rawText ? JSON.parse(rawText) : null
      } catch (parseError) {
        console.error('[Tripo] Failed to parse response JSON:', parseError)
      }

      return { response, data, rawText }

    } catch (error: any) {
      if (this.shouldRetry(error) && attempt < 3) {
        const waitMs = 1000 * attempt
        console.warn(`[Tripo] Request failed (attempt ${attempt}), retrying in ${waitMs}ms`, error)
        await new Promise(resolve => setTimeout(resolve, waitMs))
        return this.createTaskWithRetry(payload, attempt + 1)
      }

      throw error
    }
  }

  private static extensionFromContentType(contentType?: string | null) {
    if (!contentType) return ''
    const map: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/webp': '.webp',
      'image/gif': '.gif'
    }
    return map[contentType.toLowerCase()] || ''
  }

  private static sanitizeUploadFilename(filename?: string, contentType?: string) {
    const fallback = 'upload'
    const extension = this.extensionFromContentType(contentType) || '.png'
    const name = (filename || fallback).trim().replace(/[^a-zA-Z0-9._-]/g, '_') || fallback
    if (name.includes('.')) {
      return name
    }
    return `${name}${extension}`
  }

  static async uploadImageDataUri(dataUri: string, filename?: string) {
    if (!this.apiKey || !this.apiUrl) {
      throw new Error('Tripo API credentials are not configured')
    }

    const match = dataUri.match(/^data:(.*?);base64,(.*)$/)
    if (!match) {
      throw new Error('Invalid data URI format')
    }

    const contentType = match[1] || 'image/png'
    const base64 = match[2]
    const buffer = Buffer.from(base64, 'base64')
    const safeFilename = this.sanitizeUploadFilename(filename, contentType)

    const formData = new FormData()
    formData.append('file', new Blob([buffer], { type: contentType }), safeFilename)

    const response = await fetch(`${this.apiUrl}/upload/sts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData
    })

    const rawText = await response.text()
    let data: TripoUploadResponse | null = null

    try {
      data = rawText ? JSON.parse(rawText) : null
    } catch (error) {
      console.error('[Tripo] Failed to parse upload response:', error, rawText)
      throw new Error('Failed to parse upload response from Tripo')
    }

    if (!response.ok || !data || data.code !== 0 || !data.data?.image_token) {
      console.error('[Tripo] Upload failed:', data)
      throw new Error('Tripo image upload failed')
    }

    return {
      fileToken: data.data.image_token,
      contentType,
    }
  }

  private static shouldRetry(error: any): boolean {
    if (!error) return false
    const code = error?.code || error?.cause?.code
    return code === 'UND_ERR_CONNECT_TIMEOUT' ||
           code === 'UND_ERR_SOCKET' ||
           code === 'ECONNRESET' ||
           code === 'ETIMEDOUT'
  }

  private static async pollTask(modelId: string, taskId: string): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/task/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      })

      const data: TripoResponse = await response.json()

      if (response.ok && data.code === 0) {
        const taskData = data.data
        const taskStatus = taskData?.status

        if (taskStatus === 'success' && taskData?.result) {
          const modelUrl = taskData.result.pbr_model?.url || 
                          taskData.result.model || 
                          taskData.result.model_url
          const previewUrl = taskData.result.rendered_image?.url || 
                           taskData.result.preview_image || 
                           taskData.result.preview_url || 
                           taskData.result.generated_image

          if (!modelUrl) {
            await ModelService.updateStatus(modelId, 'FAILED')
            return
          }

          const modelRecord = await ModelService.findById(modelId)

          if (!modelRecord) {
            console.error(`[Tripo] Model not found during completion: ${modelId}`)
            return
          }

          try {
            let persistedModelUrl = modelUrl
            let persistedPreviewUrl = previewUrl

            if (StorageService.isConfigured()) {
              persistedModelUrl = await StorageService.uploadModelAsset({
                source: modelUrl,
                userId: modelRecord.userId,
                modelId: modelRecord.id,
                filename: 'model',
              })

              if (previewUrl) {
                persistedPreviewUrl = await StorageService.uploadModelAsset({
                  source: previewUrl,
                  userId: modelRecord.userId,
                  modelId: modelRecord.id,
                  filename: 'preview',
                })
              }
            }

            await ModelService.completeModel(modelId, persistedModelUrl, persistedPreviewUrl)
          } catch (error) {
            console.error('[Tripo] Storage upload failed:', error)
            await ModelService.updateStatus(modelId, 'FAILED')
          }
          
        } else if (taskStatus === 'banned' || taskStatus === 'ban') {
          await ModelService.updateStatus(modelId, 'BANNED')
          
        } else if (taskStatus === 'failed' || taskStatus === 'failure') {
          await ModelService.updateStatus(modelId, 'FAILED')
          
        } else if (taskStatus === 'running' || taskStatus === 'pending' || taskStatus === 'queued') {
          setTimeout(() => this.pollTask(modelId, taskId), 5000)
          
        } else {
          setTimeout(() => this.pollTask(modelId, taskId), 5000)
        }
      } else {
        if (data?.code !== 0) {
          await ModelService.updateStatus(modelId, 'FAILED')
        } else {
          setTimeout(() => this.pollTask(modelId, taskId), 60000)
        }
      }

    } catch (error) {
      console.error('[Tripo] Polling error:', error)
      const delay = this.shouldRetry(error) ? 5000 : 60000
      setTimeout(() => this.pollTask(modelId, taskId), delay)
    }
  }
}
