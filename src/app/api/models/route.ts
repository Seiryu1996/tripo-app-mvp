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
    const { 
      title, 
      description, 
      inputType, 
      inputData, 
      width, 
      height, 
      depth, 
      material, 
      color, 
      style, 
      quality, 
      texture 
    } = await request.json()

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

    // 詳細情報を含めた拡張プロンプトを作成
    let enhancedPrompt = inputData
    
    if (inputType === 'TEXT') {
      const details = []
      
      // サイズ情報
      if (width || height || depth) {
        const dimensions = []
        if (width) dimensions.push(`width ${width}cm`)
        if (height) dimensions.push(`height ${height}cm`)
        if (depth) dimensions.push(`depth ${depth}cm`)
        details.push(`dimensions: ${dimensions.join(', ')}`)
      }
      
      // 材質
      if (material) {
        details.push(`material: ${material}`)
      }
      
      // 色
      if (color) {
        details.push(`color: ${color}`)
      }
      
      // スタイル
      if (style) {
        details.push(`style: ${style}`)
      }
      
      // 品質設定
      const qualityDescriptions: { [key: string]: string } = {
        low: 'simple design',
        medium: 'balanced detail',
        high: 'highly detailed, professional quality'
      }
      if (quality && qualityDescriptions[quality]) {
        details.push(qualityDescriptions[quality])
      }
      
      // テクスチャ
      if (texture) {
        details.push('with realistic textures and surface details')
      }
      
      // プロンプトを拡張
      if (details.length > 0) {
        enhancedPrompt = `${inputData}. ${details.join(', ')}.`
      }
    }

    // モデルを作成
    const model = await ModelService.create({
      userId: user.id,
      title,
      description,
      inputType,
      inputData: enhancedPrompt
    })

    // Tripo APIを呼び出して3Dモデル生成を開始（テクスチャオプション付き）
    TripoService.startGeneration(model.id, inputType, enhancedPrompt, { texture })

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


