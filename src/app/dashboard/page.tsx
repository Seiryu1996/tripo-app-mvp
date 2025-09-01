'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ModelViewer from '@/components/ModelViewer'

interface Model {
  id: string
  title: string
  description: string
  inputType: 'TEXT' | 'IMAGE'
  inputData: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  modelUrl?: string
  previewUrl?: string
  createdAt: string
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
    inputData: ''
  })

  useEffect(() => {
    checkAuth()
    fetchModels()
  }, [])

  // 生成中のモデルがある場合のみポーリング
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
        setModels(data.models || [])
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
        setFormData({ title: '', description: '', inputType: 'TEXT', inputData: '' })
      } else {
        const data = await response.json()
        setError(data.error || '3Dモデル生成の開始に失敗しました')
      }
    } catch {
      setError('3Dモデル生成の開始に失敗しました')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/')
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
      default: return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      case 'PROCESSING': return 'bg-blue-100 text-blue-800'
      case 'COMPLETED': return 'bg-green-100 text-green-800'
      case 'FAILED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
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
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">3Dモデル生成</h1>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md"
            >
              ログアウト
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
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
                      setFormData({ title: '', description: '', inputType: 'TEXT', inputData: '' })
                    }}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md"
                  >
                    キャンセル
                  </button>
                </div>
              </form>
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
                        onClick={async () => {
                          const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
                          const filename = `${model.title}_${timestamp}.glb`
                          const downloadUrl = `/api/download/model?url=${encodeURIComponent(model.modelUrl)}&filename=${encodeURIComponent(filename)}`
                          
                          try {
                            // 認証付きでfetch
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
                            
                            // blobを作成してダウンロード
                            const blob = await response.blob()
                            const url = window.URL.createObjectURL(blob)
                            
                            const link = document.createElement('a')
                            link.href = url
                            link.download = filename
                            document.body.appendChild(link)
                            link.click()
                            document.body.removeChild(link)
                            
                            // URLを解放
                            window.URL.revokeObjectURL(url)
                          } catch (error) {
                            console.error('Download error:', error)
                            alert('ダウンロードに失敗しました')
                          }
                        }}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
                      >
                        3Dモデルをダウンロード
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