'use client'

import React from 'react'
import UserForm from './UserForm'
import UserTable from './UserTable'
import { AdminUser, AdminUserFormData } from './types'

interface UserManagementProps {
  users: AdminUser[]
  error: string
  showCreateForm: boolean
  editingUser: AdminUser | null
  formData: AdminUserFormData
  onToggleCreateForm: () => void
  onFormChange: (field: keyof AdminUserFormData, value: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onCancel: () => void
  onEdit: (user: AdminUser) => void
  onDelete: (userId: string) => void
  currentUserId: string
}

export default function UserManagement({
  users,
  error,
  showCreateForm,
  editingUser,
  formData,
  onToggleCreateForm,
  onFormChange,
  onSubmit,
  onCancel,
  onEdit,
  onDelete,
  currentUserId,
}: UserManagementProps) {
  return (
    <div className="px-4 sm:px-0">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">ユーザー管理</h2>
        <button
          onClick={onToggleCreateForm}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
        >
          {showCreateForm ? 'キャンセル' : '新規ユーザー作成'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {showCreateForm && (
        <UserForm
          formData={formData}
          editing={Boolean(editingUser)}
          onChange={onFormChange}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      )}

      <UserTable
        users={users}
        currentUserId={currentUserId}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  )
}
