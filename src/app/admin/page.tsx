'use client'

import Navigation from '@/components/Navigation'
import BalanceCard from '@/components/admin/BalanceCard'
import UserManagement from '@/components/admin/UserManagement'
import { useAdminController } from '@/features/admin/hooks/useAdminController'

export default function AdminPage() {
  const {
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
  } = useAdminController()

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
