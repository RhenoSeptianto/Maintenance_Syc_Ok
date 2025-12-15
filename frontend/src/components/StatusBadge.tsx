"use client"

import React from 'react'

export default function StatusBadge({ status }: { status?: string }){
  const raw = String(status || '').toLowerCase().trim()

  function normalize(s: string): string {
    if (!s) return '-'
    if (['complete','completed','complate','done','selesai'].includes(s)) return 'complete'
    if (s.includes('approve')) return 'complete'
    if (s.includes('reject')) return 'rejected'
    if (['in_progress','inprogress','progress','ongoing'].includes(s)) return 'in progress'
    if (['cancelled','canceled','batal'].includes(s)) return 'cancelled'
    if (['scheduled','schedule','penjadwalan'].includes(s)) return 'scheduled'
    if (['submitted','pending','waiting','menunggu'].includes(s)) return 'pending'
    return s
  }

  const label = normalize(raw)
  const cls = (
    label === 'complete'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : label === 'rejected' || label === 'cancelled'
      ? 'bg-rose-100 text-rose-700 border-rose-200'
      : label === 'in progress'
      ? 'bg-blue-100 text-blue-700 border-blue-200'
      : 'bg-amber-100 text-amber-700 border-amber-200'
  )
  return <span className={`inline-flex px-2 py-0.5 text-xs rounded-full border ${cls}`}>{label}</span>
}
