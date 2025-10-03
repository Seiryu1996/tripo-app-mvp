'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clampText } from '@/lib/text'
import { MAX_ADMIN_NAME_LENGTH, MAX_EMAIL_LENGTH, MAX_PASSWORD_LENGTH } from '@/lib/inputLimits'
import { AdminUser, AdminUserFormData } from '@/components/admin/types'
import { BalanceInfo } from '@/components/admin/BalanceCard'

const initialFormData: AdminUserFormData = {
  name: '',
  email: '',
  password: '',
  role: 'USER',
}

export const useAdminController = () => {
  const router = useRouter()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [balanceInfo, setBalanceInfo] = useState<BalanceInfo | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(true)
  const [balanceError, setBalanceError] = useState('')
  const [formData, setFormData] = useState<AdminUserFormData>(initialFormData)

  useEffect(() => {
    checkAuth()
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchBalance = async (tokenOverride?: string) => {
    const token = tokenOverride ?? localStorage.getItem('token')

    if (!token) {
      setBalanceError('認証情報が見つかりません')
      setBalanceInfo(null)
      setBalanceLoading(false)
      return
    }

    setBalanceError('')
    setBalanceLoading(true)

    try {
      const response = await fetch('/api/admin/tripo/balance', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        let message = 'Tripo残クレジットの取得に失敗しました'
        try {
          const errorData = await response.json()
          message = errorData?.error || message
        } catch {}
        setBalanceError(message)
        setBalanceInfo(null)
        return
      }

      const data: BalanceInfo = await response.json()
      setBalanceInfo(data)
    } catch {
      setBalanceError('Tripo残クレジットの取得に失敗しました')
      setBalanceInfo(null)
    } finally {
      setBalanceLoading(false)
    }
  }

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
        router.push('/login')
        return
      }

      const me = await response.json()
      if (me.role !== 'ADMIN') {
        router.push('/login')
        return
      }
      setCurrentUserId(me.id)
      fetchBalance(token)
    } catch {
      router.push('/login')
    }
  }

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/admin/users', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
      }
    } catch (err) {
      setError('ユーザー一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const resetUserForm = () => {
    setShowCreateForm(false)
    setEditingUser(null)
    setFormData(initialFormData)
  }

  const handleFormChange = (field: keyof AdminUserFormData, value: string) => {
    let nextValue = value

    if (field === 'name') {
      nextValue = clampText(value, MAX_ADMIN_NAME_LENGTH)
    } else if (field === 'email') {
      nextValue = clampText(value, MAX_EMAIL_LENGTH)
    } else if (field === 'password') {
      nextValue = clampText(value, MAX_PASSWORD_LENGTH)
    }

    setError('')
    setFormData((prev) => ({ ...prev, [field]: nextValue }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    const trimmedName = formData.name.trim()
    const trimmedEmail = formData.email.trim()
    const passwordValue = formData.password

    if (!trimmedName) {
      setError('名前は必須です')
      return
    }

    if (trimmedName.length > MAX_ADMIN_NAME_LENGTH) {
      setError(`名前は最大${MAX_ADMIN_NAME_LENGTH}文字までです`)
      return
    }

    if (!trimmedEmail) {
      setError('メールアドレスは必須です')
      return
    }

    if (trimmedEmail.length > MAX_EMAIL_LENGTH) {
      setError(`メールアドレスは最大${MAX_EMAIL_LENGTH}文字までです`)
      return
    }

    if (!editingUser && !passwordValue) {
      setError('パスワードは必須です')
      return
    }

    if (passwordValue && passwordValue.length > MAX_PASSWORD_LENGTH) {
      setError(`パスワードは最大${MAX_PASSWORD_LENGTH}文字までです`)
      return
    }

    try {
      const token = localStorage.getItem('token')
      const url = editingUser ? `/api/admin/users/${editingUser.id}` : '/api/admin/users'
      const method = editingUser ? 'PUT' : 'POST'

      const payload: AdminUserFormData = {
        ...formData,
        name: trimmedName,
        email: trimmedEmail,
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        fetchUsers()
        resetUserForm()
      } else {
        const data = await response.json()
        setError(data.error || '操作に失敗しました')
      }
    } catch {
      setError('操作に失敗しました')
    }
  }

  const handleDelete = async (userId: string) => {
    if (userId === currentUserId) {
      setError('自分のアカウントは削除できません')
      return
    }
    if (!confirm('本当に削除しますか？')) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        fetchUsers()
      } else {
        try {
          const data = await response.json()
          setError(data?.error || '削除に失敗しました')
        } catch {
          setError('削除に失敗しました')
        }
      }
    } catch {
      setError('削除に失敗しました')
    }
  }

  const handleEdit = (user: AdminUser) => {
    setEditingUser(user)
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
    })
    setShowCreateForm(true)
  }

  const handleRefreshBalance = () => {
    fetchBalance()
  }

  const handleToggleCreateForm = () => {
    if (showCreateForm) {
      resetUserForm()
      return
    }
    setError('')
    setEditingUser(null)
    setFormData(initialFormData)
    setShowCreateForm(true)
  }

  const handleCancelForm = () => {
    resetUserForm()
  }

  return {
    users,
    loading,
    showCreateForm,
    editingUser,
    error,
    currentUserId,
    balanceInfo,
    balanceLoading,
    balanceError,
    formData,
    handleToggleCreateForm,
    handleFormChange,
    handleSubmit,
    handleCancelForm,
    handleEdit,
    handleDelete,
    handleRefreshBalance,
  }
}
