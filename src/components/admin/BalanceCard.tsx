'use client'

import React from 'react'

export interface BalanceInfo {
  credits: number | null
  details: Record<string, unknown> | null
}

interface BalanceCardProps {
  loading: boolean
  error: string
  balanceInfo: BalanceInfo | null
  onRefresh: () => void
}

export default function BalanceCard({ loading, error, balanceInfo, onRefresh }: BalanceCardProps) {
  return (
    <div className="bg-white shadow rounded-lg p-6 mb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Tripo残クレジット</h3>
          <p className="mt-1 text-sm text-gray-500">Tripo APIの残クレジット数を確認できます。</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className={`inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium shadow-sm transition ${loading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
          aria-label="Tripo残クレジットを再取得"
        >
          {loading ? '更新中...' : '再取得'}
        </button>
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-gray-500">取得中...</p>
        ) : error ? (
          <p data-testid="tripo-balance-error" className="text-sm text-red-600">{error}</p>
        ) : (
          <div>
            <div className="flex items-baseline gap-2">
              <span data-testid="tripo-balance-value" className="text-3xl font-semibold text-gray-900">
                {balanceInfo?.credits !== null && balanceInfo?.credits !== undefined
                  ? balanceInfo.credits
                  : '不明'}
              </span>
              <span className="text-sm text-gray-500">credits</span>
            </div>

            {balanceInfo?.details && Object.keys(balanceInfo.details).length > 0 && (
              <dl className="mt-4 grid grid-cols-1 gap-y-2 text-sm text-gray-600 sm:grid-cols-2 sm:gap-x-4">
                {Object.entries(balanceInfo.details).map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-3 border-b border-gray-100 pb-1">
                    <dt className="font-medium text-gray-500">{key}</dt>
                    <dd className="text-gray-900 break-all">
                      {typeof value === 'object' && value !== null
                        ? JSON.stringify(value)
                        : String(value ?? '')}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
