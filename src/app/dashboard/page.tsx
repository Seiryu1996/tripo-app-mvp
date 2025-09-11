'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ModelViewer from '@/components/ModelViewer'
import Navigation from '@/components/Navigation'

interface Model {
  id: string
  title: string
  description: string
  inputType: 'TEXT' | 'IMAGE'
  inputData: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'BANNED'
  modelUrl?: string
  previewUrl?: string
  createdAt: string
}

// モデルの有効期限をチェックする関数（5分）
const isModelExpired = (createdAt: string): boolean => {
  const created = new Date(createdAt)
  const now = new Date()
  const minutesDiff = (now.getTime() - created.getTime()) / (1000 * 60)
  return minutesDiff > 5
}

// 有効なモデルのみをフィルタする関数
const filterValidModels = (models: Model[]): Model[] => {
  return models.filter(model => {
    // 未完了のモデル（PENDING、PROCESSING、FAILED、BANNED）は表示
    if (model.status !== 'COMPLETED') return true
    // 完了済みモデルは有効期限をチェック
    return !isModelExpired(model.createdAt)
  })
}

export default function DashboardPage() {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    inputType: 'TEXT' as 'TEXT' | 'IMAGE',
    inputData: '',
    // 詳細設定
    width: '',
    height: '',
    depth: '',
    material: '',
    color: '',
    style: '',
    quality: 'medium' as 'low' | 'medium' | 'high',
    texture: false
  })
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
    fetchModels()
  }, [])

  // 生成中のモデルがある場合のみポーリング（BANNED、COMPLETED、FAILEDは除外）
  useEffect(() => {
    const hasProcessingModels = models.some(model => 
      model.status === 'PENDING' || model.status === 'PROCESSING'
    )

    if (!hasProcessingModels) return

    const interval = setInterval(() => {
      fetchModels()
    }, 3000) // 3秒ごとに更新

    return () => clearInterval(interval)
  }, [models])

  const checkAuth = async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        router.push('/login')
      }
    } catch {
      router.push('/login')
    }
  }

  const fetchModels = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      
      const response = await fetch(`/api/models?t=${Date.now()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        cache: 'no-store'
      })
      
      if (response.ok) {
        const data = await response.json()
        // 有効なモデルのみを表示
        const validModels = filterValidModels(data.models || [])
        setModels(validModels)
        setError('')
      } else if (response.status === 401) {
        router.push('/login')
      }
    } catch (err) {
      console.error('Failed to fetch models:', err)
      setError('モデル一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.title || !formData.inputData) {
      setError('タイトルと入力データは必須です')
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        fetchModels()
        setShowCreateForm(false)
        setFormData({ 
          title: '', 
          description: '', 
          inputType: 'TEXT', 
          inputData: '',
          width: '',
          height: '',
          depth: '',
          material: '',
          color: '',
          style: '',
          quality: 'medium',
          texture: false
        })
      } else {
        const data = await response.json()
        setError(data.error || '3Dモデル生成の開始に失敗しました')
      }
    } catch {
      setError('3Dモデル生成の開始に失敗しました')
    }
  }


  const handleDelete = async (modelId: string) => {
    if (!confirm('このモデルを削除しますか？')) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/models/${modelId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        fetchModels() // 一覧を更新
      } else {
        const data = await response.json()
        setError(data.error || 'モデルの削除に失敗しました')
      }
    } catch (err) {
      setError('モデルの削除に失敗しました')
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING': return '待機中'
      case 'PROCESSING': return '処理中'
      case 'COMPLETED': return '完了'
      case 'FAILED': return '失敗'
      case 'BANNED': return '禁止コンテンツ'
      default: return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      case 'PROCESSING': return 'bg-blue-100 text-blue-800'
      case 'COMPLETED': return 'bg-green-100 text-green-800'
      case 'FAILED': return 'bg-red-100 text-red-800'
      case 'BANNED': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleDownload = async (model: Model) => {
    if (!model.modelUrl) return
    
    setDownloading(model.id)
    setError('')

    try {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      const filename = `${model.title}_${timestamp}.glb`
      const downloadUrl = `/api/download/model?url=${encodeURIComponent(model.modelUrl)}&filename=${encodeURIComponent(filename)}`
      
      const token = localStorage.getItem('token')
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Download API error:', response.status, errorText)
        throw new Error(`ダウンロードに失敗しました: ${response.status}`)
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Download error:', error)
      setError('ダウンロードに失敗しました')
    } finally {
      setDownloading(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation currentPath="/dashboard" />

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">マイモデル</h2>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              {showCreateForm ? 'キャンセル' : '新しいモデルを作成'}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          {showCreateForm && (
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h3 className="text-lg font-medium mb-4">新しい3Dモデルを作成</h3>
              
              {/* 有効期限の注意書き */}
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-yellow-800 font-medium">重要なお知らせ</span>
                </div>
                <p className="text-sm text-yellow-700 mt-1">
                  生成された3Dモデルは<strong>5分後</strong>に自動的に期限切れとなり、プレビュー・ダウンロードができなくなります。必要なモデルは早めにダウンロードしてください。
                </p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">タイトル</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="例: かっこいい車"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">説明（任意）</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={3}
                    placeholder="モデルの詳細な説明..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">入力タイプ</label>
                  <select
                    value={formData.inputType}
                    onChange={(e) => setFormData({ ...formData, inputType: e.target.value as 'TEXT' | 'IMAGE' })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="TEXT">テキスト</option>
                    <option value="IMAGE">画像</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {formData.inputType === 'TEXT' ? 'テキストプロンプト' : '画像URL'}
                  </label>
                  {formData.inputType === 'TEXT' ? (
                    <textarea
                      value={formData.inputData}
                      onChange={(e) => setFormData({ ...formData, inputData: e.target.value })}
                      required
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      rows={4}
                      placeholder="例: 青いスポーツカー、光沢のある表面、リアルなディテール"
                    />
                  ) : (
                    <input
                      type="url"
                      value={formData.inputData}
                      onChange={(e) => setFormData({ ...formData, inputData: e.target.value })}
                      required
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="https://example.com/image.jpg"
                    />
                  )}
                </div>

                {/* 詳細設定セクション */}
                <div className="border-t pt-4">
                  <h4 className="text-md font-medium text-gray-800 mb-3">詳細設定（任意）</h4>
                  
                  {/* サイズ設定 */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">幅（cm）</label>
                      <input
                        type="number"
                        value={formData.width}
                        onChange={(e) => setFormData({ ...formData, width: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="10"
                        min="0.1"
                        step="0.1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">高さ（cm）</label>
                      <input
                        type="number"
                        value={formData.height}
                        onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="10"
                        min="0.1"
                        step="0.1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">奥行き（cm）</label>
                      <input
                        type="number"
                        value={formData.depth}
                        onChange={(e) => setFormData({ ...formData, depth: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="10"
                        min="0.1"
                        step="0.1"
                      />
                    </div>
                  </div>

                  {/* 材質と色 */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">材質</label>
                      <input
                        type="text"
                        value={formData.material}
                        onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="例: プラスチック、金属、木材"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">色</label>
                      <input
                        type="text"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="例: 青、赤、シルバー"
                      />
                    </div>
                  </div>

                  {/* スタイルと品質 */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">スタイル</label>
                      <input
                        type="text"
                        value={formData.style}
                        onChange={(e) => setFormData({ ...formData, style: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="例: モダン、クラシック、未来的"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">品質</label>
                      <select
                        value={formData.quality}
                        onChange={(e) => setFormData({ ...formData, quality: e.target.value as 'low' | 'medium' | 'high' })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="low">低品質（高速）</option>
                        <option value="medium">中品質（標準）</option>
                        <option value="high">高品質（詳細）</option>
                      </select>
                    </div>
                  </div>

                  {/* テクスチャ設定 */}
                  <div className="flex items-center">
                    <input
                      id="texture"
                      type="checkbox"
                      checked={formData.texture}
                      onChange={(e) => setFormData({ ...formData, texture: e.target.checked })}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                    <label htmlFor="texture" className="ml-2 block text-sm text-gray-700">
                      テクスチャを含める（処理時間が長くなります）
                    </label>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                  >
                    生成開始
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false)
                      setFormData({ 
                        title: '', 
                        description: '', 
                        inputType: 'TEXT', 
                        inputData: '',
                        width: '',
                        height: '',
                        depth: '',
                        material: '',
                        color: '',
                        style: '',
                        quality: 'medium',
                        texture: false
                      })
                    }}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md"
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 有効期限の注意書き（一覧画面用） */}
          {models.length > 0 && (
            <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-blue-800 font-medium">モデル有効期限について</span>
              </div>
              <p className="text-sm text-blue-700 mt-1">
                生成された3Dモデルは5分後に自動的に期限切れとなります。期限切れになったモデルは一覧から削除され、プレビュー・ダウンロードができなくなります。
              </p>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {models.length === 0 ? (
              <div className="col-span-full text-center py-8 text-gray-500">
                まだ3Dモデルがありません。新しいモデルを作成してみましょう。
              </div>
            ) : (
              models.map((model) => (
                <div key={model.id} className="bg-white shadow rounded-lg p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900 truncate">{model.title}</h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(model.status)}`}>
                        {getStatusText(model.status)}
                      </span>
                      <button
                        onClick={() => handleDelete(model.id)}
                        className="text-red-600 hover:text-red-800 text-sm px-2 py-1 rounded border border-red-600 hover:bg-red-50"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                  
                  {model.description && (
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">{model.description}</p>
                  )}
                  
                  <div className="mb-3">
                    <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                      {model.inputType === 'TEXT' ? 'テキスト' : '画像'}
                    </span>
                  </div>
                  
                  {model.inputType === 'TEXT' ? (
                    <p className="text-sm text-gray-500 mb-4 line-clamp-3">{model.inputData}</p>
                  ) : (
                    <img 
                      src={model.inputData} 
                      alt="Input" 
                      className="w-full h-32 object-cover rounded mb-4"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                  
                  {/* 3Dモデルプレビュー */}
                  {model.status === 'COMPLETED' && model.modelUrl && (
                    <div className="mt-4">
                      <ModelViewer modelUrl={model.modelUrl} className="mb-3" />
                      <button
                        onClick={() => handleDownload(model)}
                        disabled={downloading === model.id}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {downloading === model.id ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700 mr-2"></div>
                            ダウンロード中...
                          </>
                        ) : (
                          '3Dモデルをダウンロード'
                        )}
                      </button>
                    </div>
                  )}
                  
                  {/* 処理中の場合の表示 */}
                  {model.status === 'PROCESSING' && (
                    <div className="mt-4">
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                        <span className="text-sm text-blue-600">生成中...</span>
                      </div>
                    </div>
                  )}
                  
                  {/* 待機中の場合の表示 */}
                  {model.status === 'PENDING' && (
                    <div className="mt-4">
                      <div className="flex items-center">
                        <div className="h-4 w-4 bg-yellow-400 rounded-full mr-2"></div>
                        <span className="text-sm text-yellow-600">待機中...</span>
                      </div>
                    </div>
                  )}
                  
                  {/* 失敗の場合の表示 */}
                  {model.status === 'FAILED' && (
                    <div className="mt-4">
                      <div className="flex items-center">
                        <div className="h-4 w-4 bg-red-400 rounded-full mr-2"></div>
                        <span className="text-sm text-red-600">生成に失敗しました</span>
                      </div>
                    </div>
                  )}
                  
                  {/* 禁止コンテンツの場合の表示 */}
                  {model.status === 'BANNED' && (
                    <div className="mt-4">
                      <div className="flex items-center mb-2">
                        <div className="h-4 w-4 bg-orange-400 rounded-full mr-2"></div>
                        <span className="text-sm text-orange-600 font-medium">禁止コンテンツが検出されました</span>
                      </div>
                      <p className="text-xs text-orange-600">
                        入力内容がコンテンツポリシーに違反している可能性があります。他の内容でお試しください。
                      </p>
                    </div>
                  )}
                  
                  <div className="mt-4 text-xs text-gray-400">
                    作成日: {new Date(model.createdAt).toLocaleDateString('ja-JP')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}