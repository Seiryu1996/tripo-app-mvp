import { ModelService } from './modelService'

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

  // 3Dモデル生成タスクを開始
  static async startGeneration(modelId: string, inputType: 'TEXT' | 'IMAGE', inputData: string): Promise<void> {
    try {
      console.log(`[Tripo] Starting generation for model ${modelId}`)

      // ステータスを処理中に更新
      await ModelService.updateStatus(modelId, 'PROCESSING')

      if (!this.apiKey || !this.apiUrl) {
        console.error('[Tripo] Missing API configuration')
        await ModelService.updateStatus(modelId, 'FAILED')
        return
      }

      // リクエストペイロードを作成
      const payload = inputType === 'TEXT' 
        ? { type: 'text_to_model', prompt: inputData, texture: false }
        : { type: 'image_to_model', file: inputData, texture: false }

      // Tripo APIにリクエストを送信
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
        console.log(`[Tripo] Task created: ${taskId}`)
        
        // タスクIDを保存
        await ModelService.setTripoTaskId(modelId, taskId)
        
        // ポーリング開始
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

  // タスク状況をポーリング
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
          // 完了処理
          const modelUrl = taskData.result.pbr_model?.url || 
                          taskData.result.model || 
                          taskData.result.model_url
          const previewUrl = taskData.result.rendered_image?.url || 
                           taskData.result.preview_image || 
                           taskData.result.preview_url || 
                           taskData.result.generated_image
          
          console.log(`[Tripo] Task completed for model ${modelId}`)
          
          if (modelUrl) {
            await ModelService.completeModel(modelId, modelUrl, previewUrl)
          } else {
            await ModelService.updateStatus(modelId, 'FAILED')
          }
          
        } else if (taskStatus === 'failed' || taskStatus === 'failure') {
          console.log(`[Tripo] Task failed for model ${modelId}`)
          await ModelService.updateStatus(modelId, 'FAILED')
          
        } else if (taskStatus === 'running' || taskStatus === 'pending' || taskStatus === 'queued') {
          // 5秒後に再ポーリング
          setTimeout(() => this.pollTask(modelId, taskId), 5000)
          
        } else {
          // 未知のステータス - 5秒後に再ポーリング
          setTimeout(() => this.pollTask(modelId, taskId), 5000)
        }
      } else {
        // APIエラー
        if (data?.code !== 0) {
          await ModelService.updateStatus(modelId, 'FAILED')
        } else {
          // HTTPエラー - 60秒後に再試行
          setTimeout(() => this.pollTask(modelId, taskId), 60000)
        }
      }

    } catch (error) {
      console.error('[Tripo] Polling error:', error)
      // 60秒後に再試行
      setTimeout(() => this.pollTask(modelId, taskId), 60000)
    }
  }
}