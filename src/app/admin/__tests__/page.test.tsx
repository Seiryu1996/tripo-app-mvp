import React from 'react'
import { render, screen, waitFor, within, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import AdminPage from '../page'

jest.mock('@/components/Navigation', () => () => <nav data-testid="navigation" />)
jest.mock('next/navigation', () => ({ useRouter: jest.fn() }))
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

global.fetch = jest.fn()

const mockPush = jest.fn()
const mockRouter = { push: mockPush }
const iso = (d: Date) => d.toISOString()

describe('AdminPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    mockLocalStorage.getItem.mockReturnValue('token')
    ;(fetch as jest.Mock).mockReset()
  })

  test('トークンが無い場合はログインへリダイレクト', async () => {
    mockLocalStorage.getItem.mockReturnValue(null)
    render(<AdminPage />)
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'))
  })

  test('権限チェック中にネットワークエラーでログインへリダイレクト', async () => {
    mockLocalStorage.getItem.mockReturnValue('token')
    ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('network'))
    render(<AdminPage />)
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'))
  })

  test('権限チェックでADMINでない場合はログインへリダイレクト', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'u', role: 'USER' }) })
    render(<AdminPage />)
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'))
  })

  test('権限チェックでレスポンスok=falseでもログインへリダイレクト', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    render(<AdminPage />)
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'))
  })

  test('初期ロードでユーザー一覧を表示', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'admin', role: 'ADMIN' }) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        users: [
          { id: '1', email: 'a@example.com', name: 'A', role: 'ADMIN', createdAt: iso(new Date()) },
          { id: '2', email: 'b@example.com', name: 'B', role: 'USER', createdAt: iso(new Date()) },
        ],
      }),
    })

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByText('ユーザー管理')).toBeInTheDocument()
      expect(screen.getByText('A')).toBeInTheDocument()
      expect(screen.getByText('a@example.com')).toBeInTheDocument()
      expect(screen.getByText('B')).toBeInTheDocument()
      expect(screen.getByText('b@example.com')).toBeInTheDocument()
      expect(screen.getByText('管理者')).toBeInTheDocument()
      expect(screen.getByText('一般ユーザー')).toBeInTheDocument()
    })
  })

  test('ユーザー一覧APIがok=falseでも処理が継続する（else分岐）', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'admin', role: 'ADMIN' }) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({}) })

    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getByText('ユーザー管理')).toBeInTheDocument()
      expect(screen.queryByText('A')).not.toBeInTheDocument()
    })
  })

  test('「新規ユーザー作成」の表示・作成成功で一覧更新', async () => {
    const user = userEvent.setup()
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'admin', role: 'ADMIN' }) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ users: [] }) })

    render(<AdminPage />)
    await waitFor(() => screen.getByText('ユーザー管理'))

    await user.click(screen.getByRole('button', { name: '新規ユーザー作成' }))
    expect(screen.getByText('新規ユーザー作成')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('田中太郎'), 'New User')
    await user.type(screen.getByPlaceholderText('user@example.com'), 'new@example.com')
    await user.type(screen.getByPlaceholderText('パスワードを設定'), 'P@ssw0rd!')
    
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ users: [{ id: 'x', email: 'new@example.com', name: 'New User', role: 'USER', createdAt: iso(new Date()) }] }) })

    await user.click(screen.getByRole('button', { name: '作成' }))

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '新規ユーザー作成' })).not.toBeInTheDocument()
      expect(screen.getByText('New User')).toBeInTheDocument()
      expect(screen.getByText('new@example.com')).toBeInTheDocument()
    })
  })

  test('作成時にネットワークエラーでキャッチ分岐を通る', async () => {
    const user = userEvent.setup()
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'admin', role: 'ADMIN' }) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ users: [] }) })

    render(<AdminPage />)
    await waitFor(() => screen.getByText('ユーザー管理'))
    await user.click(screen.getByRole('button', { name: '新規ユーザー作成' }))
    await user.type(screen.getByPlaceholderText('田中太郎'), 'Err User')
    await user.type(screen.getByPlaceholderText('user@example.com'), 'err@example.com')
    await user.type(screen.getByPlaceholderText('パスワードを設定'), 'pass')
    ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('network'))
    await user.click(screen.getByRole('button', { name: '作成' }))
    await waitFor(() => expect(screen.getByText('操作に失敗しました')).toBeInTheDocument())
  })

  test('編集ボタンでフォームに値を反映し、更新成功で閉じる', async () => {
    const user = userEvent.setup()
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'admin', role: 'ADMIN' }) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ users: [{ id: 'u1', email: 'old@example.com', name: 'Old', role: 'USER', createdAt: iso(new Date()) }] }) })

    render(<AdminPage />)
    await waitFor(() => screen.getByText('Old'))

    await user.click(screen.getByRole('button', { name: '編集' }))
    expect(screen.getByText('ユーザー編集')).toBeInTheDocument()

    const nameInput = screen.getByPlaceholderText('田中太郎') as HTMLInputElement
    const emailInput = screen.getByPlaceholderText('user@example.com') as HTMLInputElement
    expect(nameInput.value).toBe('Old')
    expect(emailInput.value).toBe('old@example.com')

    await user.clear(nameInput)
    await user.type(nameInput, 'Updated')

    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ users: [{ id: 'u1', email: 'old@example.com', name: 'Updated', role: 'USER', createdAt: iso(new Date()) }] }) })

    await user.click(screen.getByRole('button', { name: '更新' }))

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'ユーザー編集' })).not.toBeInTheDocument()
      expect(screen.getByText('Updated')).toBeInTheDocument()
    })
  })

  test('作成時はパスワード必須、編集時は任意', async () => {
    const user = userEvent.setup()
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'admin', role: 'ADMIN' }) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ users: [{ id: 'u1', email: 'a@example.com', name: 'A', role: 'USER', createdAt: iso(new Date()) }] }) })

    render(<AdminPage />)
    await waitFor(() => screen.getByText('ユーザー管理'))

    await user.click(screen.getByRole('button', { name: '新規ユーザー作成' }))
    const pwdCreate = screen.getByPlaceholderText('パスワードを設定')
    expect(pwdCreate).toBeRequired()
    
    const formSection = screen.getByRole('heading', { name: '新規ユーザー作成' }).closest('div') as HTMLElement
    await user.click(within(formSection).getByRole('button', { name: 'キャンセル' }))
    await user.click(screen.getByRole('button', { name: '編集' }))
    const pwdEdit = screen.getByPlaceholderText('変更する場合のみ入力')
    expect(pwdEdit).not.toBeRequired()
  })

  test('作成失敗でエラーメッセージ表示、更新失敗でも表示', async () => {
    const user = userEvent.setup()
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'admin', role: 'ADMIN' }) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ users: [] }) })

    const { unmount } = render(<AdminPage />)
    await waitFor(() => screen.getByText('ユーザー管理'))

    await user.click(screen.getByRole('button', { name: '新規ユーザー作成' }))
    await user.type(screen.getByPlaceholderText('田中太郎'), 'Err User')
    await user.type(screen.getByPlaceholderText('user@example.com'), 'err@example.com')
    await user.type(screen.getByPlaceholderText('パスワードを設定'), 'short')

    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({ error: '操作に失敗しました' }) })
    await user.click(screen.getByRole('button', { name: '作成' }))
    await waitFor(() => expect(screen.getByText('操作に失敗しました')).toBeInTheDocument())
    unmount()
    cleanup()

    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'admin', role: 'ADMIN' }) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ users: [{ id: 'u1', email: 'a@example.com', name: 'A', role: 'USER', createdAt: iso(new Date()) }] }) })
    
    render(<AdminPage />)
    await waitFor(() => screen.getByText('A'))
    await user.click(screen.getByRole('button', { name: '編集' }))
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({ error: '操作に失敗しました' }) })
    await user.click(screen.getByRole('button', { name: '更新' }))
    await waitFor(() => expect(screen.getByText('操作に失敗しました')).toBeInTheDocument())
  })

  test('作成失敗（エラー文言なし）でフォールバックの「操作に失敗しました」を表示', async () => {
    const user = userEvent.setup()
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'admin', role: 'ADMIN' }) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ users: [] }) })

    render(<AdminPage />)
    await waitFor(() => screen.getByText('ユーザー管理'))

    await user.click(screen.getByRole('button', { name: '新規ユーザー作成' }))
    await user.type(screen.getByPlaceholderText('田中太郎'), 'NoErr')
    await user.type(screen.getByPlaceholderText('user@example.com'), 'noerr@example.com')
    await user.type(screen.getByPlaceholderText('パスワードを設定'), 'P@ss')

    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    await user.click(screen.getByRole('button', { name: '作成' }))
    await waitFor(() => expect(screen.getByText('操作に失敗しました')).toBeInTheDocument())
  })

  test('削除の確認ダイアログでOK時は削除API、キャンセル時は呼ばない', async () => {
    const user = userEvent.setup()
    const confirmSpy = jest.spyOn(window, 'confirm')
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'admin', role: 'ADMIN' }) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ users: [{ id: 'u1', email: 'x@example.com', name: 'X', role: 'USER', createdAt: iso(new Date()) }] }) })

    render(<AdminPage />)
    await waitFor(() => screen.getByText('X'))

    confirmSpy.mockReturnValueOnce(false)
    await user.click(screen.getByRole('button', { name: '削除' }))
    expect((fetch as jest.Mock).mock.calls.some(([, opts]) => (opts as any)?.method === 'DELETE')).toBe(false)

    confirmSpy.mockReturnValueOnce(true)
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ users: [] }) })
    await user.click(screen.getByRole('button', { name: '削除' }))
    await waitFor(() => {
      expect((fetch as jest.Mock).mock.calls.some(([, opts]) => (opts as any)?.method === 'DELETE')).toBe(true)
    })

    confirmSpy.mockRestore()
  })

  test('削除失敗時にエラーメッセージ表示', async () => {
    const user = userEvent.setup()
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'admin', role: 'ADMIN' }) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ users: [{ id: 'u1', email: 'x@example.com', name: 'X', role: 'USER', createdAt: iso(new Date()) }] }) })

    render(<AdminPage />)
    await waitFor(() => screen.getByText('X'))

    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    await user.click(screen.getByRole('button', { name: '削除' }))
    await waitFor(() => expect(screen.getByText('削除に失敗しました')).toBeInTheDocument())

    confirmSpy.mockRestore()
  })

  test('自分の削除クリックでエラーメッセージ表示、confirm/DELETE は呼ばれない', async () => {
    const user = userEvent.setup()
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'u1', role: 'ADMIN' }) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ users: [
      { id: 'u1', email: 'self@example.com', name: 'Self', role: 'ADMIN', createdAt: iso(new Date()) },
      { id: 'u2', email: 'other@example.com', name: 'Other', role: 'USER', createdAt: iso(new Date()) },
    ] }) })

    const confirmSpy = jest.spyOn(window, 'confirm')

    render(<AdminPage />)
    await waitFor(() => screen.getByText('Self'))

    const selfRow = screen.getByText('Self').closest('tr') as HTMLElement
    const selfDeleteBtn = within(selfRow).getByRole('button', { name: '削除' })
    await user.click(selfDeleteBtn)
    await waitFor(() => expect(screen.getByText('自分のアカウントは削除できません')).toBeInTheDocument())

    expect(confirmSpy).not.toHaveBeenCalled()
    expect((fetch as jest.Mock).mock.calls.some(([, opts]) => (opts as any)?.method === 'DELETE')).toBe(false)

    confirmSpy.mockRestore()
  })

  test('削除APIが返すエラー文言（自己削除禁止）を画面に表示する', async () => {
    const user = userEvent.setup()
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'admin', role: 'ADMIN' }) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ users: [
      { id: 'u2', email: 'other@example.com', name: 'Other', role: 'USER', createdAt: iso(new Date()) },
    ] }) })

    render(<AdminPage />)
    await waitFor(() => screen.getByText('Other'))

    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({ error: '自分自身のアカウントは削除できません' }) })
    await user.click(screen.getByRole('button', { name: '削除' }))

    await waitFor(() => expect(screen.getByText('自分自身のアカウントは削除できません')).toBeInTheDocument())

    confirmSpy.mockRestore()
  })

  test('削除APIのレスポンスで json() が失敗した場合のフォールバック文言表示', async () => {
    const user = userEvent.setup()
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'admin', role: 'ADMIN' }) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ users: [
      { id: 'u1', email: 'x@example.com', name: 'X', role: 'USER', createdAt: iso(new Date()) },
    ] }) })

    render(<AdminPage />)
    await waitFor(() => screen.getByText('X'))

    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => { throw new Error('bad json') } })
    await user.click(screen.getByRole('button', { name: '削除' }))

    await waitFor(() => expect(screen.getByText('削除に失敗しました')).toBeInTheDocument())

    confirmSpy.mockRestore()
  })

  test('削除時にネットワークエラーでキャッチ分岐を通る', async () => {
    const user = userEvent.setup()
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'admin', role: 'ADMIN' }) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ users: [{ id: 'u1', email: 'x@example.com', name: 'X', role: 'USER', createdAt: iso(new Date()) }] }) })

    render(<AdminPage />)
    await waitFor(() => screen.getByText('X'))
    ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('network'))
    await user.click(screen.getByRole('button', { name: '削除' }))
    await waitFor(() => expect(screen.getByText('削除に失敗しました')).toBeInTheDocument())
    confirmSpy.mockRestore()
  })

  test('権限変更（USER→ADMIN）の更新が反映される', async () => {
    const user = userEvent.setup()
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'admin', role: 'ADMIN' }) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ users: [{ id: 'u1', email: 'role@example.com', name: 'RoleUser', role: 'USER', createdAt: iso(new Date()) }] }) })

    render(<AdminPage />)
    await waitFor(() => screen.getByText('RoleUser'))

    await user.click(screen.getByRole('button', { name: '編集' }))
    const roleSelect = screen.getByLabelText('権限') as HTMLSelectElement
    await user.selectOptions(roleSelect, 'ADMIN')

    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ users: [{ id: 'u1', email: 'role@example.com', name: 'RoleUser', role: 'ADMIN', createdAt: iso(new Date()) }] }) })

    await user.click(screen.getByRole('button', { name: '更新' }))
    await waitFor(() => expect(screen.getByText('管理者')).toBeInTheDocument())
  })

  test('ユーザー一覧取得エラーでエラーメッセージ表示', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'admin', role: 'ADMIN' }) })
    ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('network'))

    render(<AdminPage />)
    await waitFor(() => expect(screen.getByText('ユーザー一覧の取得に失敗しました')).toBeInTheDocument())
  })
})
