"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { authHeaders, fetchJson, apiBase } from '@/lib/api'

type Asset = { id:number; name:string; category?:string|null; serialNumber?:string|null; status?:string; ageMonths?:number|null; isOld?:boolean; lastMaintenanceDate?:string|null; lastHistoryDate?:string|null; lastHistoryNote?:string|null; lastMaintenanceOrder?:number|null }
type AssetHistoryItem = { id:number; date:string; note:string; createdBy?:string|null }

function fmtAge(m:number|null|undefined){ if(m==null) return '-'; const y=Math.floor(m/12), mo=m%12; return y>0?`${y} th ${mo} bl`:`${mo} bl` }

const StatusBadge: React.FC<{status?:string}> = ({ status }) => {
  const s = String(status||'').toLowerCase()
  if (s==='in_repair' || s==='tidak') return <span className="text-red-600 font-semibold">Tidak</span>
  if (s==='active' || s==='baik') return <span className="text-green-700 font-semibold">Baik</span>
  return <span>-</span>
}

export default function UserAssets(){
  const [data,setData]=useState<Asset[]>([])
  const [q,setQ]=useState('')
  const [oldOnly,setOldOnly]=useState(false)
  const [loading,setLoading]=useState(false)
  const [stores,setStores]=useState<any[]>([])
  const [storeId,setStoreId]=useState<number|''>('')
  const me = useMemo(()=>{ try { return JSON.parse(localStorage.getItem('user')||'{}') } catch { return {} } },[])

  const abortRef = useRef<AbortController|null>(null)
  const lastLoadAtRef = useRef<number>(0)
  const firstAutoLoadRef = useRef<boolean>(false)
  const [viewHistoryAsset,setViewHistoryAsset] = useState<Asset|null>(null)
  const [historyItems,setHistoryItems] = useState<AssetHistoryItem[]>([])
  const [editingAsset,setEditingAsset] = useState<Asset|null>(null)
  const [ageInput,setAgeInput] = useState<string>('')
  const [historyAsset,setHistoryAsset] = useState<Asset|null>(null)
  const [historyDate,setHistoryDate] = useState<string>('')
  const [historyNote,setHistoryNote] = useState<string>('')
  async function load(){
    const now = Date.now()
    if (now - (lastLoadAtRef.current||0) < 500) return; // brief cooldown
    if (loading) return; // guard from spam clicks
    if (storeId==='') return; // require a chosen store
    setLoading(true)
    try{
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (oldOnly) params.set('oldOnly','true')
      if (storeId) params.set('storeId', String(storeId))
      const headers = authHeaders()
      // Abort previous in-flight request to avoid DB/CPU spikes
      try { abortRef.current?.abort() } catch {}
      abortRef.current = new AbortController()
      const res:any[] = await fetchJson(`/assets?${params.toString()}`, { headers, signal: abortRef.current.signal as any })
      const withSn = (res||[]).filter((it:any)=> String(it?.serialNumber || '').trim() !== '')
      const light = withSn.map((it:any)=> ({
        ...it,
      }))
      setData(light as any)
    } finally { setLoading(false) }
    lastLoadAtRef.current = Date.now()
  }

  // Jangan load apapun saat pertama kali membuka halaman Assets TS
  // useEffect(()=>{ load() },[])

  // Load list of stores assigned to me
  useEffect(()=>{ (async()=>{
    try{
      const headers = authHeaders()
      // Ambil langsung dari backend agar konsisten dengan auth
      const mine = await fetchJson('/stores/mine', { headers })
      setStores(Array.isArray(mine)?mine:[])
      if (Array.isArray(mine) && mine.length===1) setStoreId(mine[0].id)
    } catch {}
  })() },[])

  // Auto-load sekali setelah store terpilih (mis. setelah reschedule balik ke halaman ini)
  useEffect(()=>{
    if (firstAutoLoadRef.current) return
    if (storeId==='') return
    firstAutoLoadRef.current = true
    load()
  }, [storeId])

  function openEditAge(a: Asset){
    setEditingAsset(a)
    setAgeInput(a.ageMonths != null ? String(a.ageMonths) : '')
  }

  async function submitEditAge(){
    if (!editingAsset) return
    try{
      const months = Number(ageInput)
      if (!Number.isFinite(months) || months < 0) { alert('Angka usia tidak valid'); return }
      const res = await fetch(`${apiBase}/assets/${editingAsset.id}`, {
        method:'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ ageSnapshotMonths: Math.round(months) }),
      })
      if (!res.ok){
        const txt = await res.text().catch(()=> '')
        alert(txt || 'Gagal menyimpan usia')
        return
      }
      setEditingAsset(null)
      await load()
    }catch(e){ console.error(e); alert('Gagal mengubah usia') }
  }

  function openAddHistory(a: Asset){
    setHistoryAsset(a)
    const today = new Date().toISOString().slice(0,10)
    setHistoryDate(historyDate || today)
    setHistoryNote('')
  }

  async function submitAddHistory(){
    if (!historyAsset) return
    try{
      const date = historyDate.trim()
      const note = historyNote.trim()
      if (!date || !note) { alert('Tanggal dan catatan wajib diisi'); return }
      await fetchJson(`/assets/${historyAsset.id}/history`, {
        method:'POST',
        headers: authHeaders(),
        body: JSON.stringify({ date, note }),
      } as any)
      setHistoryAsset(null)
      setHistoryNote('')
      await load()
    }catch(e){ console.error(e); alert('Gagal menambah history') }
  }

  async function openViewHistory(a: Asset){
    try{
      const items: AssetHistoryItem[] = await fetchJson(`/assets/${a.id}/history`, { headers: authHeaders() })
      setHistoryItems(items||[])
      setViewHistoryAsset(a)
    }catch(e){ console.error(e); alert('Gagal memuat history') }
  }

  const filtered = useMemo(()=>{
    let arr = data
    const kw = q.trim().toLowerCase()
    if (kw) arr = arr.filter(a => (a.name||'').toLowerCase().includes(kw) || (a.category||'').toLowerCase().includes(kw) || (a.serialNumber||'').toLowerCase().includes(kw))
    // Urutkan mengikuti nomor urut terakhir di form maintenance jika tersedia
    const ordered = [...arr].sort((a:any, b:any) => {
      const ao = (a.lastMaintenanceOrder ?? 9999)
      const bo = (b.lastMaintenanceOrder ?? 9999)
      if (ao !== bo) return ao - bo
      return String(a.name || '').localeCompare(String(b.name || ''))
    })
    return ordered
  }, [data, q])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-lg font-semibold">Assets</div>
      </div>

      <div className="flex flex-wrap gap-2 items-end mb-3">
        <div>
          <label className="text-sm text-gray-500">Cari</label>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="nama/kategori/SN" className="border rounded px-2 py-1 block"/>
        </div>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={oldOnly} onChange={e=>setOldOnly(e.target.checked)} />
          <span>&ge; 5 Tahun</span>
        </label>
        <div>
          <label className="text-sm text-gray-500 block">Store</label>
          <select value={storeId} onChange={e=>setStoreId(e.target.value===''?'':Number(e.target.value))} className="border rounded px-2 py-1 block min-w-[220px]">
            <option value="">Semua store saya</option>
            {stores.map((s:any)=> (
              <option key={s.id} value={s.id}>{s.code?`${s.code} - `:''}{s.name}</option>
            ))}
          </select>
        </div>
        <button onClick={load} disabled={storeId==='' || loading} className="btn px-3 py-2 border rounded bg-blue-600 text-white disabled:opacity-60">{loading? 'Memuat…':'Terapkan'}</button>
        {loading && <span className="text-sm text-gray-500">Memuat...</span>}
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2">Hardware</th>
              <th className="text-left p-2">Merk & SN</th>
              <th className="text-left p-2">Kondisi</th>
              <th className="text-left p-2">Usia</th>
              <th className="text-left p-2">History</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a:any)=> (
              <tr key={a.id} className="border-t">
                <td className="p-2">{a.name}</td>
                <td className="p-2">
                  <div className="leading-tight">{a.serialNumber||'-'}</div>
                  <div className="text-xs text-gray-500">{a.category||'-'}</div>
                </td>
                <td className="p-2"><StatusBadge status={a.status} /></td>
                <td className="p-2">
                  {a.isOld ? <span className="text-red-600 font-semibold">{fmtAge(a.ageMonths)}</span> : fmtAge(a.ageMonths)}
                  <button
                    className="ml-2 inline-flex items-center justify-center text-blue-600 hover:text-blue-800"
                    type="button"
                    onClick={()=>openEditAge(a)}
                    aria-label="Edit usia aset"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                    </svg>
                  </button>
                </td>
                <td className="p-2">
                  {a.lastHistoryDate
                    ? new Date(a.lastHistoryDate).toLocaleDateString()
                    : (a.lastMaintenanceDate ? new Date(a.lastMaintenanceDate).toLocaleDateString() : '-')}
                  {(a as any).lastHistoryNote && (
                    <div className="text-xs text-gray-500 truncate max-w-[220px]">{(a as any).lastHistoryNote}</div>
                  )}
                  <button
                    className="mt-1 text-xs text-blue-600 underline block"
                    type="button"
                    onClick={()=>openAddHistory(a)}
                  >
                    Tambah
                  </button>
                  <button
                    className="mt-0.5 inline-flex items-center justify-center text-blue-600 hover:text-blue-800"
                    type="button"
                    onClick={()=>openViewHistory(a)}
                    aria-label="Lihat history aset"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                  <button
                    className="mt-0.5 text-xs text-blue-600 underline block"
                    type="button"
                    onClick={()=>openViewHistory(a)}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length===0 && !loading && (
              <tr><td className="p-3 text-gray-500" colSpan={5}>{storeId==='' ? 'Pilih store terlebih dahulu' : `Tidak ada data${stores.length>0? ' untuk store terpilih' : ''}`}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setEditingAsset(null)} />
          <div className="relative bg-white w-[92%] max-w-sm rounded-lg shadow-xl p-5">
            <h3 className="text-base font-semibold mb-2">Edit Usia Aset</h3>
            <p className="text-sm text-gray-600 mb-3">{editingAsset.name} — {editingAsset.serialNumber}</p>
            <label className="block text-sm text-gray-700 mb-1">Usia (bulan)</label>
            <input
              type="number"
              min={0}
              className="border rounded px-3 py-2 w-full mb-4"
              value={ageInput}
              onChange={e=>setAgeInput(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button className="px-3 py-2 rounded bg-gray-200" onClick={()=>setEditingAsset(null)}>Batal</button>
              <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={submitEditAge}>Simpan</button>
            </div>
          </div>
        </div>
      )}

      {historyAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setHistoryAsset(null)} />
          <div className="relative bg-white w-[92%] max-w-md rounded-lg shadow-xl p-5 space-y-3">
            <h3 className="text-base font-semibold">Tambah History Perbaikan</h3>
            <p className="text-sm text-gray-600">{historyAsset.name} — {historyAsset.serialNumber}</p>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Tanggal</label>
              <input
                type="date"
                className="border rounded px-3 py-2 w-full"
                value={historyDate}
                onChange={e=>setHistoryDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Catatan</label>
              <textarea
                className="border rounded px-3 py-2 w-full min-h-[80px]"
                value={historyNote}
                onChange={e=>setHistoryNote(e.target.value)}
                placeholder="Contoh: ganti mainboard karena mati total"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button className="px-3 py-2 rounded bg-gray-200" onClick={()=>setHistoryAsset(null)}>Batal</button>
              <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={submitAddHistory}>Simpan</button>
            </div>
          </div>
        </div>
      )}

      {viewHistoryAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setViewHistoryAsset(null)} />
          <div className="relative bg-white w-[92%] max-w-md rounded-lg shadow-xl p-5 space-y-3">
            <h3 className="text-base font-semibold">Riwayat Perbaikan</h3>
            <p className="text-sm text-gray-600">{viewHistoryAsset.name} — {viewHistoryAsset.serialNumber}</p>
            <div className="max-h-[320px] overflow-y-auto space-y-2">
              {historyItems.length === 0 && (
                <div className="text-sm text-gray-500">Belum ada history tercatat.</div>
              )}
              {historyItems.map(h=>(
                <div key={h.id} className="border rounded px-3 py-2 text-sm">
                  <div className="font-medium">{new Date(h.date).toLocaleDateString()}</div>
                  <div className="text-gray-700">{h.note}</div>
                  {h.createdBy && <div className="text-xs text-gray-400 mt-0.5">oleh {h.createdBy}</div>}
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-1">
              <button className="px-3 py-2 rounded bg-gray-200" onClick={()=>setViewHistoryAsset(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
