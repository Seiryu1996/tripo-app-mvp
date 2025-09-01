import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'

// APIルートを動的として明示的に指定
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)

    if (!user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }

    return NextResponse.json(user)

  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}