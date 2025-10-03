import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import DashboardPage from '../page'

jest.mock('@/components/ModelViewer', () => () => <div data-testid="model-viewer" />)
jest.mock('@/components/Navigation', () => () => <nav data-testid="navigation" />)
 
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))
 
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

global.fetch = jest.fn()

const mockPush = jest.fn()
const mockRouter = { push: mockPush }

const isoMinutesAgo = (mins: number) => new Date(Date.now() - mins * 60000).toISOString()

describe('DashboardPage', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    mockLocalStorage.getItem.mockReturnValue('token')
    ;(fetch as jest.Mock).mockReset()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy?.mockRestore()
  })

  test('認証トークンがない場合はログインにリダイレクト', async () => {
    mockLocalStorage.getItem.mockReturnValue(null)
    render(<DashboardPage />)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })

  test('初期ロードでモデル一覧をそのまま表示', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'u1', role: 'USER' }) })
    const models = {
      models: [
        { id: 'm1', title: 'A', description: 'desc', inputType: 'TEXT', inputData: 'prompt', status: 'PENDING', createdAt: isoMinutesAgo(1) },
        { id: 'm2', title: 'B', description: null, inputType: 'IMAGE', inputData: 'https://example.com/i.jpg', status: 'COMPLETED', modelUrl: 'gs://bucket/models/m2/model.glb', createdAt: isoMinutesAgo(3) },
        { id: 'm3', title: 'C', description: 'old', inputType: 'TEXT', inputData: 'prompt', status: 'COMPLETED', modelUrl: 'gs://bucket/models/m3/model.glb', createdAt: isoMinutesAgo(6) },
      ],
    }
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => models })

    render(<DashboardPage />)

    expect(screen.getByText('読み込み中...')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('マイモデル')).toBeInTheDocument()
      expect(screen.getByText('A')).toBeInTheDocument()
      expect(screen.getByText('B')).toBeInTheDocument()
      expect(screen.getByText('C')).toBeInTheDocument()
    })

    expect(screen.getByText('待機中')).toBeInTheDocument()
    expect(screen.getAllByText('3Dモデルをダウンロード').length).toBe(2)
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
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ models: [{ id: 'd1', title: 'toDel', description: '', inputType: 'TEXT', inputData: 'x', status: 'COMPLETED', createdAt: isoMinutesAgo(1) }] }) })

    render(<DashboardPage />)
    await waitFor(() => screen.getByText('マイモデル'))

    await user.click(screen.getByRole('button', { name: '新しいモデルを作成' }))
    await user.selectOptions(screen.getByLabelText('入力タイプ'), 'IMAGE')
    expect(screen.getByLabelText('画像ファイル')).toBeInTheDocument()

    // URL 入力に切り替えてエラーパスを確認
    await user.click(screen.getByRole('button', { name: 'URL を入力' }))
    expect(screen.getByPlaceholderText('https://example.com/image.jpg')).toBeInTheDocument()

    await user.type(screen.getByLabelText('タイトル'), 'err')
    await user.type(screen.getByPlaceholderText('https://example.com/image.jpg'), 'https://img')
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({ error: '3Dモデル生成の開始に失敗しました' }) })
    await user.click(screen.getByRole('button', { name: '生成開始' }))
    await waitFor(() => expect(screen.getByText('3Dモデル生成の開始に失敗しました')).toBeInTheDocument())

    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    await user.click(screen.getByRole('button', { name: '削除' }))
    await waitFor(() => expect(screen.getByText('モデルの削除に失敗しました')).toBeInTheDocument())
    confirmSpy.mockRestore()
  })

  test('新規作成フォームの表示・送信（送信中はボタン無効）', async () => {
    const user = userEvent.setup()
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'u1', role: 'USER' }) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) })

    render(<DashboardPage />)
    await waitFor(() => screen.getByText('マイモデル'))

    await user.click(screen.getByRole('button', { name: '新しいモデルを作成' }))
    expect(screen.getByText('新しい3Dモデルを作成')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('例: かっこいい車'), 'sample')
    await user.type(screen.getByPlaceholderText('例: 青いスポーツカー、光沢のある表面、リアルなディテール'), 'prompt here')

    let resolvePost: (v: any) => void
    const postPromise = new Promise((resolve) => (resolvePost = resolve))
    ;(fetch as jest.Mock).mockReturnValueOnce(postPromise)
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) })

    const submitBtn = screen.getByRole('button', { name: '生成開始' })
    await user.click(submitBtn)

    expect(screen.getByText('開始中...')).toBeInTheDocument()
    expect(submitBtn).toBeDisabled()

    resolvePost!({ ok: true, json: async () => ({ message: 'ok', model: { id: 'x' } }) })

    await waitFor(() => {
      expect(screen.queryByText('新しい3Dモデルを作成')).not.toBeInTheDocument()
    })
  })

  test('モデルの削除でAPI呼び出しと一覧更新', async () => {
    const user = userEvent.setup()
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'u1', role: 'USER' }) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [{ id: 'mid', title: 'deleteme', description: '', inputType: 'TEXT', inputData: 'x', status: 'COMPLETED', createdAt: isoMinutesAgo(1) }] }),
    })

    render(<DashboardPage />)
    await waitFor(() => screen.getByText('deleteme'))

    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) })

    await user.click(screen.getByRole('button', { name: '削除' }))

    await waitFor(() => {
      expect((fetch as jest.Mock).mock.calls.some(([url, opts]) => String(url).startsWith('/api/models/') && (opts as any)?.method === 'DELETE')).toBe(true)
    })

    confirmSpy.mockRestore()
  })

  test('処理中モデルの削除ボタンは無効', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'u1', role: 'USER' }) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [{ id: 'locked', title: 'processing', description: '', inputType: 'TEXT', inputData: 'x', status: 'PROCESSING', createdAt: isoMinutesAgo(1) }] }),
    })

    render(<DashboardPage />)

    const deleteButton = await screen.findByRole('button', { name: '削除' })
    expect(deleteButton).toBeDisabled()
    expect(deleteButton).toHaveAttribute('title', '生成中のモデルは削除できません')
  })

  test('入力項目に上限文字数を設ける', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'u1', role: 'USER' }) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) })

    render(<DashboardPage />)
    await waitFor(() => screen.getByText('マイモデル'))

    fireEvent.click(screen.getByRole('button', { name: '新しいモデルを作成' }))

    const titleInput = screen.getByLabelText('タイトル') as HTMLInputElement
    fireEvent.change(titleInput, { target: { value: 'a'.repeat(130) } })
    await waitFor(() => {
      expect(titleInput.value.length).toBe(100)
    })

    const promptInput = screen.getByLabelText('テキストプロンプト') as HTMLTextAreaElement
    fireEvent.change(promptInput, { target: { value: 'b'.repeat(2100) } })
    await waitFor(() => {
      expect(promptInput.value.length).toBe(2000)
    })

    const descriptionInput = screen.getByLabelText('説明（任意）') as HTMLTextAreaElement
    fireEvent.change(descriptionInput, { target: { value: 'c'.repeat(1200) } })
    await waitFor(() => {
      expect(descriptionInput.value.length).toBe(1000)
    })

    const materialInput = screen.getByLabelText('材質') as HTMLInputElement
    fireEvent.change(materialInput, { target: { value: 'm'.repeat(200) } })
    await waitFor(() => {
      expect(materialInput.value.length).toBe(120)
    })
  })

  test('寸法の上限を超えるとエラー', async () => {
    const user = userEvent.setup()
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'u1', role: 'USER' }) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) })

    render(<DashboardPage />)
    await waitFor(() => screen.getByText('マイモデル'))

    await user.click(screen.getByRole('button', { name: '新しいモデルを作成' }))

    fireEvent.change(screen.getByLabelText('タイトル'), { target: { value: 'valid title' } })
    fireEvent.change(screen.getByLabelText('テキストプロンプト'), { target: { value: 'prompt' } })
    fireEvent.change(screen.getByLabelText('幅（cm）'), { target: { value: '1500' } })

    await user.click(screen.getByRole('button', { name: '生成開始' }))

    await screen.findByText('幅は1000cm以下で入力してください')

    const hasPost = (fetch as jest.Mock).mock.calls.some(
      ([url, options]) =>
        String(url).startsWith('/api/models') && (options as RequestInit | undefined)?.method === 'POST',
    )

    expect(hasPost).toBe(false)
  })

  test('大きすぎる画像ファイルは拒否される', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'u1', role: 'USER' }) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) })

    render(<DashboardPage />)
    await waitFor(() => screen.getByText('マイモデル'))

    fireEvent.click(screen.getByRole('button', { name: '新しいモデルを作成' }))
    fireEvent.change(screen.getByLabelText('タイトル'), { target: { value: 'image test' } })
    fireEvent.change(screen.getByLabelText('テキストプロンプト'), { target: { value: 'placeholder' } })

    fireEvent.change(screen.getByLabelText('入力タイプ'), { target: { value: 'IMAGE' } })

    const fileInput = await screen.findByLabelText('画像ファイル') as HTMLInputElement
    const largeFile = new File(['dummy'], 'large-image.png', { type: 'image/png' })
    Object.defineProperty(largeFile, 'size', { value: 6 * 1024 * 1024 })

    fireEvent.change(fileInput, { target: { files: [largeFile] } })

    await waitFor(() => {
      expect(screen.getByText('画像ファイルは最大5MBまでです')).toBeInTheDocument()
    })
  })

  test('完了モデルのダウンロード成功と失敗', async () => {
    const user = userEvent.setup()
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

    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'u1', role: 'USER' }) })
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [{ id: 'mid', title: 'done', description: '', inputType: 'TEXT', inputData: 'x', status: 'COMPLETED', modelUrl: 'gs://bucket/models/mid/model.glb', createdAt: isoMinutesAgo(1) }] }),
    })

    render(<DashboardPage />)
    await waitFor(() => screen.getByText('3Dモデルをダウンロード'))

    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, blob: async () => new Blob(['x'], { type: 'model/gltf-binary' }) })
    await user.click(screen.getByRole('button', { name: '3Dモデルをダウンロード' }))

    await waitFor(() => {
      expect(createObjectURLMock).toHaveBeenCalled()
      expect(clickSpy).toHaveBeenCalled()
      expect(revokeObjectURLMock).toHaveBeenCalled()
      expect(appendSpy).toHaveBeenCalled()
      expect(removeSpy).toHaveBeenCalled()
    })

    const downloadCall = (fetch as jest.Mock).mock.calls.find(([url]) => String(url).includes('/api/models/mid/file'))
    expect(downloadCall).toBeDefined()

    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'err' })
    await user.click(screen.getByRole('button', { name: '3Dモデルをダウンロード' }))
    await waitFor(() => {
      expect(screen.getByText('ダウンロードに失敗しました')).toBeInTheDocument()
    })

    clickSpy.mockRestore()
    createElSpy.mockRestore()
    appendSpy.mockRestore()
    removeSpy.mockRestore()
    Object.defineProperty(window.URL, 'createObjectURL', { value: originalCreate, configurable: true })
    Object.defineProperty(window.URL, 'revokeObjectURL', { value: originalRevoke, configurable: true })
  })

  test('モデル取得エラー時のエラーメッセージ', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'u1', role: 'USER' }) })
    ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('network'))

    render(<DashboardPage />)
    await waitFor(() => {
      expect(screen.getByText('モデル一覧の取得に失敗しました')).toBeInTheDocument()
    })
  })
})
