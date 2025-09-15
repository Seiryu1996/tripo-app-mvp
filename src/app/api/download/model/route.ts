import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    const { searchParams } = new URL(request.url)
    const modelUrl = searchParams.get('url')
    const filename = searchParams.get('filename')

    if (!modelUrl) {
      return NextResponse.json({ error: 'Model URL is required' }, { status: 400 })
    }

    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 })
    }

    const response = await fetch(decodeURIComponent(modelUrl), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*'
      }
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch model from Tripo' }, { status: response.status })
    }

    const blob = await response.arrayBuffer()
    const decodedFilename = decodeURIComponent(filename)
    
    const encodedFilename = encodeURIComponent(decodedFilename)
    
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
        'Content-Length': blob.byteLength.toString(),
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    console.error('Download error:', error)
    return NextResponse.json({ error: 'ダウンロードに失敗しました' }, { status: 500 })
  }
}
