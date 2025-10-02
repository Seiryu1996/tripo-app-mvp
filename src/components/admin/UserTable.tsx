'use client'

import React from 'react'
import { AdminUser } from './types'

interface UserTableProps {
  users: AdminUser[]
  currentUserId: string
  onEdit: (user: AdminUser) => void
  onDelete: (userId: string) => void
}

export default function UserTable({ users, currentUserId, onEdit, onDelete }: UserTableProps) {
  const formatRole = (role: string) => (role === 'ADMIN' ? '管理者' : '一般ユーザー')
  const roleBadgeClass = (role: string) =>
    role === 'ADMIN'
      ? 'bg-red-100 text-red-800'
      : 'bg-green-100 text-green-800'

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ユーザー
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                権限
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                作成日
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{user.name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${roleBadgeClass(user.role)}`}>
                    {formatRole(user.role)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString('ja-JP')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                  <button
                    onClick={() => onEdit(user)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => onDelete(user.id)}
                    className={`${user.id === currentUserId ? 'text-gray-400' : 'text-red-600 hover:text-red-900'}`}
                    title={user.id === currentUserId ? '自分のアカウントは削除できません' : ''}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
