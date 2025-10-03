import React from 'react'
import { render, screen, waitFor, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import AdminPage from '../page'
import { MAX_ADMIN_NAME_LENGTH, MAX_EMAIL_LENGTH, MAX_PASSWORD_LENGTH } from '@/lib/inputLimits'

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

const mockAuthAdmin = (id = 'admin') => (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id, role: 'ADMIN' }) })
const mockUsersResponse = (users: Array<{ id: string; email: string; name: string; role: string; createdAt: string }>) =>
  (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ users }) })
const mockBalanceResponse = (credits = 120, details: Record<string, unknown> = { balance: 120 }) =>
  (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ credits, details }) })

describe('AdminPage', () => {
  const originalConfirm = window.confirm

  beforeAll(() => {
    Object.defineProperty(window, 'confirm', {
      configurable: true,
      writable: true,
      value: jest.fn()
    })
  })

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    mockLocalStorage.getItem.mockReturnValue('token')
    ;(fetch as jest.Mock).mockReset()
  })

  afterEach(() => {
    if (typeof window.confirm === 'function' && 'mockClear' in window.confirm) {
      (window.confirm as unknown as jest.Mock).mockClear()
    }
  })

  afterAll(() => {
    Object.defineProperty(window, 'confirm', {
      configurable: true,
      writable: true,
      value: originalConfirm
    })
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
    mockAuthAdmin()
    mockUsersResponse([
      { id: '1', email: 'a@example.com', name: 'A', role: 'ADMIN', createdAt: iso(new Date()) },
      { id: '2', email: 'b@example.com', name: 'B', role: 'USER', createdAt: iso(new Date()) },
    ])
    mockBalanceResponse(200, { balance: 200, other: 'info' })

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByText('Tripo残クレジット')).toBeInTheDocument()
      expect(screen.getByTestId('tripo-balance-value')).toHaveTextContent('200')
      expect(screen.getByText('credits')).toBeInTheDocument()
      expect(screen.getByText('ユーザー管理')).toBeInTheDocument()
      expect(screen.getByText('A')).toBeInTheDocument()
      expect(screen.getByText('a@example.com')).toBeInTheDocument()
      expect(screen.getByText('B')).toBeInTheDocument()
      expect(screen.getByText('b@example.com')).toBeInTheDocument()
      expect(screen.getByText('管理者')).toBeInTheDocument()
      expect(screen.getByText('一般ユーザー')).toBeInTheDocument()
    })
  })

  test('Tripo残クレジット取得に失敗した場合にエラー表示', async () => {
    mockAuthAdmin()
    mockUsersResponse([])
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'エラー' }) })

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByText('Tripo残クレジット')).toBeInTheDocument()
      expect(screen.getByTestId('tripo-balance-error')).toHaveTextContent('エラー')
    })
  })

  test('Tripo残クレジット取得でネットワークエラー時にフォールバック文言表示', async () => {
    mockAuthAdmin()
    mockUsersResponse([])
    ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('network'))

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByText('Tripo残クレジット')).toBeInTheDocument()
      expect(screen.getByTestId('tripo-balance-error')).toHaveTextContent('Tripo残クレジットの取得に失敗しました')
    })
  })

  test('Tripo残クレジット取得でエラーJSONが壊れている場合でもフォールバック文言表示', async () => {
    mockAuthAdmin()
    mockUsersResponse([])
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => { throw new Error('bad json') }
    })

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByText('Tripo残クレジット')).toBeInTheDocument()
      expect(screen.getByTestId('tripo-balance-error')).toHaveTextContent('Tripo残クレジットの取得に失敗しました')
    })
  })

  test('Tripo残クレジット取得でエラーJSONにメッセージが無い場合はデフォルト文言', async () => {
    mockAuthAdmin()
    mockUsersResponse([])
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({})
    })

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByText('Tripo残クレジット')).toBeInTheDocument()
      expect(screen.getByTestId('tripo-balance-error')).toHaveTextContent('Tripo残クレジットの取得に失敗しました')
    })
  })

  test('Tripo残クレジット取得でコードが非0の場合はエラーメッセージを表示', async () => {
    mockAuthAdmin()
    mockUsersResponse([])
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Tripo残クレジットの取得に失敗しました (API error)' })
    })

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByText('Tripo残クレジット')).toBeInTheDocument()
      expect(screen.getByTestId('tripo-balance-error')).toHaveTextContent('Tripo残クレジットの取得に失敗しました (API error)')
    })
  })

  test('残クレジットを再取得ボタンで更新できる', async () => {
    const user = userEvent.setup()
    mockAuthAdmin()
    mockUsersResponse([])
    mockBalanceResponse(50, { balance: 50 })

    render(<AdminPage />)

    await waitFor(() => expect(screen.getByTestId('tripo-balance-value')).toHaveTextContent('50'))

    mockBalanceResponse(75, { balance: 75 })

    await user.click(screen.getByRole('button', { name: 'Tripo残クレジットを再取得' }))

    await waitFor(() => expect(screen.getByTestId('tripo-balance-value')).toHaveTextContent('75'))

    const balanceFetchCalls = (fetch as jest.Mock).mock.calls.filter(([url]) => url === '/api/admin/tripo/balance')
    expect(balanceFetchCalls.length).toBeGreaterThanOrEqual(2)
  })

  test('残クレジット再取得時にトークンが無い場合はエラーメッセージ表示', async () => {
    const user = userEvent.setup()
    mockAuthAdmin()
    mockUsersResponse([])
    mockBalanceResponse(60, { balance: 60 })

    render(<AdminPage />)
    await waitFor(() => expect(screen.getByTestId('tripo-balance-value')).toHaveTextContent('60'))

    mockLocalStorage.getItem.mockImplementation(() => null)

    await user.click(screen.getByRole('button', { name: 'Tripo残クレジットを再取得' }))

    await waitFor(() => expect(screen.getByTestId('tripo-balance-error')).toHaveTextContent('認証情報が見つかりません'))
  })

  test('新規ユーザー作成ボタンでフォームを開閉すると入力がリセットされる', async () => {
    const user = userEvent.setup()
    mockAuthAdmin()
    mockUsersResponse([])
    mockBalanceResponse()

    render(<AdminPage />)

    const header = (await screen.findByRole('heading', { name: 'ユーザー管理' })).closest('div') as HTMLElement
    await user.click(within(header).getByRole('button', { name: '新規ユーザー作成' }))

    await screen.findByRole('heading', { name: '新規ユーザー作成' })

    const nameInput = screen.getByPlaceholderText('田中太郎') as HTMLInputElement
    const emailInput = screen.getByPlaceholderText('user@example.com') as HTMLInputElement

    await user.type(nameInput, 'Temp User')
    await user.type(emailInput, 'temp@example.com')

    await user.click(within(header).getByRole('button', { name: 'キャンセル' }))

    await waitFor(() => expect(screen.queryByRole('heading', { name: '新規ユーザー作成' })).not.toBeInTheDocument())

    await user.click(within(header).getByRole('button', { name: '新規ユーザー作成' }))
    await screen.findByRole('heading', { name: '新規ユーザー作成' })

    expect(screen.getByPlaceholderText('田中太郎')).toHaveValue('')
    expect(screen.getByPlaceholderText('user@example.com')).toHaveValue('')
  })

  test('ユーザー作成フォームの入力値が最大長でトリミングされる', async () => {
    const user = userEvent.setup()
    mockAuthAdmin()
    mockUsersResponse([])
    mockBalanceResponse()

    render(<AdminPage />)

    await waitFor(() => expect(screen.getByRole('button', { name: '新規ユーザー作成' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: '新規ユーザー作成' }))

    const nameInput = screen.getByLabelText('名前') as HTMLInputElement
    const emailInput = screen.getByLabelText('メールアドレス') as HTMLInputElement
    const passwordInput = screen.getByLabelText('パスワード') as HTMLInputElement

    await user.type(nameInput, 'n'.repeat(MAX_ADMIN_NAME_LENGTH + 50))
    await user.type(emailInput, 'user@example.com')
    await user.type(emailInput, 'x'.repeat(MAX_EMAIL_LENGTH))
    await user.type(passwordInput, 'p'.repeat(MAX_PASSWORD_LENGTH + 30))

    expect(nameInput.value.length).toBe(MAX_ADMIN_NAME_LENGTH)
    expect(emailInput.value.length).toBeLessThanOrEqual(MAX_EMAIL_LENGTH)
    expect(passwordInput.value.length).toBe(MAX_PASSWORD_LENGTH)
  })

  test('ユーザー作成時にメールアドレスの前後スペースが除去されて送信される', async () => {
    const user = userEvent.setup()
    mockAuthAdmin()
    mockUsersResponse([])
    mockBalanceResponse()

    render(<AdminPage />)

    await waitFor(() => expect(screen.getByRole('button', { name: '新規ユーザー作成' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: '新規ユーザー作成' }))

    await user.type(screen.getByLabelText('名前'), '新規ユーザー ')
    await user.type(screen.getByLabelText('メールアドレス'), '  new-user@example.com  ')
    await user.type(screen.getByLabelText('パスワード'), 'password123')

    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ users: [] }) })

    await user.click(screen.getByRole('button', { name: '作成' }))

    await waitFor(() => {
      expect(
        (fetch as jest.Mock).mock.calls.some(
          ([url, options]) =>
            String(url) === '/api/admin/users' && (options as RequestInit | undefined)?.method === 'POST',
        ),
      ).toBe(true)
    })

    const postCall = (fetch as jest.Mock).mock.calls.find(
      ([url, options]) =>
        String(url) === '/api/admin/users' && (options as RequestInit | undefined)?.method === 'POST',
    ) as [string, RequestInit]

    const payload = JSON.parse(postCall[1].body as string)

    expect(payload.email).toBe('new-user@example.com')
    expect(payload.name).toBe('新規ユーザー')
  })

  test('空白のみのメールで送信するとエラーになる', async () => {
    const user = userEvent.setup()
    mockAuthAdmin()
    mockUsersResponse([])
    mockBalanceResponse()

    render(<AdminPage />)

    await waitFor(() => expect(screen.getByRole('button', { name: '新規ユーザー作成' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: '新規ユーザー作成' }))

    await user.type(screen.getByLabelText('名前'), 'ユーザー')
    await user.type(screen.getByLabelText('メールアドレス'), '   ')
    await user.type(screen.getByLabelText('パスワード'), 'password123')

    await user.click(screen.getByRole('button', { name: '作成' }))

    await screen.findByText('メールアドレスは必須です')

    const postRequests = (fetch as jest.Mock).mock.calls.filter(
      ([url, options]) =>
        String(url) === '/api/admin/users' && (options as RequestInit | undefined)?.method === 'POST',
    )

    expect(postRequests.length).toBe(0)
  })

  test('ユーザー一覧APIがok=falseでも処理が継続する（else分岐）', async () => {
    mockAuthAdmin()
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    mockBalanceResponse()

    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getByText('ユーザー管理')).toBeInTheDocument()
      expect(screen.queryByText('A')).not.toBeInTheDocument()
    })
  })

  test('「新規ユーザー作成」の表示・作成成功で一覧更新', async () => {
    const user = userEvent.setup()
    mockAuthAdmin()
    mockUsersResponse([])
    mockBalanceResponse()

    render(<AdminPage />)
    await waitFor(() => screen.getByText('ユーザー管理'))

    await user.click(screen.getByRole('button', { name: '新規ユーザー作成' }))
    expect(screen.getByText('新規ユーザー作成')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('田中太郎'), 'New User')
    await user.type(screen.getByPlaceholderText('user@example.com'), 'new@example.com')
    await user.type(screen.getByPlaceholderText('パスワードを設定'), 'P@ssw0rd!')
    
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    mockUsersResponse([{ id: 'x', email: 'new@example.com', name: 'New User', role: 'USER', createdAt: iso(new Date()) }])

    await user.click(screen.getByRole('button', { name: '作成' }))

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '新規ユーザー作成' })).not.toBeInTheDocument()
      expect(screen.getByText('New User')).toBeInTheDocument()
      expect(screen.getByText('new@example.com')).toBeInTheDocument()
    })
  })

  test('作成時にネットワークエラーでキャッチ分岐を通る', async () => {
    const user = userEvent.setup()
    mockAuthAdmin()
    mockUsersResponse([])
    mockBalanceResponse()

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
    mockAuthAdmin()
    mockUsersResponse([{ id: 'u1', email: 'old@example.com', name: 'Old', role: 'USER', createdAt: iso(new Date()) }])
    mockBalanceResponse()

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
    mockUsersResponse([{ id: 'u1', email: 'old@example.com', name: 'Updated', role: 'USER', createdAt: iso(new Date()) }])

    await user.click(screen.getByRole('button', { name: '更新' }))

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'ユーザー編集' })).not.toBeInTheDocument()
      expect(screen.getByText('Updated')).toBeInTheDocument()
    })
  })

  test('作成時はパスワード必須、編集時は任意', async () => {
    const user = userEvent.setup()
    mockAuthAdmin()
    mockUsersResponse([{ id: 'u1', email: 'a@example.com', name: 'A', role: 'USER', createdAt: iso(new Date()) }])
    mockBalanceResponse()

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
    mockAuthAdmin()
    mockUsersResponse([])
    mockBalanceResponse()

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

    mockAuthAdmin()
    mockUsersResponse([{ id: 'u1', email: 'a@example.com', name: 'A', role: 'USER', createdAt: iso(new Date()) }])
    mockBalanceResponse()
    
    render(<AdminPage />)
    await waitFor(() => screen.getByText('A'))
    await user.click(screen.getByRole('button', { name: '編集' }))
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({ error: '操作に失敗しました' }) })
    await user.click(screen.getByRole('button', { name: '更新' }))
    await waitFor(() => expect(screen.getByText('操作に失敗しました')).toBeInTheDocument())
  })

  test('作成失敗（エラー文言なし）でフォールバックの「操作に失敗しました」を表示', async () => {
    const user = userEvent.setup()
    mockAuthAdmin()
    mockUsersResponse([])
    mockBalanceResponse()

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
    mockAuthAdmin()
    mockUsersResponse([{ id: 'u1', email: 'x@example.com', name: 'X', role: 'USER', createdAt: iso(new Date()) }])
    mockBalanceResponse()

    render(<AdminPage />)
    await waitFor(() => screen.getByText('X'))

    confirmSpy.mockReturnValueOnce(false)
    await user.click(screen.getByRole('button', { name: '削除' }))
    expect((fetch as jest.Mock).mock.calls.some(([, opts]) => (opts as any)?.method === 'DELETE')).toBe(false)

    confirmSpy.mockReturnValueOnce(true)
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    mockUsersResponse([])
    await user.click(screen.getByRole('button', { name: '削除' }))
    await waitFor(() => {
      expect((fetch as jest.Mock).mock.calls.some(([, opts]) => (opts as any)?.method === 'DELETE')).toBe(true)
    })

    confirmSpy.mockRestore()
  })

  test('削除失敗時にエラーメッセージ表示', async () => {
    const user = userEvent.setup()
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    mockAuthAdmin()
    mockUsersResponse([{ id: 'u1', email: 'x@example.com', name: 'X', role: 'USER', createdAt: iso(new Date()) }])
    mockBalanceResponse()

    render(<AdminPage />)
    await waitFor(() => screen.getByText('X'))

    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    await user.click(screen.getByRole('button', { name: '削除' }))
    await waitFor(() => expect(screen.getByText('削除に失敗しました')).toBeInTheDocument())

    confirmSpy.mockRestore()
  })

  test('自分の削除クリックでエラーメッセージ表示、confirm/DELETE は呼ばれない', async () => {
    const user = userEvent.setup()
    mockAuthAdmin('u1')
    mockUsersResponse([
      { id: 'u1', email: 'self@example.com', name: 'Self', role: 'ADMIN', createdAt: iso(new Date()) },
      { id: 'u2', email: 'other@example.com', name: 'Other', role: 'USER', createdAt: iso(new Date()) },
    ])
    mockBalanceResponse()

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
    mockAuthAdmin()
    mockUsersResponse([
      { id: 'u2', email: 'other@example.com', name: 'Other', role: 'USER', createdAt: iso(new Date()) },
    ])
    mockBalanceResponse()

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
    mockAuthAdmin()
    mockUsersResponse([
      { id: 'u1', email: 'x@example.com', name: 'X', role: 'USER', createdAt: iso(new Date()) },
    ])
    mockBalanceResponse()

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
    mockAuthAdmin()
    mockUsersResponse([{ id: 'u1', email: 'x@example.com', name: 'X', role: 'USER', createdAt: iso(new Date()) }])
    mockBalanceResponse()

    render(<AdminPage />)
    await waitFor(() => screen.getByText('X'))
    ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('network'))
    await user.click(screen.getByRole('button', { name: '削除' }))
    await waitFor(() => expect(screen.getByText('削除に失敗しました')).toBeInTheDocument())
    confirmSpy.mockRestore()
  })

  test('権限変更（USER→ADMIN）の更新が反映される', async () => {
    const user = userEvent.setup()
    mockAuthAdmin()
    mockUsersResponse([{ id: 'u1', email: 'role@example.com', name: 'RoleUser', role: 'USER', createdAt: iso(new Date()) }])
    mockBalanceResponse()

    render(<AdminPage />)
    await waitFor(() => screen.getByText('RoleUser'))

    await user.click(screen.getByRole('button', { name: '編集' }))
    const roleSelect = screen.getByLabelText('権限') as HTMLSelectElement
    await user.selectOptions(roleSelect, 'ADMIN')

    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    mockUsersResponse([{ id: 'u1', email: 'role@example.com', name: 'RoleUser', role: 'ADMIN', createdAt: iso(new Date()) }])

    await user.click(screen.getByRole('button', { name: '更新' }))
    await waitFor(() => expect(screen.getByText('管理者')).toBeInTheDocument())
  })

  test('ユーザー一覧取得エラーでエラーメッセージ表示', async () => {
    mockAuthAdmin()
    ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('network'))
    mockBalanceResponse()

    render(<AdminPage />)
    await waitFor(() => expect(screen.getByText('ユーザー一覧の取得に失敗しました')).toBeInTheDocument())
  })
})
