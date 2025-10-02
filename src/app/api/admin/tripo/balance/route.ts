import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { TripoService } from '@/services/tripoService'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const balance = await TripoService.getBalance()
    return NextResponse.json(balance)
  } catch (error: any) {
    if (error?.message === 'Unauthorized' || error?.message === 'Admin access required') {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      )
    }

    const message = typeof error?.message === 'string'
      ? error.message
      : 'Tripo残クレジットの取得に失敗しました'

    console.error('Get Tripo balance error:', error)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
