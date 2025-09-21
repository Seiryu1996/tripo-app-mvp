'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface NavigationProps {
  currentPath?: string
}

interface User {
  role: 'ADMIN' | 'USER'
}

export default function Navigation({ currentPath }: NavigationProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setLoading(false)
        return
      }

      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      } else {
        localStorage.removeItem('token')
      }
    } catch (error) {
      console.error('Auth check error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/')
  }

  if (loading) {
    return (
      <div className="bg-white shadow mb-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xl font-bold text-gray-900 whitespace-nowrap sm:text-2xl">3D Creator Studio</div>
          <div className="h-8 w-20 bg-gray-200 animate-pulse rounded"></div>
        </div>
      </div>
    </div>
  )
}

  if (!user) {
    return (
      <div className="bg-white shadow mb-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xl font-bold text-gray-900 whitespace-nowrap sm:text-2xl">3D Creator Studio</div>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap"
          >
            ログアウト
          </button>
        </div>
      </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow mb-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-gray-900 whitespace-nowrap sm:text-2xl">
            3D Creator Studio
          </Link>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <nav className="flex flex-wrap items-center gap-2 sm:gap-4">
              <Link 
                href="/dashboard"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  currentPath === '/dashboard' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                ダッシュボード
              </Link>
              
              {user.role === 'ADMIN' && (
                <Link 
                  href="/admin"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    currentPath === '/admin' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  管理画面
                </Link>
              )}
            </nav>
            
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap"
            >
              ログアウト
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
