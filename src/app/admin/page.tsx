'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import BalanceCard, { BalanceInfo } from '@/components/admin/BalanceCard'
import UserManagement from '@/components/admin/UserManagement'
import { AdminUser, AdminUserFormData } from '@/components/admin/types'

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [balanceInfo, setBalanceInfo] = useState<BalanceInfo | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(true)
  const [balanceError, setBalanceError] = useState('')
  const router = useRouter()

  const initialFormData: AdminUserFormData = {
    name: '',
    email: '',
    password: '',
    role: 'USER'
  }

  const [formData, setFormData] = useState<AdminUserFormData>(initialFormData)

  useEffect(() => {
    checkAuth()
    fetchUsers()
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
          'Authorization': `Bearer ${token}`
        }
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
          'Authorization': `Bearer ${token}`
        }
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
          'Authorization': `Bearer ${token}`
        }
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    try {
      const token = localStorage.getItem('token')
      const url = editingUser 
        ? `/api/admin/users/${editingUser.id}` 
        : '/api/admin/users'
      
      const method = editingUser ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
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
          'Authorization': `Bearer ${token}`
        }
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
      role: user.role
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

  const handleFormChange = (field: keyof AdminUserFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleCancelForm = () => {
    resetUserForm()
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
      <Navigation currentPath="/admin" />

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <BalanceCard
          loading={balanceLoading}
          error={balanceError}
          balanceInfo={balanceInfo}
          onRefresh={handleRefreshBalance}
        />

        <UserManagement
          users={users}
          error={error}
          showCreateForm={showCreateForm}
          editingUser={editingUser}
          formData={formData}
          onToggleCreateForm={handleToggleCreateForm}
          onFormChange={handleFormChange}
          onSubmit={handleSubmit}
          onCancel={handleCancelForm}
          onEdit={handleEdit}
          onDelete={handleDelete}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  )
}
