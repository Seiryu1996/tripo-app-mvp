import { Buffer } from 'buffer'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { ModelService } from '@/services/modelService'
import { TripoService } from '@/services/tripoService'
import { StorageService } from '@/services/storageService'

const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const IMAGE_FETCH_TIMEOUT_MS = 15000
const IMAGE_FETCH_RETRY_LIMIT = 3

interface FetchImageResult {
  buffer: Buffer
  contentType: string
}

function isRetriableFetchError(error: any) {
  if (!error) return false
  const code = error?.code || error?.cause?.code
  return code === 'UND_ERR_CONNECT_TIMEOUT' ||
         code === 'UND_ERR_SOCKET' ||
         code === 'ECONNRESET' ||
         code === 'ETIMEDOUT'
}

async function fetchImageWithRetry(url: string, attempt = 1): Promise<FetchImageResult> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS)

    const response = await fetch(url, {
      signal: controller.signal
    })

    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`Failed to fetch image from URL: ${response.status} ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type') || 'image/png'
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (!buffer.length) {
      throw new Error('Fetched image is empty')
    }

    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new Error('Image size exceeds Tripo limit')
    }

    return { buffer, contentType }

  } catch (error) {
    if (attempt < IMAGE_FETCH_RETRY_LIMIT && isRetriableFetchError(error)) {
      const delay = attempt * 1000
      console.warn(`[ImageFetch] Retry ${attempt}/${IMAGE_FETCH_RETRY_LIMIT - 1} in ${delay}ms due to:`, error)
      await new Promise(resolve => setTimeout(resolve, delay))
      return fetchImageWithRetry(url, attempt + 1)
    }
    throw error
  }
}

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
      imageMode,
      imageFilename,
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

    const isUploadImage = inputType === 'IMAGE' && (imageMode === 'UPLOAD' || inputData.startsWith('data:'))

    if (inputType === 'IMAGE') {
      if (isUploadImage) {
        if (!inputData.startsWith('data:')) {
          return NextResponse.json(
            { error: '画像データの形式が正しくありません' },
            { status: 400 }
          )
        }
      } else {
        try {
          const url = new URL(inputData)
          if (!['http:', 'https:'].includes(url.protocol)) {
            throw new Error('Invalid protocol')
          }
        } catch (error) {
          return NextResponse.json(
            { error: '有効な画像URLを入力してください' },
            { status: 400 }
          )
        }
      }
    }

    let enhancedPrompt = inputData
    
    if (inputType === 'TEXT') {
      const details = []
      
      if (width || height || depth) {
        const dimensions = []
        if (width) dimensions.push(`width ${width}cm`)
        if (height) dimensions.push(`height ${height}cm`)
        if (depth) dimensions.push(`depth ${depth}cm`)
        details.push(`dimensions: ${dimensions.join(', ')}`)
      }
      
      if (material) {
        details.push(`material: ${material}`)
      }
      
      if (color) {
        details.push(`color: ${color}`)
      }
      
      if (style) {
        details.push(`style: ${style}`)
      }
      
      const qualityDescriptions: { [key: string]: string } = {
        low: 'simple design',
        medium: 'balanced detail',
        high: 'highly detailed, professional quality'
      }
      if (quality && qualityDescriptions[quality]) {
        details.push(qualityDescriptions[quality])
      }
      
      if (texture) {
        details.push('with realistic textures and surface details')
      }
      
      if (details.length > 0) {
        enhancedPrompt = `${inputData}. ${details.join(', ')}.`
      }
    }

    let generationInput = inputType === 'TEXT' ? enhancedPrompt : inputData
    const storedInput = inputType === 'TEXT'
      ? enhancedPrompt
      : isUploadImage
        ? `upload:${imageFilename || 'image'}`
        : inputData

    const model = await ModelService.create({
      userId: user.id,
      title,
      description,
      inputType,
      inputData: storedInput
    })

    let filePayload: { url?: string; type?: string; fileToken?: string } | undefined

    if (inputType === 'IMAGE' && isUploadImage) {
      if (!StorageService.isConfigured()) {
        await ModelService.delete(model.id)
        return NextResponse.json(
          { error: '画像を処理するためのストレージが構成されていません' },
          { status: 500 }
        )
      }

      try {
        const uploadResult = await StorageService.uploadInputImage({
          dataUri: inputData,
          userId: user.id,
          modelId: model.id,
          filename: imageFilename || 'image'
        })

        const tripoUpload = await TripoService.uploadImageDataUri(inputData, imageFilename || 'image')

        generationInput = `token:${tripoUpload.fileToken}`
        filePayload = {
          fileToken: tripoUpload.fileToken,
          type: tripoUpload.contentType || uploadResult.contentType
        }
      } catch (error) {
        console.error('Failed to upload input image:', error)
        await ModelService.delete(model.id)
        return NextResponse.json(
          { error: '画像のアップロードに失敗しました' },
          { status: 500 }
        )
      }
    } else if (inputType === 'IMAGE') {
      try {
        const { buffer, contentType } = await fetchImageWithRetry(generationInput)

        const dataUri = `data:${contentType};base64,${buffer.toString('base64')}`
        const tripoUpload = await TripoService.uploadImageDataUri(dataUri, imageFilename || 'image')

        generationInput = `token:${tripoUpload.fileToken}`
        filePayload = {
          fileToken: tripoUpload.fileToken,
          type: tripoUpload.contentType || contentType
        }
      } catch (error) {
        console.error('Failed to prepare image URL for Tripo:', error)
        await ModelService.delete(model.id)
        return NextResponse.json(
          { error: '画像URLの取得に失敗しました' },
          { status: 400 }
        )
      }
    }

    const generationStarted = await TripoService.startGeneration(model.id, inputType, generationInput, {
      texture,
      imageFile: filePayload
    })

    if (!generationStarted) {
      try {
        await ModelService.delete(model.id)
      } catch (deleteError) {
        console.error('Failed to remove model after generation start failure:', deleteError)
      }
      return NextResponse.json(
        { error: '3Dモデル生成の開始に失敗しました' },
        { status: 502 }
      )
    }

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
