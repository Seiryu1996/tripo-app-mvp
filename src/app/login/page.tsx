'use client'

import { useLoginController } from '@/features/auth/hooks/useLoginController'
import LoginForm from '@/features/auth/components/LoginForm'

export default function LoginPage() {
  const {
    email,
    password,
    loading,
    error,
    handleEmailChange,
    handlePasswordChange,
    handleSubmit,
  } = useLoginController()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">ログイン</h1>
        </div>

        <LoginForm
          email={email}
          password={password}
          loading={loading}
          error={error}
          onEmailChange={handleEmailChange}
          onPasswordChange={handlePasswordChange}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  )
}
