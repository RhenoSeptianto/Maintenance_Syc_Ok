"use client"

import React, { useEffect, useState } from 'react'
import StatusBadge from '@/components/StatusBadge'
import { apiBase, authHeaders } from '@/lib/api'

type Store = { id: number; name: string; location?: string; tsAssigned?: string }
type Schedule = { id: number; title: string; start: string; end?: string; status: string; assignedTs?: string; storeId?: number }
type Maintenance = { id:number; title:string; date:string; status:string; storeName?:string }

export default function AdminDashboardPage() {
  const [stores, setStores] = useState<Store[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [maintenances, setMaintenances] = useState<Maintenance[]>([])

  // Gunakan apiBase bersama (mobile-friendly)

  function broadcastScheduleUpdate(){
    try { localStorage.setItem('schedule_last_update', String(Date.now())) } catch {}
    try { window.dispatchEvent(new Event('schedule:updated')) } catch {}
  }

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const headers: any = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`

        const [storesRes, schedulesRes, maintRes] = await Promise.all([
          fetch(`${apiBase}/stores`, { headers }),
          fetch(`${apiBase}/schedules`, { headers }),
          fetch(`${apiBase}/maintenances`, { headers }),
        ])

        if (!storesRes.ok) throw new Error('Failed to load stores')
        if (!schedulesRes.ok) throw new Error('Failed to load schedules')
        if (!maintRes.ok) throw new Error('Failed to load maintenances')

        const storesJson = await storesRes.json()
        const schedulesJson = await schedulesRes.json()
        const maintJson = await maintRes.json()
        if (mounted) {
          setStores(storesJson || [])
          setSchedules(schedulesJson || [])
          setMaintenances(maintJson || [])
        }
      } catch (e) {
        console.error('Load admin dashboard error', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const upcoming = schedules
    .slice()
    .filter(s => {
      const d = new Date(s.start).getTime()
      const now = new Date(); now.setHours(0,0,0,0)
      const in30d = (()=>{ const x = new Date(now); x.setDate(x.getDate()+30); return d <= x.getTime() })()
      const status = String(s.status || '').toLowerCase()
      const isFutureOrToday = d >= now.getTime()
      const notFinished = !['done','completed','complete','complate','selesai','cancelled','canceled'].includes(status)
      return isFutureOrToday && notFinished && in30d
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

  const overdue = schedules
    .slice()
    .filter(s => {
      const d = new Date(s.start).getTime()
      const now = new Date(); now.setHours(0,0,0,0)
      const status = String(s.status || '').toLowerCase()
      const isPast = d < now.getTime()
      const active = !['done','completed','complete','complate','selesai','cancelled','canceled'].includes(status)
      return isPast && active
    })
    .sort((a,b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0,5)

  const completedMaint = maintenances
    .slice()
    .filter(m => {
      // sembunyikan tiket fix_request
      try { const d = JSON.parse(String((m as any).details||'{}')); if (d?.type==='fix_request') return false } catch {}
      const st = String(m.status||'').toLowerCase()
      return st.includes('approve') || st==='completed' || st==='complete' || st==='complate'
    })
    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0,5)

  // authHeaders diambil dari lib agar konsisten

  async function rescheduleSchedule(id: number){
    openReschedule(id)
  }

  const [showReschedule, setShowReschedule] = useState(false)
  const [rescheduleId, setRescheduleId] = useState<number| null>(null)
  const [rescheduleDate, setRescheduleDate] = useState<string>('') // YYYY-MM-DD

  function fmtDateYYYYMMDD(d: Date){
    const y = d.getFullYear()
    const m = String(d.getMonth()+1).padStart(2,'0')
    const day = String(d.getDate()).padStart(2,'0')
    return `${y}-${m}-${day}`
  }
  function openReschedule(id:number){
    setRescheduleId(id)
    const s = schedules.find(x=>x.id===id)
    const cur = s ? new Date(s.start) : new Date()
    setRescheduleDate(fmtDateYYYYMMDD(cur))
    setShowReschedule(true)
  }
  async function submitReschedule(){
    if (!rescheduleId || !rescheduleDate) return
    // set ke tengah hari (12:00) untuk hindari pergeseran tanggal karena timezone
    const newDate = new Date(rescheduleDate + 'T12:00:00')
    try{
      const resp = await fetch(`${apiBase}/schedules/${rescheduleId}/reschedule`, { method:'PUT', headers: authHeaders(), body: JSON.stringify({ start: newDate.toISOString() }) })
      if (!resp.ok) {
        const txt = await resp.text().catch(()=> '')
        throw new Error(txt || 'Reschedule failed')
      }
      // Optimistic: update local state segera agar pindah list tanpa reload penuh
      setSchedules(prev => prev.map(s => s.id===rescheduleId ? { ...s, start: newDate.toISOString() } as any : s))
      // Optionally refresh dari server
      const headers = authHeaders()
      fetch(`${apiBase}/schedules`, { headers }).then(r=>r.json()).then(js=> setSchedules(js||[])).catch(()=>{})
      broadcastScheduleUpdate()
      setShowReschedule(false)
      setRescheduleId(null)
    }catch(e){
      console.error('Reschedule error', e)
      alert('Gagal reschedule')
    }
  }

  const pendingApprovals = maintenances.filter(m => (m.status||'').toLowerCase()==='submitted').length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg shadow bg-gradient-to-r from-cyan-500 to-blue-600 text-white flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-white/90 flex items-center justify-center shadow-sm">
            <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M4 4h16l1 4H3l1-4Zm0 6h16v10H4V10Zm3 2v6h2v-6H7Zm8 0v6h2v-6h-2Z"/>
            </svg>
          </div>
          <div>
            <div className="text-sm/5 opacity-90">Total Store</div>
            <div className="text-2xl font-bold">{stores.length}</div>
          </div>
        </div>
        <div className="p-4 rounded-lg shadow bg-gradient-to-r from-amber-500 to-orange-600 text-white flex items-center gap-3">
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor"><path d="m9 16 9-9 1.5 1.5L9 19 4.5 14.5 6 13l3 3Z"/></svg>
          <div>
            <div className="text-sm/5 opacity-90">Menunggu Persetujuan</div>
            <div className="text-2xl font-bold">{pendingApprovals}</div>
          </div>
        </div>
        <div className="p-4 rounded-lg shadow bg-gradient-to-r from-emerald-500 to-teal-600 text-white flex items-center gap-3">
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2h2v3H7V2Zm8 0h2v3h-2V2ZM3 7h18v14H3V7Zm2 4h4v4H5v-4Z"/></svg>
          <div>
            <div className="text-sm/5 opacity-90">Jadwal Mendatang</div>
            <div className="text-2xl font-bold">{upcoming.length}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-white rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Daftar Store</h2>
          {loading ? (
            <div>Memuat...</div>
          ) : (
            <div className="tbl-wrap max-h-64">
              <table className="tbl">
                <thead>
                  <tr className="text-sm text-gray-500">
                    <th className="pb-2">Nama</th>
                    <th className="pb-2">Lokasi</th>
                    <th className="pb-2">TS</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map(s => (
                    <tr key={s.id} className="border-t">
                      <td className="py-2">{s.name}</td>
                      <td className="py-2">{s.location ?? '-'}</td>
                      <td className="py-2">{s.tsAssigned ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-4 bg-white rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Jadwal Mendatang</h2>
          {loading ? (
            <div>Memuat...</div>
          ) : upcoming.length === 0 ? (
            <div className="text-gray-500">Tidak ada jadwal mendatang</div>
          ) : (
            <ul className="space-y-2" style={{ maxHeight: '320px', overflowY: 'auto' }}>
              {upcoming.map(u => {
                const s = stores.find(st => st.id === (u.storeId as any))
                const ts = u.assignedTs || s?.tsAssigned || '-'
                const storeLabel = s?.name || ''
                return (
                  <li key={u.id} className="p-3 border rounded bg-gradient-to-r from-indigo-50 to-white">
                    <div className="font-semibold flex items-center gap-2">
                      <svg className="w-4 h-4 text-indigo-600" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2h2v3H7V2Zm8 0h2v3h-2V2ZM3 7h18v14H3V7Zm2 4h4v4H5v-4Z"/></svg>
                      {u.title}
                    </div>
                    <div className="text-sm text-gray-600">{new Date(u.start).toLocaleDateString()}</div>
                    <div className="text-xs text-gray-600">TS: {ts}{storeLabel ? ` · Store: ${storeLabel}`: ''}</div>
                    <div className="mt-1"><StatusBadge status={u.status} /></div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="p-4 bg-white rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Perlu Reschedule</h2>
          {loading ? (
            <div>Memuat...</div>
          ) : overdue.length === 0 ? (
            <div className="text-gray-500">Tidak ada jadwal terlewat</div>
          ) : (
            <ul className="space-y-2">
              {overdue.map(u => (
                <li key={u.id} className="p-3 border rounded bg-white flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{u.title}</div>
                    <div className="text-sm text-gray-600">{new Date(u.start).toLocaleDateString()}</div>
                    <div className="mt-1"><StatusBadge status={u.status} /></div>
                  </div>
                  <button className="px-3 py-1.5 rounded bg-indigo-600 text-white" onClick={()=>rescheduleSchedule(u.id)}>Reschedule</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {showReschedule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg w-full max-w-md p-5 space-y-4">
            <h3 className="text-lg font-semibold">Reschedule Jadwal</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700">Tanggal Baru</label>
                <input type="date" className="border rounded px-3 py-2 w-full" value={rescheduleDate} min={(function(){ const t=new Date(); t.setHours(0,0,0,0); const y=t.getFullYear(); const m=String(t.getMonth()+1).padStart(2,'0'); const d=String(t.getDate()).padStart(2,'0'); return `${y}-${m}-${d}` })()} onChange={e=>setRescheduleDate(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-2 rounded bg-gray-200" onClick={()=>{ setShowReschedule(false); setRescheduleId(null) }}>Batal</button>
              <button className="px-3 py-2 rounded bg-indigo-600 text-white" onClick={submitReschedule}>Simpan</button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 bg-white rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-2">Maintenance Selesai</h2>
        {loading ? (
          <div>Memuat...</div>
        ) : completedMaint.length === 0 ? (
          <div className="text-gray-500">Belum ada maintenance selesai</div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl text-sm">
              <thead>
                <tr className="text-gray-600">
                  <th className="text-left">Judul</th>
                  <th className="text-left">Store</th>
                  <th className="text-left">Tanggal</th>
                  <th className="text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {completedMaint.map(r => (
                  <tr key={r.id} className="border-t">
                    <td className="py-2">{r.title}</td>
                    <td className="py-2">{r.storeName || '-'}</td>
                    <td className="py-2">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="py-2"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
