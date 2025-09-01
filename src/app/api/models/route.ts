import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { ModelService } from '@/services/modelService'
import { TripoService } from '@/services/tripoService'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const models = await ModelService.findByUserId(user.id)
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

    // モデルを作成
    const model = await ModelService.create({
      userId: user.id,
      title,
      description,
      inputType,
      inputData
    })

    // Tripo APIを呼び出して3Dモデル生成を開始
    TripoService.startGeneration(model.id, inputType, inputData)

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


