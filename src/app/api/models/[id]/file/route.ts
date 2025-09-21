import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { ModelService } from '@/services/modelService'
import { StorageService } from '@/services/storageService'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request)
    const modelId = params.id
    const model = await ModelService.findById(modelId)

    if (!model || model.userId !== user.id) {
      return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') === 'preview' ? 'preview' : 'model'
    const download = searchParams.get('download') === '1'
    const requestedFilename = searchParams.get('filename') || ''

    const resourcePath = type === 'preview' ? model.previewUrl : model.modelUrl
    if (!resourcePath) {
      return NextResponse.json({ error: 'ファイルが存在しません' }, { status: 404 })
    }

    const { buffer, contentType, contentLength, objectPath } = await StorageService.download(resourcePath)

    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Length': contentLength.toString(),
      'Cache-Control': download ? 'private, max-age=0, no-store' : 'private, max-age=60',
    })

    if (download) {
      let filename = requestedFilename
      if (!filename) {
        const parts = objectPath.split('/')
        filename = parts[parts.length - 1] || `${model.title || 'model'}.glb`
      }
      headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
    }

    const chunk = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(chunk)
        controller.close()
      }
    })

    return new NextResponse(stream, {
      status: 200,
      headers,
    })

  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    console.error('[ModelFile] Error:', error)
    return NextResponse.json({ error: 'ファイル取得に失敗しました' }, { status: 500 })
  }
}
