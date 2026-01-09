"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { apiBase, authHeaders } from '@/lib/api'
import StatusBadge from '@/components/StatusBadge'

type Schedule = { id: number; title: string; start: string; end?: string; status: string; assignedTs?: string; storeId?: number; _storeCode?: string; _storeName?: string }
type Store = { id:number; code:string; name:string; location?:string; tsAssigned?:string }
type Maintenance = { id:number; title:string; date:string; status:string; submittedBy?:string; scheduleId?: number; storeId?: number; storeName?: string; technician?: string }

export default function UserDashboardPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [reports, setReports] = useState<Maintenance[]>([])
  const [loading, setLoading] = useState(true)

  const me = useMemo(()=>{
    if (typeof window === 'undefined') return {} as any
    try { return JSON.parse(localStorage.getItem('user')||'{}') } catch { return {} as any }
  }, [])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const headers = authHeaders()
      const [resSched, resStores, resMaint] = await Promise.all([
        fetch(`${apiBase}/schedules`, { headers }),
        fetch(`${apiBase}/stores`, { headers }),
        fetch(`${apiBase}/maintenances`, { headers }),
      ])
      const [jsSched, jsStores, jsMaint] = await Promise.all([resSched.json(), resStores.json(), resMaint.json()])
      const myStores = (jsStores||[]).filter((s:Store)=> (s.tsAssigned||'') === (me?.username||''))
      const storeMap = new Map<number, Store>(myStores.map((s:Store)=>[s.id, s]))
      const myStoreIds = new Set(myStores.map((s:Store)=>s.id))
      const mySched: Schedule[] = (jsSched||[])
        .filter((s:Schedule)=> (s.assignedTs===me?.username) || (s.storeId && myStoreIds.has(s.storeId)))
        .map((s:Schedule)=> ({ ...s, _storeCode: s.storeId ? (storeMap.get(s.storeId)?.code || '') : undefined, _storeName: s.storeId ? (storeMap.get(s.storeId)?.name || '') : undefined }))
      const myMaint = (jsMaint||[])
        .filter((m:Maintenance)=> m.submittedBy===me?.username)
        .filter((m: any)=>{ try{ const d=JSON.parse(String(m.details||'{}')); return d?.type !== 'fix_request' }catch{ return true } })
      setStores(myStores)
      setSchedules(mySched)
      setReports(myMaint)
    } catch (e) {
      console.error('Load user dashboard error', e)
    } finally {
      setLoading(false)
    }
  }, [me?.username])

  useEffect(() => {
    let mounted = true
    load()
    // Auto refresh saat kembali fokus, pageshow (bfcache), atau ada sinyal dari form via localStorage
    const onFocus = () => { if (mounted) load() }
    const onVisibility = () => { if (mounted && document.visibilityState === 'visible') load() }
    const onPageShow = () => { if (mounted) load() }
    const onStorage = (e: StorageEvent) => {
      if (!mounted) return
      if (!e) return
      if (['maintenance_last_submit','maintenance_last_edit','lastEditedMaintenanceId'].includes(e.key || '')) load()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('storage', onStorage)
    const iv = window.setInterval(() => {
      if (!mounted) return
      if (document.visibilityState === 'visible') load()
    }, 30000)
    return () => {
      mounted = false
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('storage', onStorage)
      window.clearInterval(iv)
    }
  }, [load])

  // Bangun indeks pengajuan yang masih menunggu persetujuan (submitted) untuk menyembunyikan tombol "Mulai Maintenance" pada jadwal yang sama hari & store/TS
  const pendingIndex = React.useMemo(() => {
    const bySched = new Set<number>()
    const byStoreYmd = new Set<string>()
    const byTsYmd = new Set<string>()
    const toYmd = (d:string)=>{ const x=new Date(d); x.setHours(0,0,0,0); return x.getTime() }
    for (const m of reports){
      if (String(m.status||'').toLowerCase() !== 'submitted') continue
      const ymd = toYmd(m.date)
      if (typeof (m as any).scheduleId === 'number') bySched.add((m as any).scheduleId)
      if (typeof (m as any).storeId === 'number') byStoreYmd.add(`${(m as any).storeId}|${ymd}`)
      if ((m as any).technician) byTsYmd.add(`${String((m as any).technician)}|${ymd}`)
    }
    return { bySched, byStoreYmd, byTsYmd }
  }, [reports])

  const upcoming = schedules
    .slice()
    .filter(s => {
      const d = new Date(s.start).getTime()
      const now = new Date(); now.setHours(0,0,0,0)
      const in30d = (()=>{ const x = new Date(now); x.setDate(x.getDate()+30); return d <= x.getTime() })()
      const status = String(s.status || '').toLowerCase()
      const isFutureOrToday = d >= now.getTime()
      const active = !['done','completed','complete','complate','selesai','cancelled','canceled'].includes(status)
      // Sembunyikan jadwal yang sudah diisi form dan menunggu persetujuan admin
      const y = new Date(s.start); y.setHours(0,0,0,0)
      const hasPending = pendingIndex.bySched.has(s.id)
        || (s.storeId ? pendingIndex.byStoreYmd.has(`${s.storeId}|${y.getTime()}`) : false)
        || (s.assignedTs ? pendingIndex.byTsYmd.has(`${s.assignedTs}|${y.getTime()}`) : false)
      return isFutureOrToday && active && in30d && !hasPending
    })
    .sort((a,b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 50) // keep reasonable list size
    

  const overdue = schedules
    .slice()
    .filter(s => {
      const d = new Date(s.start).getTime()
      const now = new Date(); now.setHours(0,0,0,0)
      const status = String(s.status || '').toLowerCase()
      const isPast = d < now.getTime()
      const active = !['done','completed','selesai','cancelled','canceled'].includes(status)
      return isPast && active
    })
    .sort((a,b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0,5)

  const [showReschedule, setShowReschedule] = useState(false)
  const [rescheduleId, setRescheduleId] = useState<number | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState<string>('')

  function broadcastScheduleUpdate(){
    try { localStorage.setItem('schedule_last_update', String(Date.now())) } catch {}
    try { window.dispatchEvent(new Event('schedule:updated')) } catch {}
  }

  function fmtDateYYYYMMDD(d: Date){
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0')
    return `${y}-${m}-${day}`
  }

  function rescheduleSchedule(id:number){
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
      // Optimistic update
      setSchedules(prev => prev.map(s => s.id===rescheduleId ? { ...s, start: newDate.toISOString() } as any : s))
      fetch(`${apiBase}/schedules`, { headers: authHeaders() }).then(r=>r.json()).then(js=> setSchedules(js||[])).catch(()=>{})
      broadcastScheduleUpdate()
      setShowReschedule(false)
      setRescheduleId(null)
    }catch(e){
      console.error('Reschedule error', e)
      alert('Gagal reschedule')
    }
  }
  const last = schedules.slice().sort((a,b) => new Date(b.start).getTime() - new Date(a.start).getTime())[0]
  const latestReports = reports.slice().sort((a,b)=> new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0,5)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Dashboard Saya</h2>
        <button
          type="button"
          onClick={() => load()}
          className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
        >
          Refresh Data
        </button>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg shadow bg-gradient-to-r from-cyan-500 to-blue-600 text-white flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-white/90 flex items-center justify-center shadow-sm">
            <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16l1 4H3l1-4Zm0 6h16v10H4V10Zm3 2v6h2v-6H7Zm8 0v6h2v-6h-2Z"/></svg>
          </div>
          <div>
            <div className="text-sm/5 opacity-90">Store Saya</div>
            <div className="text-2xl font-bold">{stores.length}</div>
          </div>
        </div>
        <div className="p-4 rounded-lg shadow bg-gradient-to-r from-emerald-500 to-teal-600 text-white flex items-center gap-3">
          <svg className="w-9 h-9 p-1 rounded bg-white/90 text-teal-600" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2h2v3H7V2Zm8 0h2v3h-2V2ZM3 7h18v14H3V7Zm2 4h4v4H5v-4Z"/></svg>
          <div>
            <div className="text-sm/5 opacity-90">Jadwal Akan Datang</div>
            <div className="text-2xl font-bold">{upcoming.length}</div>
          </div>
        </div>
        <div className="p-4 rounded-lg shadow bg-gradient-to-r from-amber-500 to-orange-600 text-white flex items-center gap-3">
          <svg className="w-9 h-9 p-1 rounded bg-white/90 text-orange-600" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v16H4V4Zm3 3h10v2H7V7Zm0 4h7v2H7v-2Zm0 4h5v2H7v-2Z"/></svg>
          <div>
            <div className="text-sm/5 opacity-90">Laporan Saya</div>
            <div className="text-2xl font-bold">{reports.length}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-4 bg-white rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Jadwal Maintenance</h2>
          {loading ? <div>Memuat...</div> : (
            upcoming.length === 0 ? (
              <div className="text-gray-500">Belum ada jadwal</div>
            ) : (
              <ul className="space-y-2" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {upcoming.map(u => {
                  const d = new Date(u.start); const now = new Date();
                  const norm = (x:Date)=>{ const t=new Date(x); t.setHours(0,0,0,0); return t.getTime() };
                  const isToday = norm(d) === norm(now);
                  const ymd = (()=>{ const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}` })()
                  const storeLabel = encodeURIComponent(String(u._storeName || u._storeCode || ''))
                  const btn = isToday ? (
                    <a className="px-3 py-2 rounded bg-indigo-600 text-white text-center w-full sm:w-auto" href={`/maintenance-form.html?mode=user&scheduleId=${u.id}&storeId=${u.storeId ?? ''}&storeName=${storeLabel}&date=${ymd}`}>
                      Mulai Maintenance
                    </a>
                  ) : (
                    <button className="px-3 py-2 rounded bg-gray-300 text-gray-600 cursor-not-allowed text-center w-full sm:w-auto" title="Hanya pada tanggal jadwal" disabled>
                      Mulai Maintenance
                    </button>
                  );
                  return (
                    <li key={u.id} className="p-2 border rounded flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold">{u.title}</div>
                        <div className="text-xs text-gray-600">{u._storeName || u._storeCode || ''}</div>
                        <div className="text-sm text-gray-600">{new Date(u.start).toLocaleDateString()}</div>
                      </div>
                      <div className="sm:shrink-0 w-full sm:w-auto">{btn}</div>
                    </li>
                  )
                })}
              </ul>
            )
          )}
        </div>

        <div className="p-4 bg-white rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Store Saya</h2>
          {loading ? <div>Memuat...</div> : (
            stores.length === 0 ? (
              <div className="text-gray-500">Belum ada store. Tambahkan dari menu "Tambah Store".</div>
            ) : (
              <ul className="divide-y" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {stores.map(s => (
                  <li key={s.id} className="py-2 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-gray-600">{s.location || '-'}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      </div>

      <div className="p-4 bg-white rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-2">Perlu Reschedule</h2>
        {loading ? <div>Memuat...</div> : (
          overdue.length === 0 ? (
            <div className="text-gray-500">Tidak ada jadwal terlewat</div>
          ) : (
            <ul className="space-y-2">
              {overdue.map(u => (
                <li key={u.id} className="p-2 border rounded flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{u.title}</div>
                    <div className="text-xs text-gray-600">{u._storeName || u._storeCode || ''}</div>
                    <div className="text-sm text-gray-600">{new Date(u.start).toLocaleDateString()}</div>
                  </div>
                  <button className="px-3 py-2 rounded bg-indigo-600 text-white w-full sm:w-auto" onClick={()=>rescheduleSchedule(u.id)}>Reschedule</button>
                </li>
              ))}
            </ul>
          )
        )}
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
        <h2 className="text-lg font-semibold mb-2">Laporan Terbaru</h2>
        {loading ? <div>Memuat...</div> : (
          latestReports.length === 0 ? (
            <div className="text-gray-500">Belum ada laporan. Isi dari menu "Form Maintenance".</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-600">
                  <th className="text-left pb-2">Judul</th>
                  <th className="text-left pb-2">Tanggal</th>
                  <th className="text-left pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {latestReports.map(r => (
                  <tr key={r.id} className="border-t">
                    <td className="py-2">{r.title}</td>
                    <td className="py-2">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="py-2"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  )
}
