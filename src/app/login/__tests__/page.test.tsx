import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import LoginPage from '../page'
import { prisma } from '@/lib/prisma'
import { 
  createTestUser, 
  createTestAdmin, 
  cleanupTestUsers, 
  TEST_USER_EMAIL, 
  TEST_ADMIN_EMAIL, 
  TEST_USER_PASSWORD 
} from '../../../test/utils/userTestUtils'

// Next.js のルーターをモック
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// localStorage をモック
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

// fetchをモック
global.fetch = jest.fn()

const mockPush = jest.fn()
const mockRouter = { push: mockPush }

describe('LoginPage', () => {
  beforeAll(async () => {
    // 事前にテスト用ユーザー/管理者を作成
    await cleanupTestUsers()
    await createTestUser()
    await createTestAdmin()
  })

  afterAll(async () => {
    // テスト完了後に後片付け
    await cleanupTestUsers()
    try {
      if (process.env.DATABASE_URL) {
        await prisma.$disconnect()
      }
    } catch {}
  })

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    mockLocalStorage.getItem.mockReturnValue(null) // デフォルトでトークンなし
    ;(fetch as jest.Mock).mockClear()
  })

  describe('レンダリングテスト', () => {
    test('ログインフォームが正しく表示される', () => {
      render(<LoginPage />)
      
      expect(screen.getByRole('heading', { name: 'ログイン' })).toBeInTheDocument()
      expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument()
      expect(screen.getByLabelText('パスワード')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument()
    })

    test('入力欄が適切な属性を持っている', () => {
      render(<LoginPage />)
      
      const emailInput = screen.getByLabelText('メールアドレス')
      const passwordInput = screen.getByLabelText('パスワード')
      
      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('required')
      expect(passwordInput).toHaveAttribute('type', 'password')
      expect(passwordInput).toHaveAttribute('required')
    })
  })

  describe('フォーム入力テスト', () => {
    test('メールアドレスとパスワードの入力が正常に動作する', async () => {
      const user = userEvent.setup()
      render(<LoginPage />)
      
      const emailInput = screen.getByLabelText('メールアドレス')
      const passwordInput = screen.getByLabelText('パスワード')
      
      await user.type(emailInput, TEST_USER_EMAIL)
      await user.type(passwordInput, TEST_USER_PASSWORD)
      
      expect(emailInput).toHaveValue(TEST_USER_EMAIL)
      expect(passwordInput).toHaveValue(TEST_USER_PASSWORD)
    })
  })

  describe('ログイン成功時のテスト', () => {
    test('一般ユーザーのログイン成功時にダッシュボードにリダイレクトされる', async () => {
      const user = userEvent.setup()
      
      // API レスポンスをモック
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'mock-token',
          user: { id: '1', role: 'USER', email: TEST_USER_EMAIL }
        }),
      })
      
      render(<LoginPage />)
      
      const emailInput = screen.getByLabelText('メールアドレス')
      const passwordInput = screen.getByLabelText('パスワード')
      const submitButton = screen.getByRole('button', { name: 'ログイン' })
      
      await user.type(emailInput, TEST_USER_EMAIL)
      await user.type(passwordInput, TEST_USER_PASSWORD)
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD })
        })
      })
      
      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('token', 'mock-token')
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })

    test('管理者ユーザーのログイン成功時に管理画面にリダイレクトされる', async () => {
      const user = userEvent.setup()
      
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'mock-admin-token',
          user: { id: '1', role: 'ADMIN', email: TEST_ADMIN_EMAIL }
        }),
      })
      
      render(<LoginPage />)
      
      const emailInput = screen.getByLabelText('メールアドレス')
      const passwordInput = screen.getByLabelText('パスワード')
      const submitButton = screen.getByRole('button', { name: 'ログイン' })
      
      await user.type(emailInput, TEST_ADMIN_EMAIL)
      await user.type(passwordInput, TEST_USER_PASSWORD)
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('token', 'mock-admin-token')
        expect(mockPush).toHaveBeenCalledWith('/admin')
      })
    })
  })

  describe('ログイン失敗時のテスト', () => {
    test('無効な認証情報でエラーメッセージが表示される', async () => {
      const user = userEvent.setup()
      
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'メールアドレスまたはパスワードが間違っています'
        }),
      })
      
      render(<LoginPage />)
      
      const emailInput = screen.getByLabelText('メールアドレス')
      const passwordInput = screen.getByLabelText('パスワード')
      const submitButton = screen.getByRole('button', { name: 'ログイン' })
      
      await user.type(emailInput, 'invalid@example.invalid')
      await user.type(passwordInput, 'wrongpassword')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('メールアドレスまたはパスワードが間違っています')).toBeInTheDocument()
      })
    })

    test('ネットワークエラー時に汎用エラーメッセージが表示される', async () => {
      const user = userEvent.setup()
      
      ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))
      
      render(<LoginPage />)
      
      const emailInput = screen.getByLabelText('メールアドレス')
      const passwordInput = screen.getByLabelText('パスワード')
      const submitButton = screen.getByRole('button', { name: 'ログイン' })
      
      await user.type(emailInput, TEST_USER_EMAIL)
      await user.type(passwordInput, TEST_USER_PASSWORD)
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('ログインに失敗しました')).toBeInTheDocument()
      })
    })
  })

  describe('ローディング状態のテスト', () => {
    test('ログイン中はボタンが無効になりローディングテキストが表示される', async () => {
      const user = userEvent.setup()
      
      // 遅延を持つレスポンスをモック
      let resolvePromise: (value: any) => void
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      
      ;(fetch as jest.Mock).mockReturnValueOnce(fetchPromise)
      
      render(<LoginPage />)
      
      const emailInput = screen.getByLabelText('メールアドレス')
      const passwordInput = screen.getByLabelText('パスワード')
      const submitButton = screen.getByRole('button')
      
      await user.type(emailInput, TEST_USER_EMAIL)
      await user.type(passwordInput, TEST_USER_PASSWORD)
      await user.click(submitButton)
      
      // ローディング状態を確認
      expect(screen.getByText('ログイン中...')).toBeInTheDocument()
      expect(submitButton).toBeDisabled()
      
      // プロミスを解決
      resolvePromise!({
        ok: true,
        json: async () => ({ token: 'token', user: { role: 'USER' } })
      })
      
      await waitFor(() => {
        expect(screen.queryByText('ログイン中...')).not.toBeInTheDocument()
      })
    })
  })

  describe('既存認証テスト', () => {
    test('チェック時にレスポンスがokでない場合はリダイレクトしない', async () => {
      mockLocalStorage.getItem.mockReturnValue('token')
      ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({}) })

      render(<LoginPage />)

      // push は呼ばれない
      await waitFor(() => {
        expect(mockPush).not.toHaveBeenCalled()
      })
    })
    test('有効なトークンがある場合、適切なページにリダイレクトされる（一般ユーザー）', async () => {
      mockLocalStorage.getItem.mockReturnValue('valid-token')
      
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: '1',
          role: 'USER',
          email: TEST_USER_EMAIL
        }),
      })
      
      render(<LoginPage />)
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/auth/me', {
          headers: { 'Authorization': 'Bearer valid-token' }
        })
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })

    test('有効なトークンがある場合、適切なページにリダイレクトされる（管理者）', async () => {
      mockLocalStorage.getItem.mockReturnValue('valid-admin-token')
      
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: '1',
          role: 'ADMIN',
          email: TEST_ADMIN_EMAIL
        }),
      })
      
      render(<LoginPage />)
      
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin')
      })
    })

    test('無効なトークンがある場合、トークンが削除される', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-token')
      
      ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('Unauthorized'))
      
      render(<LoginPage />)
      
      await waitFor(() => {
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('token')
      })
    })
  })

  describe('フォームバリデーション', () => {
    test('空のフォーム送信時にHTMLの標準バリデーションが動作する', async () => {
      const user = userEvent.setup()
      
      render(<LoginPage />)
      
      const emailInput = screen.getByLabelText('メールアドレス')
      const passwordInput = screen.getByLabelText('パスワード')
      const submitButton = screen.getByRole('button', { name: 'ログイン' })
      
      // required属性が設定されていることを確認
      expect(emailInput).toBeRequired()
      expect(passwordInput).toBeRequired()
      
      // 空の状態でsubmitしようとする
      await user.click(submitButton)
      
      // APIが呼ばれないことを確認（HTMLバリデーションで止まる）
      expect(fetch).not.toHaveBeenCalled()
    })

    test('メールアドレス形式バリデーションが動作する', () => {
      render(<LoginPage />)
      
      const emailInput = screen.getByLabelText('メールアドレス')
      expect(emailInput).toHaveAttribute('type', 'email')
    })
  })

  describe('エラー状態のクリア', () => {
    test('エラー表示後に再度フォーム送信するとエラーがクリアされる', async () => {
      const user = userEvent.setup()
      
      // 最初は失敗のレスポンス
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'ログインエラー' }),
      })
      
      render(<LoginPage />)
      
      const emailInput = screen.getByLabelText('メールアドレス')
      const passwordInput = screen.getByLabelText('パスワード')
      const submitButton = screen.getByRole('button', { name: 'ログイン' })
      
      // 最初の失敗ログイン
      await user.type(emailInput, TEST_USER_EMAIL)
      await user.type(passwordInput, 'wrong')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('ログインエラー')).toBeInTheDocument()
      })
      
      // 2回目は成功のレスポンス
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'token',
          user: { role: 'USER' }
        }),
      })
      
      // パスワードを変更して再送信
      await user.clear(passwordInput)
      await user.type(passwordInput, 'correct')
      await user.click(submitButton)
      
      // エラーメッセージが消えることを確認
      await waitFor(() => {
        expect(screen.queryByText('ログインエラー')).not.toBeInTheDocument()
      })
    })
  })
})
