'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Home() {
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token')
      if (!token) {
        setLoading(false)
        return
      }

      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          const user = await response.json()
          router.push(user.role === 'ADMIN' ? '/admin' : '/dashboard')
        } else {
          // 無効なトークンを削除
          localStorage.removeItem('token')
          setLoading(false)
        }
      } catch (error) {
        // エラーの場合はトークンを削除
        localStorage.removeItem('token')
        setLoading(false)
      }
    }

    checkAuth()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">読み込み中...</div>
      </div>
    )
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Tripo 3D Generator
          </h1>
          <p className="text-gray-600 mb-8">
            テキストや画像から3Dモデルを生成
          </p>
        </div>
        
        <div className="space-y-4">
          <Link
            href="/login"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            ログイン
          </Link>
          
          <div className="text-center">
            <p className="text-sm text-gray-600">
              管理者によるアカウント作成が必要です
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}