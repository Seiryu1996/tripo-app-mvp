'use client'

import { ChangeEvent } from 'react'
import { clampText } from '@/lib/text'
import {
  MAX_MODEL_COLOR_LENGTH,
  MAX_MODEL_DESCRIPTION_LENGTH,
  MAX_MODEL_IMAGE_URL_LENGTH,
  MAX_MODEL_MATERIAL_LENGTH,
  MAX_MODEL_PROMPT_LENGTH,
  MAX_MODEL_STYLE_LENGTH,
  MAX_MODEL_TITLE_LENGTH,
  MAX_MODEL_DIMENSION,
  MIN_MODEL_DIMENSION,
} from '@/lib/inputLimits'
import { FormDataState, ImageInputMode } from '../types'

interface CreateModelFormProps {
  formData: FormDataState
  submitting: boolean
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onCancel: () => void
  onFieldChange: <K extends keyof FormDataState>(field: K, value: FormDataState[K]) => void
  onImageModeChange: (mode: ImageInputMode) => void
  onImageFileChange: (event: ChangeEvent<HTMLInputElement>) => void
}

export default function CreateModelForm({
  formData,
  submitting,
  onSubmit,
  onCancel,
  onFieldChange,
  onImageModeChange,
  onImageFileChange,
}: CreateModelFormProps) {
  return (
    <div className="bg-white shadow rounded-lg p-6 mb-6">
      <h3 className="text-lg font-medium mb-4">新しい3Dモデルを作成</h3>

      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm text-yellow-800 font-medium">保存について</span>
        </div>
        <p className="text-sm text-yellow-700 mt-1">
          生成された3Dモデルはクラウドストレージに自動保存され、いつでもプレビュー・ダウンロードできます。必要に応じてプロジェクト単位で整理されます。
        </p>
      </div>

      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="dash-title" className="block text-sm font-medium text-gray-700">
            タイトル
          </label>
          <input
            id="dash-title"
            type="text"
            value={formData.title}
            onChange={(e) => onFieldChange('title', clampText(e.target.value, MAX_MODEL_TITLE_LENGTH))}
            required
            maxLength={MAX_MODEL_TITLE_LENGTH}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="例: かっこいい車"
          />
        </div>

        <div>
          <label htmlFor="dash-description" className="block text-sm font-medium text-gray-700">
            説明（任意）
          </label>
          <textarea
            id="dash-description"
            value={formData.description}
            onChange={(e) => onFieldChange('description', clampText(e.target.value, MAX_MODEL_DESCRIPTION_LENGTH))}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            rows={3}
            placeholder="モデルの詳細な説明..."
            maxLength={MAX_MODEL_DESCRIPTION_LENGTH}
          />
        </div>

        <div>
          <label htmlFor="dash-input-type" className="block text-sm font-medium text-gray-700">
            入力タイプ
          </label>
          <select
            id="dash-input-type"
            value={formData.inputType}
            onChange={(e) => {
              const value = e.target.value as 'TEXT' | 'IMAGE'
              onFieldChange('inputType', value)
              onFieldChange('inputData', '')
              onFieldChange('imageFilename', '')
              onFieldChange('imageMode', value === 'IMAGE' ? 'UPLOAD' : 'URL')
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
              onChange={(e) => onFieldChange('inputData', clampText(e.target.value, MAX_MODEL_PROMPT_LENGTH))}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={4}
              placeholder="例: 青いスポーツカー、光沢のある表面、リアルなディテール"
              maxLength={MAX_MODEL_PROMPT_LENGTH}
            />
          ) : (
            <>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => onImageModeChange('UPLOAD')}
                  className={`px-3 py-1 rounded-md border transition ${
                    formData.imageMode === 'UPLOAD'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  画像をアップロード
                </button>
                <button
                  type="button"
                  onClick={() => onImageModeChange('URL')}
                  className={`px-3 py-1 rounded-md border transition ${
                    formData.imageMode === 'URL'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  URL を入力
                </button>
              </div>

              {formData.imageMode === 'URL' ? (
                <input
                  id="dash-input-url"
                  type="url"
                  value={formData.inputData}
                  onChange={(e) => onFieldChange('inputData', clampText(e.target.value, MAX_MODEL_IMAGE_URL_LENGTH))}
                  required={formData.imageMode === 'URL'}
                  className="mt-3 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="https://example.com/image.jpg"
                  maxLength={MAX_MODEL_IMAGE_URL_LENGTH}
                />
              ) : (
                <div key={`upload-${formData.imageFilename || 'empty'}`} className="mt-3">
                  <input
                    id="dash-input-file"
                    type="file"
                    accept="image/*"
                    onChange={onImageFileChange}
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
              <label htmlFor="dash-width" className="block text-sm font-medium text-gray-700">
                幅（cm）
              </label>
              <input
                id="dash-width"
                type="number"
                value={formData.width}
                onChange={(e) => onFieldChange('width', e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="10"
                min={MIN_MODEL_DIMENSION}
                max={MAX_MODEL_DIMENSION}
                step="0.1"
              />
            </div>
            <div>
              <label htmlFor="dash-height" className="block text-sm font-medium text-gray-700">
                高さ（cm）
              </label>
              <input
                id="dash-height"
                type="number"
                value={formData.height}
                onChange={(e) => onFieldChange('height', e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="10"
                min={MIN_MODEL_DIMENSION}
                max={MAX_MODEL_DIMENSION}
                step="0.1"
              />
            </div>
            <div>
              <label htmlFor="dash-depth" className="block text-sm font-medium text-gray-700">
                奥行き（cm）
              </label>
              <input
                id="dash-depth"
                type="number"
                value={formData.depth}
                onChange={(e) => onFieldChange('depth', e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="10"
                min={MIN_MODEL_DIMENSION}
                max={MAX_MODEL_DIMENSION}
                step="0.1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label htmlFor="dash-material" className="block text-sm font-medium text-gray-700">
                材質
              </label>
              <input
                id="dash-material"
                type="text"
                value={formData.material}
                onChange={(e) => onFieldChange('material', clampText(e.target.value, MAX_MODEL_MATERIAL_LENGTH))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="例: プラスチック、金属、木材"
                maxLength={MAX_MODEL_MATERIAL_LENGTH}
              />
            </div>
            <div>
              <label htmlFor="dash-color" className="block text-sm font-medium text-gray-700">
                色
              </label>
              <input
                id="dash-color"
                type="text"
                value={formData.color}
                onChange={(e) => onFieldChange('color', clampText(e.target.value, MAX_MODEL_COLOR_LENGTH))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="例: 青、赤、シルバー"
                maxLength={MAX_MODEL_COLOR_LENGTH}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label htmlFor="dash-style" className="block text-sm font-medium text-gray-700">
                スタイル
              </label>
              <input
                id="dash-style"
                type="text"
                value={formData.style}
                onChange={(e) => onFieldChange('style', clampText(e.target.value, MAX_MODEL_STYLE_LENGTH))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="例: モダン、クラシック、未来的"
                maxLength={MAX_MODEL_STYLE_LENGTH}
              />
            </div>
            <div>
              <label htmlFor="dash-quality" className="block text-sm font-medium text-gray-700">
                品質
              </label>
              <select
                id="dash-quality"
                value={formData.quality}
                onChange={(e) => onFieldChange('quality', e.target.value as FormDataState['quality'])}
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
              onChange={(e) => onFieldChange('texture', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="texture" className="ml-2 block text-sm text-gray-700">
              テクスチャ生成を有効にする
            </label>
          </div>
        </div>

        <div className="flex space-between space-x-3">
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '開始中...' : '生成開始'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md"
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  )
}
