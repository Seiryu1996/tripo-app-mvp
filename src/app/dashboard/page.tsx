'use client'

import Navigation from '@/components/Navigation'
import CreateModelForm from '@/features/dashboard/components/CreateModelForm'
import ModelGrid from '@/features/dashboard/components/ModelGrid'
import { useDashboardController } from '@/features/dashboard/hooks/useDashboardController'

export default function DashboardPage() {
  const {
    models,
    loading,
    showCreateForm,
    error,
    submitting,
    formData,
    downloading,
    updateFormField,
    handleImageModeChange,
    handleImageFileChange,
    handleSubmit,
    handleDelete,
    handleDownload,
    toggleCreateForm,
  } = useDashboardController()

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
              onClick={toggleCreateForm}
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
            <CreateModelForm
              formData={formData}
              submitting={submitting}
              onSubmit={handleSubmit}
              onCancel={toggleCreateForm}
              onFieldChange={updateFormField}
              onImageModeChange={handleImageModeChange}
              onImageFileChange={handleImageFileChange}
            />
          )}

          {models.length > 0 && (
            <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm text-blue-800 font-medium">ストレージの状態</span>
              </div>
              <p className="text-sm text-blue-700 mt-1">
                モデルとプレビュー画像はユーザーごとのクラウドストレージに自動保存され、期限なくアクセスできます。必要になったタイミングで安心して再ダウンロードしてください。
              </p>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <ModelGrid
              models={models}
              onDelete={handleDelete}
              onDownload={handleDownload}
              downloadingId={downloading}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
