import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const modelUrl = searchParams.get('url')

  if (!modelUrl) {
    return NextResponse.json(
      { error: 'Model URL is required' },
      { status: 400 }
    )
  }

  const decodedUrl = decodeURIComponent(modelUrl)

  try {
    const response = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Referer': 'https://platform.tripo3d.ai/',
        'Origin': 'https://platform.tripo3d.ai'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    const contentLength = response.headers.get('content-length')

    const arrayBuffer = await response.arrayBuffer()

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': contentLength || arrayBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })

  } catch (error: any) {
    console.error('[Proxy] Error:', error.message)
    console.error('[Proxy] URL:', decodedUrl)
    
    // 403エラーの場合は詳細なエラーメッセージを返す
    if (error.message.includes('403')) {
      return NextResponse.json(
        { error: 'モデルURLの有効期限が切れているか、アクセス権限がありません。モデルを再生成してください。' },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { error: `Failed to fetch model: ${error.message}` },
      { status: 500 }
    )
  }
}