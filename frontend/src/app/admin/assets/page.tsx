"use client"
import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { authHeaders, fetchJson } from '@/lib/api'

function Avatar({ name, username }: { name?: string; username: string }){
  const label = (name || username || '?').trim()
  const init = (label[0] || '?').toUpperCase()
  const colors = ['bg-indigo-100 text-indigo-700','bg-emerald-100 text-emerald-700','bg-amber-100 text-amber-700','bg-sky-100 text-sky-700','bg-rose-100 text-rose-700']
  const pick = colors[(username||'').length % colors.length]
  return <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold ${pick}`}>{init}</div>
}

export default function AdminAssetsIndex(){
  const [q,setQ] = useState('')
  const [users,setUsers] = useState<any[]>([])
  const [storeCount,setStoreCount] = useState<Record<string, number>>({})
  const [loading,setLoading] = useState(false)
  const [error,setError] = useState('')
  const [rateLimited,setRateLimited] = useState(false)
  const [retryIn,setRetryIn] = useState(0)
  const retryTimer = useRef<any>(null)
  const abortRef = useRef<AbortController|null>(null)
  const lastLoadAtRef = useRef<number>(0)

  async function load(withBackoff=false){
    const now = Date.now()
    // Hindari spam klik: minimal jeda 800ms antar load
    if (now - (lastLoadAtRef.current||0) < 800 && loading) return
    lastLoadAtRef.current = now
    setLoading(true); setError(''); setRateLimited(false)
    if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null }
    // Batalkan request sebelumnya agar tidak balapan
    try { abortRef.current?.abort() } catch {}
    abortRef.current = new AbortController()
    try{
      const headers = authHeaders()
      // fetch in parallel untuk memperkecil jumlah window request
      const [allUsers, stores] = await Promise.all([
        fetchJson('/users',{ headers, signal: abortRef.current.signal as any }),
        fetchJson('/stores',{ headers, signal: abortRef.current.signal as any })
      ])
      const onlyUsers = (allUsers||[]).filter((u:any)=> {
        const r = String(u.role||'').toLowerCase();
        return r==='user' || r==='ts'
      })
      setUsers(onlyUsers)
      const byUser: Record<string, number> = {}
      ;(stores||[]).forEach((s:any)=>{ const un = String(s.tsAssigned||''); if (un) byUser[un] = (byUser[un]||0) + 1 })
      setStoreCount(byUser)
      // Cache ringan di sessionStorage supaya halaman stabil saat kembali
      try {
        sessionStorage.setItem('assets.users', JSON.stringify(onlyUsers))
        sessionStorage.setItem('assets.storeCount', JSON.stringify(byUser))
      } catch {}
    } catch(e:any){
      const msg = e?.message || 'Gagal memuat'
      setError(msg)
      if (e?.status === 429) {
        setRateLimited(true)
        if (withBackoff){
          // backoff: 5, 10, 20 detik (maks 20) dan pastikan hanya satu timer aktif
          const next = Math.min(retryIn>0 ? Math.min(retryIn*2, 20) : 5, 20)
          setRetryIn(next)
          if (retryTimer.current) clearTimeout(retryTimer.current)
          retryTimer.current = setTimeout(()=> { retryTimer.current=null; load(false) }, next*1000)
        }
      }
    }
    setLoading(false)
  }
  useEffect(()=>{
    // Restore dari cache (jika ada) lalu refresh di background
    try{
      const u = JSON.parse(sessionStorage.getItem('assets.users')||'null')
      const m = JSON.parse(sessionStorage.getItem('assets.storeCount')||'null')
      if (Array.isArray(u)) setUsers(u)
      if (m && typeof m==='object') setStoreCount(m)
    }catch{}
    load(false)
    return () => { if (retryTimer.current) clearTimeout(retryTimer.current) }
  },[])

  const filtered = useMemo(()=>{
    const kw = q.trim().toLowerCase()
    if (!kw) return users
    return users.filter((u:any)=> (u.name||u.username||'').toLowerCase().includes(kw))
  }, [q, users])

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={()=>load(false)}>Muat Ulang</button>
        {loading && <span className="text-sm text-gray-500">Memuat...</span>}
      </div>
      <div className="mb-3">
        <label className="text-sm text-gray-500">Cari User (TS Store)</label>
        <div className="relative max-w-md">
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="nama/username" className="border rounded pl-9 pr-3 py-2 block w-full"/>
          <span className="absolute left-3 top-2.5 text-gray-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </span>
        </div>
      </div>

      {rateLimited && (
        <div className="mb-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Terlalu banyak request. Coba lagi nanti.
          {retryIn>0 && <span className="ml-1">(auto retry {retryIn}s)</span>}
          <button className="ml-auto text-blue-600 underline" onClick={()=>load(false)}>Coba lagi</button>
        </div>
      )}
      {error && !rateLimited && (
        <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
      )}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({length:6}).map((_,i)=> (
            <div key={i} className="border rounded p-3 animate-pulse bg-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-200"/>
                <div className="flex-1">
                  <div className="h-3 bg-slate-200 rounded w-1/2 mb-2"/>
                  <div className="h-2 bg-slate-100 rounded w-1/3"/>
                </div>
              </div>
              <div className="mt-3 h-6 bg-slate-100 rounded w-24"/>
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((u:any)=> (
            <Link key={u.id} href={`/admin/assets/${encodeURIComponent(u.username)}`} className="border rounded p-3 hover:shadow bg-white">
              <div className="flex items-center gap-3">
                <Avatar name={u.name} username={u.username} />
                <div>
                  <div className="font-semibold leading-tight">{u.name || u.username}</div>
                  <div className="text-xs text-gray-500">@{u.username}</div>
                </div>
              </div>
              <div className="mt-3 text-xs">Store: <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 border">{storeCount[u.username] ?? 0}</span></div>
            </Link>
          ))}
          {filtered.length===0 && !loading && <div className="text-sm text-gray-500">Tidak ada user</div>}
        </div>
      )}
    </div>
  )
}
