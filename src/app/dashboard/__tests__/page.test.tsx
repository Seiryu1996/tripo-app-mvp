import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import DashboardPage from '../page'

// Mock heavy components
jest.mock('@/components/ModelViewer', () => () => <div data-testid="model-viewer" />)
jest.mock('@/components/Navigation', () => () => <nav data-testid="navigation" />)

// Mock router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

// Global fetch mock
global.fetch = jest.fn()

const mockPush = jest.fn()
const mockRouter = { push: mockPush }

const isoMinutesAgo = (mins: number) => new Date(Date.now() - mins * 60000).toISOString()

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    mockLocalStorage.getItem.mockReturnValue('token')
    ;(fetch as jest.Mock).mockReset()
  })

  test('認証トークンがない場合はログインにリダイレクト', async () => {
    mockLocalStorage.getItem.mockReturnValue(null)
    render(<DashboardPage />)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })

  test('初期ロードとモデル一覧表示（フィルタ含む）', async () => {
    // /api/auth/me
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'u1', role: 'USER' }) })
    // /api/models
    const models = {
      models: [
        { id: 'm1', title: 'A', description: 'desc', inputType: 'TEXT', inputData: 'prompt', status: 'PENDING', createdAt: isoMinutesAgo(1) },
        { id: 'm2', title: 'B', description: null, inputType: 'IMAGE', inputData: 'https://example.com/i.jpg', status: 'COMPLETED', modelUrl: 'https://x/tripo-data/model.glb', createdAt: isoMinutesAgo(3) },
        { id: 'm3', title: 'C', description: 'old', inputType: 'TEXT', inputData: 'prompt', status: 'COMPLETED', modelUrl: 'https://x/tripo-data/model.glb', createdAt: isoMinutesAgo(6) }, // expired -> hidden
      ],
    }
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => models })

    render(<DashboardPage />)

    // shows loading first
    expect(screen.getByText('読み込み中...')).toBeInTheDocument()

    // after load, shows list and filters out expired completed
    await waitFor(() => {
      expect(screen.getByText('マイモデル')).toBeInTheDocument()
      expect(screen.getByText('A')).toBeInTheDocument()
      expect(screen.getByText('B')).toBeInTheDocument()
      expect(screen.queryByText('C')).not.toBeInTheDocument()
    })

    // status tags
    expect(screen.getByText('待機中')).toBeInTheDocument()
    // completed section shows download button
    expect(screen.getByText('3Dモデルをダウンロード')).toBeInTheDocument()
  })

  test('各ステータスの表示（PROCESSING/FAILED/BANNED）', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'u1', role: 'USER' }) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [
          { id: 'p1', title: 'proc', description: '', inputType: 'TEXT', inputData: 'x', status: 'PROCESSING', createdAt: isoMinutesAgo(1) },
          { id: 'f1', title: 'fail', description: '', inputType: 'TEXT', inputData: 'x', status: 'FAILED', createdAt: isoMinutesAgo(1) },
          { id: 'b1', title: 'ban', description: '', inputType: 'TEXT', inputData: 'x', status: 'BANNED', createdAt: isoMinutesAgo(1) },
        ],
      }),
    })
    render(<DashboardPage />)
    await waitFor(() => {
      expect(screen.getByText('生成中...')).toBeInTheDocument()
      expect(screen.getByText('生成に失敗しました')).toBeInTheDocument()
      expect(screen.getByText('禁止コンテンツが検出されました')).toBeInTheDocument()
    })
  })

  test('入力タイプ切り替え（TEXT→IMAGE）とエラー表示（作成/削除失敗）', async () => {
    const user = userEvent.setup()
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'u1', role: 'USER' }) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ models: [{ id: 'd1', title: 'toDel', description: '', inputType: 'TEXT', inputData: 'x', status: 'PENDING', createdAt: isoMinutesAgo(1) }] }) })

    render(<DashboardPage />)
    await waitFor(() => screen.getByText('マイモデル'))

    // open form and switch
    await user.click(screen.getByRole('button', { name: '新しいモデルを作成' }))
    await user.selectOptions(screen.getByLabelText('入力タイプ'), 'IMAGE')
    expect(screen.getByPlaceholderText('https://example.com/image.jpg')).toBeInTheDocument()

    // create fail
    await user.type(screen.getByLabelText('タイトル'), 'err')
    await user.type(screen.getByPlaceholderText('https://example.com/image.jpg'), 'https://img')
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({ error: '3Dモデル生成の開始に失敗しました' }) })
    await user.click(screen.getByRole('button', { name: '生成開始' }))
    await waitFor(() => expect(screen.getByText('3Dモデル生成の開始に失敗しました')).toBeInTheDocument())

    // delete fail
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    await user.click(screen.getByRole('button', { name: '削除' }))
    await waitFor(() => expect(screen.getByText('モデルの削除に失敗しました')).toBeInTheDocument())
    confirmSpy.mockRestore()
  })

  test('新規作成フォームの表示・送信（送信中はボタン無効）', async () => {
    const user = userEvent.setup()
    // /api/auth/me
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'u1', role: 'USER' }) })
    // 初回 /api/models（空）
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) })

    render(<DashboardPage />)
    await waitFor(() => screen.getByText('マイモデル'))

    // Open form
    await user.click(screen.getByRole('button', { name: '新しいモデルを作成' }))
    expect(screen.getByText('新しい3Dモデルを作成')).toBeInTheDocument()

    // Fill fields (TEXT default)
    await user.type(screen.getByPlaceholderText('例: かっこいい車'), 'sample')
    await user.type(screen.getByPlaceholderText('例: 青いスポーツカー、光沢のある表面、リアルなディテール'), 'prompt here')

    // Mock POST /api/models with delayed promise and then success
    let resolvePost: (v: any) => void
    const postPromise = new Promise((resolve) => (resolvePost = resolve))
    ;(fetch as jest.Mock).mockReturnValueOnce(postPromise) // POST
    // subsequent refresh GET
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) })

    const submitBtn = screen.getByRole('button', { name: '生成開始' })
    await user.click(submitBtn)

    // While pending
    expect(screen.getByText('開始中...')).toBeInTheDocument()
    expect(submitBtn).toBeDisabled()

    // Resolve POST
    resolvePost!({ ok: true, json: async () => ({ message: 'ok', model: { id: 'x' } }) })

    await waitFor(() => {
      expect(screen.queryByText('新しい3Dモデルを作成')).not.toBeInTheDocument()
    })
  })

  test('モデルの削除でAPI呼び出しと一覧更新', async () => {
    const user = userEvent.setup()
    // Confirm dialog
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    // /api/auth/me
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'u1', role: 'USER' }) })
    // 初回 /api/models
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [{ id: 'mid', title: 'deleteme', description: '', inputType: 'TEXT', inputData: 'x', status: 'PENDING', createdAt: isoMinutesAgo(1) }] }),
    })

    render(<DashboardPage />)
    await waitFor(() => screen.getByText('deleteme'))

    // DELETE response
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    // refresh GET
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) })

    await user.click(screen.getByRole('button', { name: '削除' }))

    await waitFor(() => {
      // DELETE called
      expect((fetch as jest.Mock).mock.calls.some(([url, opts]) => String(url).startsWith('/api/models/') && (opts as any)?.method === 'DELETE')).toBe(true)
    })

    confirmSpy.mockRestore()
  })

  test('完了モデルのダウンロード成功と失敗', async () => {
    const user = userEvent.setup()
    // Mock URL methods and anchor
    const createObjectURLMock = jest.fn().mockReturnValue('blob:mock')
    const revokeObjectURLMock = jest.fn()
    const originalCreate = window.URL.createObjectURL as any
    const originalRevoke = window.URL.revokeObjectURL as any
    Object.defineProperty(window.URL, 'createObjectURL', { value: createObjectURLMock, configurable: true })
    Object.defineProperty(window.URL, 'revokeObjectURL', { value: revokeObjectURLMock, configurable: true })
    const appendSpy = jest.spyOn(document.body, 'appendChild')
    const removeSpy = jest.spyOn(document.body, 'removeChild')
    const a = document.createElement('a')
    const clickSpy = jest.spyOn(a, 'click').mockImplementation(() => {})
    const originalCreateElement = document.createElement.bind(document)
    const createElSpy = jest
      .spyOn(document, 'createElement')
      .mockImplementation(((tagName: string, options?: any) => {
        if (String(tagName).toLowerCase() === 'a') return a as any
        return originalCreateElement(tagName as any, options)
      }) as any)

    // /api/auth/me
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'u1', role: 'USER' }) })
    // 初回 /api/models -> one completed
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [{ id: 'mid', title: 'done', description: '', inputType: 'TEXT', inputData: 'x', status: 'COMPLETED', modelUrl: 'https://x/tripo-data/model.glb', createdAt: isoMinutesAgo(1) }] }),
    })

    render(<DashboardPage />)
    await waitFor(() => screen.getByText('3Dモデルをダウンロード'))

    // First click success
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['x'], { type: 'model/gltf-binary' }) })
    await user.click(screen.getByRole('button', { name: '3Dモデルをダウンロード' }))

    await waitFor(() => {
      expect(createObjectURLMock).toHaveBeenCalled()
      expect(clickSpy).toHaveBeenCalled()
      expect(revokeObjectURLMock).toHaveBeenCalled()
      expect(appendSpy).toHaveBeenCalled()
      expect(removeSpy).toHaveBeenCalled()
    })

    // Second click failure
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, text: async () => 'err' })
    await user.click(screen.getByRole('button', { name: '3Dモデルをダウンロード' }))
    await waitFor(() => {
      expect(screen.getByText('ダウンロードに失敗しました')).toBeInTheDocument()
    })

    // restore spies/mocks to avoid leakage
    clickSpy.mockRestore()
    createElSpy.mockRestore()
    appendSpy.mockRestore()
    removeSpy.mockRestore()
    Object.defineProperty(window.URL, 'createObjectURL', { value: originalCreate, configurable: true })
    Object.defineProperty(window.URL, 'revokeObjectURL', { value: originalRevoke, configurable: true })
  })

  test('モデル取得エラー時のエラーメッセージ', async () => {
    // /api/auth/me ok
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'u1', role: 'USER' }) })
    // /api/models fails
    ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('network'))

    render(<DashboardPage />)
    await waitFor(() => {
      expect(screen.getByText('モデル一覧の取得に失敗しました')).toBeInTheDocument()
    })
  })
})
