'use client'

import { ChangeEvent, useEffect, useState } from 'react'
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

type ImageInputMode = 'URL' | 'UPLOAD'

interface FormDataState {
  title: string
  description: string
  inputType: 'TEXT' | 'IMAGE'
  inputData: string
  width: string
  height: string
  depth: string
  material: string
  color: string
  style: string
  quality: 'low' | 'medium' | 'high'
  texture: boolean
  imageMode: ImageInputMode
  imageFilename: string
}

const createInitialFormData = (): FormDataState => ({
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
  texture: false,
  imageMode: 'UPLOAD',
  imageFilename: ''
})

export default function DashboardPage() {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState<FormDataState>(createInitialFormData())
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
    fetchModels()
  }, [])

  useEffect(() => {
    const hasProcessingModels = models.some(model => 
      model.status === 'PENDING' || model.status === 'PROCESSING'
    )

    if (!hasProcessingModels) return

    const interval = setInterval(() => {
      fetchModels()
    }, 3000)

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
    if (submitting) return

    if (!formData.title.trim()) {
      setError('タイトルは必須です')
      return
    }

    if (formData.inputType === 'TEXT') {
      if (!formData.inputData.trim()) {
        setError('テキストプロンプトを入力してください')
        return
      }
    } else if (formData.imageMode === 'URL') {
      if (!formData.inputData.trim()) {
        setError('画像URLを入力してください')
        return
      }
    } else if (!formData.imageFilename || !formData.inputData) {
      setError('画像ファイルを選択してください')
      return
    }

    if (formData.inputType === 'IMAGE' && formData.imageMode === 'URL') {
      try {
        const url = new URL(formData.inputData)
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('Invalid protocol')
        }
      } catch (err) {
        setError('有効な画像URLを入力してください')
        return
      }
    }

    try {
      setSubmitting(true)
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
        setFormData(createInitialFormData())
      } else {
        const data = await response.json()
        setError(data.error || '3Dモデル生成の開始に失敗しました')
      }
    } catch {
      setError('3Dモデル生成の開始に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const handleImageModeChange = (mode: ImageInputMode) => {
    setError('')
    setFormData(prev => ({
      ...prev,
      imageMode: mode,
      inputData: '',
      imageFilename: ''
    }))
  }

  const handleImageFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      setError('')
      setFormData(prev => ({
        ...prev,
        inputData: '',
        imageFilename: ''
      }))
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      setError('')
      setFormData(prev => ({
        ...prev,
        inputData: result,
        imageFilename: file.name
      }))
    }
    reader.readAsDataURL(file)
  }

  const renderImageInputPreview = (model: Model) => {
    const value = model.inputData || ''

    if (value.startsWith('http://') || value.startsWith('https://')) {
      if (model.previewUrl || model.modelUrl) {
        return (
          <p className="text-sm text-gray-500 mb-4 break-all">画像ソース: {value}</p>
        )
      }

      return (
        <img
          src={value}
          alt="Input"
          className="w-full h-32 object-cover rounded mb-4"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )
    }

    if (value.startsWith('data:')) {
      return (
        <p className="text-sm text-gray-500 mb-4">アップロード画像（非公開）</p>
      )
    }

    if (value.startsWith('upload:')) {
      const name = value.slice('upload:'.length) || 'image'
      return (
        <p className="text-sm text-gray-500 mb-4">アップロード画像: {name}</p>
      )
    }

    return (
      <p className="text-sm text-gray-500 mb-4 break-all">画像ソース: {value}</p>
    )
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
        fetchModels()
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
      const downloadUrl = `/api/models/${model.id}/file?type=model&download=1&filename=${encodeURIComponent(filename)}`
      
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
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
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
              
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-yellow-800 font-medium">保存について</span>
                </div>
                <p className="text-sm text-yellow-700 mt-1">
                  生成された3Dモデルはクラウドストレージに自動保存され、いつでもプレビュー・ダウンロードできます。必要に応じてプロジェクト単位で整理されます。
                </p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="dash-title" className="block text-sm font-medium text-gray-700">タイトル</label>
                  <input
                    id="dash-title"
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="例: かっこいい車"
                  />
                </div>
                
                <div>
                  <label htmlFor="dash-description" className="block text-sm font-medium text-gray-700">説明（任意）</label>
                  <textarea
                    id="dash-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={3}
                    placeholder="モデルの詳細な説明..."
                  />
                </div>

                <div>
                  <label htmlFor="dash-input-type" className="block text-sm font-medium text-gray-700">入力タイプ</label>
                  <select
                    id="dash-input-type"
                    value={formData.inputType}
                    onChange={(e) => {
                      const value = e.target.value as 'TEXT' | 'IMAGE'
                      setFormData(prev => ({
                        ...prev,
                        inputType: value,
                        inputData: '',
                        imageMode: value === 'IMAGE' ? 'UPLOAD' : 'URL',
                        imageFilename: ''
                      }))
                    }}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="TEXT">テキスト</option>
                    <option value="IMAGE">画像</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor={
                      formData.inputType === 'TEXT'
                        ? 'dash-input-text'
                        : formData.imageMode === 'UPLOAD'
                          ? 'dash-input-file'
                          : 'dash-input-url'
                    }
                    className="block text-sm font-medium text-gray-700"
                  >
                    {formData.inputType === 'TEXT'
                      ? 'テキストプロンプト'
                      : formData.imageMode === 'UPLOAD'
                        ? '画像ファイル'
                        : '画像URL'}
                  </label>
                  {formData.inputType === 'TEXT' ? (
                    <textarea
                      id="dash-input-text"
                      value={formData.inputData}
                      onChange={(e) => setFormData({ ...formData, inputData: e.target.value })}
                      required
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      rows={4}
                      placeholder="例: 青いスポーツカー、光沢のある表面、リアルなディテール"
                    />
                  ) : (
                    <>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleImageModeChange('UPLOAD')}
                          className={`px-3 py-1 rounded-md border transition ${formData.imageMode === 'UPLOAD' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                        >
                          画像をアップロード
                        </button>
                        <button
                          type="button"
                          onClick={() => handleImageModeChange('URL')}
                          className={`px-3 py-1 rounded-md border transition ${formData.imageMode === 'URL' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                        >
                          URL を入力
                        </button>
                      </div>

                      {formData.imageMode === 'URL' ? (
                        <input
                          id="dash-input-url"
                          type="url"
                          value={formData.inputData}
                          onChange={(e) => setFormData({ ...formData, inputData: e.target.value })}
                          required={formData.imageMode === 'URL'}
                          className="mt-3 block w-full px-3 py-2 border border-gray-300 rounded-md"
                          placeholder="https://example.com/image.jpg"
                        />
                      ) : (
                        <div key={`upload-${formData.imageFilename || 'empty'}`} className="mt-3">
                          <input
                            id="dash-input-file"
                            type="file"
                            accept="image/*"
                            onChange={handleImageFileChange}
                            className="block w-full text-sm text-gray-700"
                          />
                          {formData.imageFilename ? (
                            <p className="mt-2 text-sm text-gray-600">選択中: {formData.imageFilename}</p>
                          ) : (
                            <p className="mt-2 text-sm text-gray-500">PNG/JPEG/WebP などの画像ファイルを選択してください</p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-md font-medium text-gray-800 mb-3">詳細設定（任意）</h4>
                  
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div>
                      <label htmlFor="dash-width" className="block text-sm font-medium text-gray-700">幅（cm）</label>
                      <input
                        id="dash-width"
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
                      <label htmlFor="dash-height" className="block text-sm font-medium text-gray-700">高さ（cm）</label>
                      <input
                        id="dash-height"
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
                      <label htmlFor="dash-depth" className="block textsm font-medium text-gray-700">奥行き（cm）</label>
                      <input
                        id="dash-depth"
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

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label htmlFor="dash-material" className="block text-sm font-medium text-gray-700">材質</label>
                      <input
                        id="dash-material"
                        type="text"
                        value={formData.material}
                        onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="例: プラスチック、金属、木材"
                      />
                    </div>
                    <div>
                      <label htmlFor="dash-color" className="block text-sm font-medium text-gray-700">色</label>
                      <input
                        id="dash-color"
                        type="text"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="例: 青、赤、シルバー"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label htmlFor="dash-style" className="block text-sm font-medium text-gray-700">スタイル</label>
                      <input
                        id="dash-style"
                        type="text"
                        value={formData.style}
                        onChange={(e) => setFormData({ ...formData, style: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="例: モダン、クラシック、未来的"
                      />
                    </div>
                    <div>
                      <label htmlFor="dash-quality" className="block text-sm font-medium text-gray-700">品質</label>
                      <select
                        id="dash-quality"
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
                    disabled={submitting}
                    className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        開始中...
                      </>
                    ) : (
                      '生成開始'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false)
                      setFormData(createInitialFormData())
                    }}
                    disabled={submitting}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            </div>
          )}

          {models.length > 0 && (
            <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-blue-800 font-medium">ストレージの状態</span>
              </div>
              <p className="text-sm text-blue-700 mt-1">
                モデルとプレビュー画像はユーザーごとのクラウドストレージに自動保存され、期限なくアクセスできます。必要になったタイミングで安心して再ダウンロードしてください。
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
                    renderImageInputPreview(model)
                  )}
                  
                  {model.status === 'COMPLETED' && model.modelUrl && (
                    <div className="mt-4">
                      <ModelViewer modelUrl={`/api/models/${model.id}/file?type=model`} className="mb-3" />
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
                  
                  {model.status === 'PROCESSING' && (
                    <div className="mt-4">
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                        <span className="text-sm text-blue-600">生成中...</span>
                      </div>
                    </div>
                  )}
                  
                  {model.status === 'PENDING' && (
                    <div className="mt-4">
                      <div className="flex items-center">
                        <div className="h-4 w-4 bg-yellow-400 rounded-full mr-2"></div>
                        <span className="text-sm text-yellow-600">待機中...</span>
                      </div>
                    </div>
                  )}
                  
                  {model.status === 'FAILED' && (
                    <div className="mt-4">
                      <div className="flex items-center">
                        <div className="h-4 w-4 bg-red-400 rounded-full mr-2"></div>
                        <span className="text-sm text-red-600">生成に失敗しました</span>
                      </div>
                    </div>
                  )}
                  
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
