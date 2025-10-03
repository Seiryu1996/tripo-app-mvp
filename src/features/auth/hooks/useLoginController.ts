'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MAX_EMAIL_LENGTH, MAX_PASSWORD_LENGTH } from '@/lib/inputLimits'
import { clampText } from '@/lib/text'

export const useLoginController = () => {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token')
      if (!token) return

      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const user = await response.json()
          router.push(user.role === 'ADMIN' ? '/admin' : '/dashboard')
        }
      } catch (error) {
        localStorage.removeItem('token')
      }
    }

    checkAuth()
  }, [router])

  const handleEmailChange = (value: string) => {
    setError('')
    setEmail(clampText(value, MAX_EMAIL_LENGTH))
  }

  const handlePasswordChange = (value: string) => {
    setError('')
    setPassword(clampText(value, MAX_PASSWORD_LENGTH))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const trimmedEmail = email.trim()
    const trimmedPassword = password

    if (!trimmedEmail) {
      setError('メールアドレスは必須です')
      return
    }

    if (trimmedEmail.length > MAX_EMAIL_LENGTH) {
      setError(`メールアドレスは最大${MAX_EMAIL_LENGTH}文字までです`)
      return
    }

    if (!trimmedPassword) {
      setError('パスワードは必須です')
      return
    }

    if (trimmedPassword.length > MAX_PASSWORD_LENGTH) {
      setError(`パスワードは最大${MAX_PASSWORD_LENGTH}文字までです`)
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: trimmedEmail, password: trimmedPassword }),
      })

      const data = await response.json()

      if (response.ok) {
        localStorage.setItem('token', data.token)
        router.push(data.user.role === 'ADMIN' ? '/admin' : '/dashboard')
      } else {
        setError(data.error || 'ログインに失敗しました')
      }
    } catch (err) {
      setError('ログインに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return {
    email,
    password,
    loading,
    error,
    handleEmailChange,
    handlePasswordChange,
    handleSubmit,
  }
}
