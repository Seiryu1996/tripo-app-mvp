'use client'

import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clampText } from '@/lib/text'
import {
  MAX_MODEL_COLOR_LENGTH,
  MAX_MODEL_DESCRIPTION_LENGTH,
  MAX_MODEL_DIMENSION,
  MAX_MODEL_FILENAME_LENGTH,
  MAX_MODEL_IMAGE_FILE_SIZE,
  MAX_MODEL_IMAGE_URL_LENGTH,
  MAX_MODEL_MATERIAL_LENGTH,
  MAX_MODEL_PROMPT_LENGTH,
  MAX_MODEL_STYLE_LENGTH,
  MAX_MODEL_TITLE_LENGTH,
  MIN_MODEL_DIMENSION,
} from '@/lib/inputLimits'
import { createInitialFormData, FormDataState, ImageInputMode, Model } from '../types'

interface UseDashboardControllerOptions {
  onUnauthorized?: () => void
}

export const useDashboardController = (options?: UseDashboardControllerOptions) => {
  const router = useRouter()
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formError, setFormError] = useState('')
  const [systemError, setSystemError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState<FormDataState>(createInitialFormData())
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
    fetchModels()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const hasProcessingModels = models.some((model) => model.status === 'PENDING' || model.status === 'PROCESSING')
    if (!hasProcessingModels) return

    const interval = setInterval(() => {
      fetchModels()
    }, 3000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        options?.onUnauthorized?.()
        router.push('/login')
      }
    } catch {
      options?.onUnauthorized?.()
      router.push('/login')
    }
  }

  const fetchModels = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const response = await fetch(`/api/models?t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      })

      if (response.ok) {
        const data = await response.json()
        setModels(data.models || [])
        setSystemError('')
      } else if (response.status === 401) {
        router.push('/login')
      }
    } catch (err) {
      console.error('Failed to fetch models:', err)
      setSystemError('モデル一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const updateFormField = <K extends keyof FormDataState>(field: K, value: FormDataState[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleImageModeChange = (mode: ImageInputMode) => {
    setFormError('')
    setFormData((prev) => ({
      ...prev,
      imageMode: mode,
      inputData: '',
      imageFilename: '',
    }))
  }

  const handleImageFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      setFormError('')
      setFormData((prev) => ({
        ...prev,
        inputData: '',
        imageFilename: '',
      }))
      return
    }

    if (file.size > MAX_MODEL_IMAGE_FILE_SIZE) {
      setFormError('画像ファイルは最大5MBまでです')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      setFormError('')
      setFormData((prev) => ({
        ...prev,
        inputData: result,
        imageFilename: clampText(file.name, MAX_MODEL_FILENAME_LENGTH),
      }))
    }
    reader.readAsDataURL(file)
  }

  const validateFormData = (): boolean => {
    if (!formData.title.trim()) {
      setFormError('タイトルは必須です')
      return false
    }

    if (formData.title.length > MAX_MODEL_TITLE_LENGTH) {
      setFormError(`タイトルは最大${MAX_MODEL_TITLE_LENGTH}文字までです`)
      return false
    }

    if (formData.description.length > MAX_MODEL_DESCRIPTION_LENGTH) {
      setFormError(`説明は最大${MAX_MODEL_DESCRIPTION_LENGTH}文字までです`)
      return false
    }

    if (formData.material.length > MAX_MODEL_MATERIAL_LENGTH) {
      setFormError(`材質は最大${MAX_MODEL_MATERIAL_LENGTH}文字までです`)
      return false
    }

    if (formData.color.length > MAX_MODEL_COLOR_LENGTH) {
      setFormError(`色は最大${MAX_MODEL_COLOR_LENGTH}文字までです`)
      return false
    }

    if (formData.style.length > MAX_MODEL_STYLE_LENGTH) {
      setFormError(`スタイルは最大${MAX_MODEL_STYLE_LENGTH}文字までです`)
      return false
    }

    if (formData.inputType === 'TEXT') {
      if (!formData.inputData.trim()) {
        setFormError('テキストプロンプトを入力してください')
        return false
      }

      if (formData.inputData.length > MAX_MODEL_PROMPT_LENGTH) {
        setFormError(`テキストプロンプトは最大${MAX_MODEL_PROMPT_LENGTH}文字までです`)
        return false
      }
    } else if (formData.imageMode === 'URL') {
      if (!formData.inputData.trim()) {
        setFormError('画像URLを入力してください')
        return false
      }

      if (formData.inputData.length > MAX_MODEL_IMAGE_URL_LENGTH) {
        setFormError(`画像URLは最大${MAX_MODEL_IMAGE_URL_LENGTH}文字までです`)
        return false
      }
    } else if (!formData.imageFilename || !formData.inputData) {
      setFormError('画像ファイルを選択してください')
      return false
    }

    if (formData.inputType === 'IMAGE' && formData.imageMode === 'URL') {
      try {
        const url = new URL(formData.inputData)
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('Invalid protocol')
        }
      } catch (err) {
        setFormError('有効な画像URLを入力してください')
        return false
      }
    }

    const dimensionFields: Array<{ key: 'width' | 'height' | 'depth'; label: string }> = [
      { key: 'width', label: '幅' },
      { key: 'height', label: '高さ' },
      { key: 'depth', label: '奥行き' },
    ]

    for (const { key, label } of dimensionFields) {
      const value = formData[key]
      if (!value) continue

      const numericValue = Number(value)

      if (Number.isNaN(numericValue)) {
        setFormError(`${label}には数値を入力してください`)
        return false
      }

      if (numericValue < MIN_MODEL_DIMENSION) {
        setFormError(`${label}は${MIN_MODEL_DIMENSION}cm以上で入力してください`)
        return false
      }

      if (numericValue > MAX_MODEL_DIMENSION) {
        setFormError(`${label}は${MAX_MODEL_DIMENSION}cm以下で入力してください`)
        return false
      }
    }

    return true
  }

  const resetForm = () => {
    setFormData(createInitialFormData())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (submitting) return

    if (!validateFormData()) {
      return
    }

    try {
      setSubmitting(true)
      const token = localStorage.getItem('token')
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        fetchModels()
        setShowCreateForm(false)
        resetForm()
        setFormError('')
      } else {
        const data = await response.json()
        setFormError(data.error || '3Dモデル生成の開始に失敗しました')
      }
    } catch {
      setFormError('3Dモデル生成の開始に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (model: Model) => {
    if (isModelLocked(model.status)) {
      setFormError('生成中のモデルは削除できません')
      return
    }

    if (!confirm('このモデルを削除しますか？')) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/models/${model.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        fetchModels()
      } else {
        const data = await response.json()
        setFormError(data.error || 'モデルの削除に失敗しました')
      }
    } catch (err) {
      setFormError('モデルの削除に失敗しました')
    }
  }

  const handleDownload = async (model: Model) => {
    if (!model.modelUrl) return

    setDownloading(model.id)
    setFormError('')

    try {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      const filename = `${model.title}_${timestamp}.glb`
      const downloadUrl = `/api/models/${model.id}/file?type=model&download=1&filename=${encodeURIComponent(filename)}`

      const token = localStorage.getItem('token')
      const response = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
      setFormError('ダウンロードに失敗しました')
    } finally {
      setDownloading(null)
    }
  }

  const toggleCreateForm = () => {
    setFormError('')
    setShowCreateForm((prev) => {
      const next = !prev
      if (!next) {
        resetForm()
      }
      return next
    })
  }

  const errorMessage = formError || systemError

  const value = useMemo(
    () => ({
      models,
      loading,
      showCreateForm,
      error: errorMessage,
      submitting,
      formData,
      downloading,
    }),
    [models, loading, showCreateForm, errorMessage, submitting, formData, downloading],
  )

  return {
    ...value,
    updateFormField,
    handleImageModeChange,
    handleImageFileChange,
    handleSubmit,
    handleDelete,
    handleDownload,
    toggleCreateForm,
  }
}

export const isModelLocked = (status: Model['status']) => status === 'PENDING' || status === 'PROCESSING'

export const getStatusText = (status: Model['status']) => {
  switch (status) {
    case 'PENDING':
      return '待機中'
    case 'PROCESSING':
      return '処理中'
    case 'COMPLETED':
      return '完了'
    case 'FAILED':
      return '失敗'
    case 'BANNED':
      return '禁止コンテンツ'
    default:
      return status
  }
}

export const getStatusColor = (status: Model['status']) => {
  switch (status) {
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800'
    case 'PROCESSING':
      return 'bg-blue-100 text-blue-800'
    case 'COMPLETED':
      return 'bg-green-100 text-green-800'
    case 'FAILED':
      return 'bg-red-100 text-red-800'
    case 'BANNED':
      return 'bg-orange-100 text-orange-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}
