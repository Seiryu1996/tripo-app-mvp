import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { ModelService } from '@/services/modelService'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request)
    const modelId = params.id

    const model = await ModelService.findById(modelId)
    if (!model) {
      return NextResponse.json(
        { error: 'モデルが見つかりません' },
        { status: 404 }
      )
    }

    if (model.userId !== user.id) {
      return NextResponse.json(
        { error: 'このモデルを削除する権限がありません' },
        { status: 403 }
      )
    }

    await ModelService.delete(modelId)

    return NextResponse.json({
      message: 'モデルを削除しました'
    })

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }

    console.error('Delete model error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
