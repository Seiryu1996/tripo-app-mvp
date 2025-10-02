'use client'

import React from 'react'
import { AdminUserFormData } from './types'

interface UserFormProps {
  formData: AdminUserFormData
  editing: boolean
  onChange: (field: keyof AdminUserFormData, value: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onCancel: () => void
}

export default function UserForm({ formData, editing, onChange, onSubmit, onCancel }: UserFormProps) {
  return (
    <div className="bg-white shadow rounded-lg p-6 mb-6">
      <h3 className="text-lg font-medium mb-4">
        {editing ? 'ユーザー編集' : '新規ユーザー作成'}
      </h3>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="admin-name" className="block text-sm font-medium text-gray-700">名前</label>
          <input
            id="admin-name"
            type="text"
            value={formData.name}
            onChange={(e) => onChange('name', e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="田中太郎"
          />
        </div>
        <div>
          <label htmlFor="admin-email" className="block text-sm font-medium text-gray-700">メールアドレス</label>
          <input
            id="admin-email"
            type="email"
            value={formData.email}
            onChange={(e) => onChange('email', e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="user@example.com"
          />
        </div>
        <div>
          <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700">
            パスワード {editing && '(変更する場合のみ入力)'}
          </label>
          <input
            id="admin-password"
            type="password"
            value={formData.password}
            onChange={(e) => onChange('password', e.target.value)}
            required={!editing}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder={editing ? '変更する場合のみ入力' : 'パスワードを設定'}
          />
        </div>
        <div>
          <label htmlFor="admin-role" className="block text-sm font-medium text-gray-700">権限</label>
          <select
            id="admin-role"
            value={formData.role}
            onChange={(e) => onChange('role', e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="USER">一般ユーザー</option>
            <option value="ADMIN">管理者</option>
          </select>
        </div>
        <div className="flex space-x-3">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            {editing ? '更新' : '作成'}
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
