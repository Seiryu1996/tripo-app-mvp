'use client'

import ModelViewer from '@/components/ModelViewer'
import { Model } from '../types'
import { getStatusColor, getStatusText, isModelLocked } from '../hooks/useDashboardController'

interface ModelGridProps {
  models: Model[]
  onDelete: (model: Model) => void
  onDownload: (model: Model) => void
  downloadingId: string | null
}

const renderImageInputPreview = (model: Model) => {
  const value = model.inputData || ''

  if (value.startsWith('http://') || value.startsWith('https://')) {
    if (model.previewUrl || model.modelUrl) {
      return <p className="text-sm text-gray-500 mb-4 break-all">画像ソース: {value}</p>
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
    return <p className="text-sm text-gray-500 mb-4">アップロード画像（非公開）</p>
  }

  if (value.startsWith('upload:')) {
    const name = value.slice('upload:'.length) || 'image'
    return <p className="text-sm text-gray-500 mb-4">アップロード画像: {name}</p>
  }

  return <p className="text-sm text-gray-500 mb-4 break-all">画像ソース: {value}</p>
}

export default function ModelGrid({ models, onDelete, onDownload, downloadingId }: ModelGridProps) {
  if (models.length === 0) {
    return (
      <div className="col-span-full text-center py-8 text-gray-500">
        まだ3Dモデルがありません。新しいモデルを作成してみましょう。
      </div>
    )
  }

  return (
    <>
      {models.map((model) => (
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
                onClick={() => onDelete(model)}
                disabled={isModelLocked(model.status)}
                title={isModelLocked(model.status) ? '生成中のモデルは削除できません' : ''}
                className="text-red-600 hover:text-red-800 text-sm px-2 py-1 rounded border border-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-red-600 disabled:hover:bg-transparent"
              >
                削除
              </button>
            </div>
          </div>

          {model.description && <p className="text-gray-600 text-sm mb-3 line-clamp-2">{model.description}</p>}

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
                onClick={() => onDownload(model)}
                disabled={downloadingId === model.id}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloadingId === model.id ? (
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
      ))}
    </>
  )
}
