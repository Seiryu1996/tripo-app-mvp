import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    const models = await prisma.model.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ models })

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }

    console.error('Get models error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const { title, description, inputType, inputData } = await request.json()

    if (!title || !inputData || !inputType) {
      return NextResponse.json(
        { error: '必要な情報が入力されていません' },
        { status: 400 }
      )
    }

    if (!['TEXT', 'IMAGE'].includes(inputType)) {
      return NextResponse.json(
        { error: '無効な入力タイプです' },
        { status: 400 }
      )
    }

    const model = await prisma.model.create({
      data: {
        userId: user.id,
        title,
        description: description || null,
        inputType,
        inputData,
        status: 'PENDING'
      }
    })

    // Tripo APIを呼び出して3Dモデル生成を開始
    startTripoGeneration(model.id, inputType, inputData)

    return NextResponse.json({
      message: '3Dモデル生成を開始しました',
      model
    })

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }

    console.error('Create model error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

// Tripo API呼び出し（非同期）
async function startTripoGeneration(modelId: string, inputType: string, inputData: string) {
  try {
    // まずステータスを「処理中」に更新
    await prisma.model.update({
      where: { id: modelId },
      data: { status: 'PROCESSING' }
    })

    // Tripo APIの設定
    const tripoApiKey = process.env.TRIPO_API_KEY
    const tripoApiUrl = process.env.TRIPO_API_URL

    if (!tripoApiKey || !tripoApiUrl) {
      throw new Error('Tripo API設定が不完全です')
    }

    // Tripo APIにリクエストを送信
    const tripoPayload = inputType === 'TEXT' 
      ? { type: 'text_to_model', prompt: inputData }
      : { type: 'image_to_model', file: inputData }

    const response = await fetch(`${tripoApiUrl}/task`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tripoApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tripoPayload)
    })

    const data = await response.json()

    if (response.ok && data.task_id) {
      // タスクIDを保存
      await prisma.model.update({
        where: { id: modelId },
        data: { tripoTaskId: data.task_id }
      })

      // ポーリングでタスク状況をチェック
      pollTripoTask(modelId, data.task_id)
    } else {
      // エラーの場合は失敗状態に更新
      await prisma.model.update({
        where: { id: modelId },
        data: { status: 'FAILED' }
      })
    }

  } catch (error) {
    console.error('Tripo generation error:', error)
    await prisma.model.update({
      where: { id: modelId },
      data: { status: 'FAILED' }
    })
  }
}

// Tripoタスクの状況をポーリング
async function pollTripoTask(modelId: string, taskId: string) {
  try {
    const tripoApiKey = process.env.TRIPO_API_KEY
    const tripoApiUrl = process.env.TRIPO_API_URL

    const response = await fetch(`${tripoApiUrl}/task/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${tripoApiKey}`
      }
    })

    const data = await response.json()

    if (response.ok) {
      if (data.status === 'success' && data.result) {
        // 完了時
        await prisma.model.update({
          where: { id: modelId },
          data: {
            status: 'COMPLETED',
            modelUrl: data.result.model,
            previewUrl: data.result.preview_image
          }
        })
      } else if (data.status === 'failed') {
        // 失敗時
        await prisma.model.update({
          where: { id: modelId },
          data: { status: 'FAILED' }
        })
      } else if (data.status === 'running') {
        // まだ処理中の場合、30秒後に再度チェック
        setTimeout(() => pollTripoTask(modelId, taskId), 30000)
      }
    } else {
      // APIエラーの場合
      await prisma.model.update({
        where: { id: modelId },
        data: { status: 'FAILED' }
      })
    }

  } catch (error) {
    console.error('Polling error:', error)
    // エラーが発生した場合は60秒後に再試行（最大5回まで）
    // 実装の簡略化のため、ここでは失敗として処理
    await prisma.model.update({
      where: { id: modelId },
      data: { status: 'FAILED' }
    })
  }
}