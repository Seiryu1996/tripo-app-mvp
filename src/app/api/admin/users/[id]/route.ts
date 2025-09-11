import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { UserService } from '@/services/userService'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request)

    const { name, email, password, role } = await request.json()

    if (!name || !email) {
      return NextResponse.json(
        { error: '必要な情報が入力されていません' },
        { status: 400 }
      )
    }

    // 他のユーザーが同じメールアドレスを使用していないかチェック
    const isDuplicate = await UserService.checkEmailDuplication(email, params.id)

    if (isDuplicate) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に使用されています' },
        { status: 400 }
      )
    }

    const user = await UserService.updateWithPassword(params.id, {
      name,
      email,
      role: role || 'USER',
      password
    })

    return NextResponse.json({
      message: 'ユーザー情報を更新しました',
      user
    })

  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      )
    }

    console.error('Update user error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request)
    await UserService.delete(params.id)

    return NextResponse.json({
      message: 'ユーザーを削除しました'
    })

  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      )
    }

    console.error('Delete user error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}