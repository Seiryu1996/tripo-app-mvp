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

export class TripoService {
  private static apiKey = process.env.TRIPO_API_KEY
  private static apiUrl = process.env.TRIPO_API_URL

  static async startGeneration(modelId: string, inputType: 'TEXT' | 'IMAGE', inputData: string, options?: { texture?: boolean }): Promise<void> {
    try {
      await ModelService.updateStatus(modelId, 'PROCESSING')

      if (!this.apiKey || !this.apiUrl) {
        console.error('[Tripo] Missing API configuration')
        await ModelService.updateStatus(modelId, 'FAILED')
        return
      }

      const payload = inputType === 'TEXT' 
        ? { type: 'text_to_model', prompt: inputData, texture: options?.texture || false }
        : { type: 'image_to_model', file: inputData, texture: options?.texture || false }

      const response = await fetch(`${this.apiUrl}/task`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data: TripoResponse = await response.json()

      if (response.ok && data.code === 0 && data.data?.task_id) {
        const taskId = data.data.task_id
        await ModelService.setTripoTaskId(modelId, taskId)
        this.pollTask(modelId, taskId)
      } else {
        console.error(`[Tripo] Task creation failed:`, data)
        await ModelService.updateStatus(modelId, 'FAILED')
      }

    } catch (error) {
      console.error('[Tripo] Generation error:', error)
      await ModelService.updateStatus(modelId, 'FAILED')
    }
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
      setTimeout(() => this.pollTask(modelId, taskId), 60000)
    }
  }
}
