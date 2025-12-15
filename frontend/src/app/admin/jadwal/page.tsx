"use client"

import React, { useEffect, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import timeGridPlugin from '@fullcalendar/timegrid'
// FullCalendar CSS will be injected at runtime to avoid build issues
import { apiBase, authHeaders } from '@/lib/api'
import StatusBadge from '@/components/StatusBadge'
type Store = { id:number; code:string; name:string; tsAssigned?:string }
type User = { id:number; username:string; role:string }

type Schedule = { id: number; title: string; start: string; end?: string; status: string; storeId?: number }

export default function AdminJadwalPage() {
  const calendarRef = useRef<FullCalendar | null>(null)
  const [events, setEvents] = useState<any[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [tsList, setTsList] = useState<User[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState<number | ''>('' as any)
  const [selectedTs, setSelectedTs] = useState<string>('')
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [pendingStart, setPendingStart] = useState<string>('')
  const [lastAutoTitle, setLastAutoTitle] = useState('')

  function broadcastScheduleUpdate(){
    try { localStorage.setItem('schedule_last_update', String(Date.now())) } catch {}
    try { window.dispatchEvent(new Event('schedule:updated')) } catch {}
  }

  async function load() {
    try {
      const res = await fetch(`${apiBase}/schedules`, { headers: authHeaders() })
      if (!res.ok) throw new Error('Gagal load jadwal')
      const json = await res.json()
      const stores = await fetch(`${apiBase}/stores`, { headers: authHeaders() }).then(r=>r.json())
      const users = await fetch(`${apiBase}/users`, { headers: authHeaders() }).then(r=>r.json())
      setStores(stores||[])
      setTsList((users||[]).filter((u:User)=> (String(u.role||'').toLowerCase()==='user' || String(u.role||'').toLowerCase()==='ts')))
      const storeMap = new Map<number, Store>((stores||[]).map((s:Store)=>[s.id, s]))
      const ev = (json || []).map((s: Schedule) => {
  const storeName = s.storeId ? (storeMap.get(s.storeId)?.name || '') : ''
  let displayTitle = s.title || ''
  if (/^(Maintenance|Mtc)\b/i.test(displayTitle)) {
    displayTitle = `Mtc${storeName ? ` - ${storeName}` : ''}`
  }
  return {
    id: String(s.id),
    title: displayTitle,
    start: s.start,
    end: s.end,
    extendedProps: {
      status: s.status,
      storeId: s.storeId,
      storeCode: s.storeId ? (storeMap.get(s.storeId)?.code || '') : '',
      storeName: s.storeId ? (storeMap.get(s.storeId)?.name || '') : '',
      assignedTs: (s as any).assignedTs || '',
    },
  }
})
      setEvents(ev)
    } catch (e) { console.error(e); alert('Gagal memuat jadwal') }
  }

  useEffect(()=>{ load() }, [])

  useEffect(() => {
    const head = document.head
    const urls = [
      'https://cdn.jsdelivr.net/npm/@fullcalendar/core@6.1.19/index.global.min.css',
      'https://cdn.jsdelivr.net/npm/@fullcalendar/daygrid@6.1.19/index.global.min.css',
      'https://cdn.jsdelivr.net/npm/@fullcalendar/timegrid@6.1.19/index.global.min.css',
    ]
    const links = urls.map((href) => {
      const l = document.createElement('link')
      l.rel = 'stylesheet'
      l.href = href
      head.appendChild(l)
      return l
    })
    return () => { links.forEach((l) => head.removeChild(l)) }
  }, [])

  async function handleDateSelect(selectInfo: any) {
    setPendingStart(selectInfo.startStr)
    setShowCreate(true)
  }

  // -------- Export / Import (Master Jadwal) --------
  function downloadCSV(name:string, rows:any[], columns:string[]){
    const header = columns.join(',')
    const body = rows.map(r => columns.map(c => JSON.stringify(r[c] ?? '')).join(',')).join('\n')
    const csv = header + '\n' + body
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
  }

  async function exportTemplate(){
    const cols = ['date','storeId','storeName','assignedTs','title']
    const rows = stores.map(s=>({
      date: 'YYYY-MM-DD',
      storeId: s.id,
      storeName: s.name,
      assignedTs: s.tsAssigned || '',
      title: `Mtc - ${s.name}`,
    }))
    downloadCSV('master-jadwal-template.csv', rows, cols)
  }

  async function exportTemplatePerTS(){
    const cols = ['date','storeId','storeName','assignedTs','title']
    const groups = new Map<string, typeof stores>()
    for (const s of stores){
      const key = (s.tsAssigned||'UNASSIGNED').trim() || 'UNASSIGNED'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(s)
    }
    for (const [ts, list] of groups){
      if (ts === 'UNASSIGNED') continue // lewati yang belum ada TS agar tidak membingungkan SPV
      const rows = list.map(s=>({
        date: 'YYYY-MM-DD',
        storeId: s.id,
        storeName: s.name,
        assignedTs: ts,
        title: `Mtc - ${s.name}`,
      }))
      const safe = ts.replace(/[^a-z0-9_-]+/gi,'_')
      downloadCSV(`master-jadwal-${safe}.csv`, rows, cols)
    }
  }

  async function exportSchedules(){
    const cols = ['id','date','storeId','storeName','assignedTs','status','title']
    const rows = events.map((e:any)=>({
      id: e.id,
      date: new Date(e.start).toISOString().slice(0,10),
      storeId: e.extendedProps?.storeId || '',
      storeName: e.extendedProps?.storeName || '',
      assignedTs: e.extendedProps?.assignedTs || '',
      status: e.extendedProps?.status || '',
      title: e.title || '',
    }))
    downloadCSV('jadwal-export.csv', rows, cols)
  }

  async function importFromFile(file: File){
    try{
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type:'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json:any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })
      if (!json || json.length===0){ alert('File kosong'); return }

      const idMap = new Map<number, Store>(stores.map(s=>[s.id, s]))
      const codeMap = new Map<string, Store>(stores.map(s=>[(s.code||'').toLowerCase(), s]))
      const nameMap = new Map<string, Store>(stores.map(s=>[(s.name||'').toLowerCase(), s]))

      let ok=0, fail=0

      function parseDateFlexible(input: any): Date | null {
        if (input instanceof Date) {
          const d = new Date(Date.UTC(input.getFullYear(), input.getMonth(), input.getDate(), 12,0,0))
          return d
        }
        if (typeof input === 'number' && Number.isFinite(input)) {
          // Excel serial date number → UTC date
          // Excel epoch: 1899-12-30
          const base = new Date(Date.UTC(1899, 11, 30, 12, 0, 0))
          const d = new Date(base.getTime() + Math.round(input) * 86400000)
          return d
        }
        const raw = String(input||'').trim()
        if (!raw) return null
        if (/^y{4}-m{2}-d{2}$/i.test(raw) || /contoh/i.test(raw)) return null
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)){
          const [Y,M,D] = raw.split('-').map(n=>Number(n))
          const d = new Date(Date.UTC(Y,M-1,D,12,0,0))
          return isNaN(d.getTime()) ? null : d
        }
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)){
          const [p1,p2,p3] = raw.split('/')
          const A = Number(p1), B = Number(p2), C = Number(p3)
          let DD = A
          let MM = B
          // Jika A>12 (tak mungkin hari), maka interpretasi MM/DD/YYYY
          if (A > 12 && B <= 12) { DD = B; MM = A }
          const d = new Date(Date.UTC(C, MM-1, DD, 12, 0, 0))
          return isNaN(d.getTime()) ? null : d
        }
        const d = new Date(raw)
        return isNaN(d.getTime()) ? null : new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12,0,0))
      }
      for (const row of json){
        const pick = (keys:string[])=> keys.map(k=>row[k]).find((v:any)=> v!==undefined && v!=='')
        const dStr = pick(['date','tanggal','start'])
        const title = pick(['title','judul']) || ''
        const tsUser = pick(['assignedTs','ts']) || ''
        let storeId:any = pick(['storeId','store_id'])
        const storeCode = pick(['storeCode','code'])
        const storeName = pick(['storeName','store'])

        const date = parseDateFlexible(dStr)
        // tanggal kosong/placeholder → lewati tanpa gagal
        if (!date) { continue }

        let store: Store | undefined
        if (storeId) { storeId = Number(storeId); if (Number.isFinite(storeId)) store = idMap.get(storeId) }
        if (!store && storeCode) store = codeMap.get(String(storeCode).toLowerCase())
        if (!store && storeName) store = nameMap.get(String(storeName).toLowerCase())
        if (!store) { fail++; continue }

        const body:any = {
          title: title || `Mtc - ${store.name}`,
          start: date.toISOString(),
          status: 'pending',
          storeId: store.id,
          assignedTs: tsUser || store.tsAssigned || null,
        }
        const res = await fetch(`${apiBase}/schedules`, { method:'POST', headers: authHeaders(), body: JSON.stringify(body) })
        if (res.ok) ok++; else fail++
      }
      const skipped = json.length - (ok + fail)
      alert(`Import selesai. Berhasil: ${ok}, Dilewati tanpa tanggal: ${skipped}, Gagal: ${fail}`)
      await load()
      broadcastScheduleUpdate()
    }catch(e){ console.error(e); alert('Gagal mengimpor file') }
  }

  // Generate automatic title based on selected store (short label)
  function genAutoTitle(storeId: number|'' , ts: string){
    let title = 'Mtc'
    if (storeId) {
      const s = stores.find(x=>x.id===storeId)
      if (s) title += ` - ${s.name || s.code}`
    }
    // TS akan ditampilkan sebagai subtext agar tidak duplikat di calendar
    return title
  }

  useEffect(()=>{
    if (!showCreate) return
    const auto = genAutoTitle(selectedStoreId as any, selectedTs)
    if (!newTitle || newTitle === lastAutoTitle) {
      setNewTitle(auto)
    }
    setLastAutoTitle(auto)
  }, [showCreate, selectedStoreId, selectedTs, stores])

  async function createSchedule() {
    if (!newTitle) { alert('Judul wajib diisi'); return }
    try {
      const selStore = stores.find(s=>s.id === (selectedStoreId as any))
      const mustTs = selStore?.tsAssigned || selectedTs || null
      const res = await fetch(`${apiBase}/schedules`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ title: newTitle, start: pendingStart, status: 'pending', storeId: selectedStoreId || null, assignedTs: mustTs })
      })
      if (!res.ok) {
        const txt = await res.text()
        if (res.status === 409) { alert(txt || 'Jadwal bentrok. Cek TS/Store pada tanggal tersebut.'); return }
        throw new Error('Gagal membuat jadwal')
      }
      const newItem = await res.json()
      const st = stores.find(s => s.id === (newItem.storeId ?? selectedStoreId))
      const ev = {
        id: String(newItem.id),
        title: newItem.title,
        start: newItem.start,
        end: newItem.end,
        extendedProps: {
          status: newItem.status || 'pending',
          storeId: newItem.storeId ?? (selectedStoreId || null),
          storeCode: st?.code || '',
          storeName: st?.name || '',
          assignedTs: newItem.assignedTs ?? (mustTs || ''),
        }
      } as any
      setEvents(prev => [...prev, ev])
      broadcastScheduleUpdate()
      setShowCreate(false); setNewTitle(''); setPendingStart('')
    } catch (e) { console.error(e); alert('Gagal membuat jadwal') }
  }

  const [editingEvent, setEditingEvent] = useState<any|null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editStoreId, setEditStoreId] = useState<number|''>('' as any)
  const [editTs, setEditTs] = useState('')

  function openEditModal(info:any){
    const ev = info?.event
    if (!ev) return
    const xp = ev.extendedProps || {}
    setEditingEvent({ id: ev.id, start: ev.startStr })
    setEditTitle(ev.title || '')
    setEditStoreId(xp.storeId ?? '' as any)
    setEditTs(xp.assignedTs || '')
  }

  async function saveEdit(){
    if (!editingEvent) return
    try {
      const selStore = stores.find(s=>s.id === (editStoreId as any))
      const mustTs = selStore?.tsAssigned || editTs || null
      const body:any = { title: editTitle, storeId: editStoreId || null, assignedTs: mustTs }
      const res = await fetch(`${apiBase}/schedules/${editingEvent.id}`, { method:'PUT', headers: authHeaders(), body: JSON.stringify(body) })
      if (!res.ok) {
        const t = await res.text();
        if (res.status===409) { alert(t || 'Jadwal bentrok.'); return }
        throw new Error('Gagal update jadwal')
      }
      await load();
      setEditingEvent(null)
      broadcastScheduleUpdate()
    } catch (e){ console.error(e); alert('Gagal menyimpan perubahan') }
  }

  async function deleteEvent(){
    if (!editingEvent) return
    if (!confirm('Hapus jadwal ini?')) return
    try {
      const res = await fetch(`${apiBase}/schedules/${editingEvent.id}`, { method:'DELETE', headers: authHeaders() })
      if (!res.ok) throw new Error('Gagal menghapus jadwal')
      await load(); setEditingEvent(null)
      broadcastScheduleUpdate()
    } catch(e){ console.error(e); alert('Gagal hapus jadwal') }
  }

  async function handleEventRemove(id: string) {
    if (!confirm('Hapus jadwal ini?')) return
    try {
      const res = await fetch(`${apiBase}/schedules/${id}`, { method: 'DELETE', headers: authHeaders() })
      if (!res.ok) throw new Error('Gagal hapus jadwal')
      setEvents(prev => prev.filter(e => e.id !== id))
      broadcastScheduleUpdate()
    } catch (e) { console.error(e); alert('Gagal menghapus jadwal') }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Jadwal Maintenance (Kalender)</h2>
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Pilih tanggal di kalender untuk membuat jadwal.
            <div className="text-xs text-gray-400">
              Template kolom: date, storeId, storeName, assignedTs, title · Format tanggal: <b>YYYY-MM-DD</b> (contoh 2025-11-05) atau DD/MM/YYYY
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className="px-3 py-1.5 rounded bg-emerald-600 text-white" title="Template global untuk semua store" onClick={exportTemplate}>Template Master (Global)</button>
            <button className="px-3 py-1.5 rounded bg-teal-600 text-white" title="Satu file per TS agar mudah diisi SPV per user" onClick={exportTemplatePerTS}>Template per TS (multi-file)</button>
            <button className="px-3 py-1.5 rounded bg-blue-600 text-white" onClick={exportSchedules}>Export Jadwal</button>
            <label className="px-3 py-1.5 rounded bg-indigo-600 text-white cursor-pointer">
              Import CSV/XLSX
              <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" className="hidden" onChange={e=>{ const f=e.target.files?.[0]; if (f) importFromFile(f); (e.target as any).value=''; }} />
            </label>
          </div>
        </div>
      <div className="p-4 bg-white rounded shadow">
        <FullCalendar
          ref={calendarRef}
          plugins={[ dayGridPlugin, timeGridPlugin, interactionPlugin ]}
          initialView="dayGridMonth"
          height="auto"
          dayMaxEvents={true}
          dayMaxEventRows={3}
          moreLinkClick="popover"
          // Memudahkan interaksi di smartphone
          longPressDelay={200}
          selectLongPressDelay={200}
          selectable={true}
          selectMirror={true}
          editable={true}
          events={events}
          select={handleDateSelect}
          dateClick={(arg:any)=>{ try{ setPendingStart(arg.dateStr); setShowCreate(true) }catch{} }}
          eventDidMount={(info:any)=>{
            const p = info.event.extendedProps || {}
            const store = p.storeName || p.storeCode || ''
            const ts = p.assignedTs || ''
            const date = new Date(info.event.startStr).toLocaleDateString()
            info.el.setAttribute('title', `${info.event.title}\n${store ? `Store: ${store}\n` : ''}${ts ? `TS: ${ts}\n` : ''}Tanggal: ${date}`)
          }}
          eventDisplay="block"
          eventDrop={async (dropInfo)=>{
            try{
              const id = dropInfo.event.id
              const start = dropInfo.event.startStr
              const res = await fetch(`${apiBase}/schedules/${id}`, { method:'PUT', headers: authHeaders(), body: JSON.stringify({ start }) })
              if (!res.ok) {
                alert('Gagal memindah jadwal. Cek bentrok.');
                dropInfo.revert();
              } else {
                broadcastScheduleUpdate()
              }
            }catch{ dropInfo.revert() }
          }}
          eventContent={(arg:any)=>{
            const p = arg.event.extendedProps || {}
            const storeLabel = p.storeCode ? `${p.storeCode}` : (p.storeName||'')
            const tsLabel = p.assignedTs ? `TS: ${p.assignedTs}` : ''
            const title = (arg.event.title||'').replace(/^\s+|\s+$/g,'')
            // Render dengan 2 baris kecil agar presisi dan tidak overflow
            const html = `
              <div style="line-height:1.1">
                <div class="font-semibold text-[11px] whitespace-nowrap overflow-hidden text-ellipsis">${title}</div>
                ${(storeLabel||tsLabel)?`<div class="text-[10px] text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis">${[storeLabel, tsLabel].filter(Boolean).join(' • ')}</div>`:''}
              </div>`
            return { html }
          }}
          eventClick={(info)=> openEditModal(info)}
        />
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg w-full max-w-lg p-5 space-y-4">
            <h3 className="text-lg font-semibold">Buat Jadwal</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm">Judul</label>
                <input className="w-full border rounded px-3 py-2" value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Contoh: Cek AC" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm">Store</label>
                  <select className="w-full border rounded px-2 py-2" value={selectedStoreId as any} onChange={e=>{ const v = e.target.value? Number(e.target.value): '' as any; setSelectedStoreId(v); const st = stores.find(s=>s.id===Number(e.target.value)); if (st?.tsAssigned) setSelectedTs(st.tsAssigned); }}>
                    <option value="">-</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm">Assign ke TS</label>
                  <select className="w-full border rounded px-2 py-2" value={selectedTs} onChange={e=>setSelectedTs(e.target.value)} disabled={(function(){ const st = stores.find(s=>s.id=== (selectedStoreId as any)); return !!st?.tsAssigned })()}>
                    <option value="">-</option>
                    {(function(){ const st = stores.find(s=>s.id=== (selectedStoreId as any)); const only = st?.tsAssigned; const list = only ? tsList.filter(t=>t.username===only) : tsList; return list.map(ts => <option key={ts.id} value={ts.username}>{ts.username}</option>) })()}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-2 rounded bg-gray-200" onClick={()=>{ setShowCreate(false); setNewTitle(''); setPendingStart('') }}>Batal</button>
              <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={createSchedule}>Simpan</button>
            </div>
          </div>
        </div>
      )}

      {editingEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg w-full max-w-lg p-5 space-y-4">
            <h3 className="text-lg font-semibold">Detail Jadwal</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm">Judul</label>
                <input className="w-full border rounded px-3 py-2" value={editTitle} onChange={e=>setEditTitle(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm">Store</label>
                  <select className="w-full border rounded px-2 py-2" value={editStoreId as any} onChange={e=>{ const v = e.target.value? Number(e.target.value): '' as any; setEditStoreId(v); const st = stores.find(s=>s.id===Number(e.target.value)); if (st?.tsAssigned) setEditTs(st.tsAssigned); }}>
                    <option value="">-</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm">Assign ke TS</label>
                  <select className="w-full border rounded px-2 py-2" value={editTs} onChange={e=>setEditTs(e.target.value)} disabled={(function(){ const st = stores.find(s=>s.id=== (editStoreId as any)); return !!st?.tsAssigned })()}>
                    <option value="">-</option>
                    {(function(){ const st = stores.find(s=>s.id=== (editStoreId as any)); const only = st?.tsAssigned; const list = only ? tsList.filter(t=>t.username===only) : tsList; return list.map(ts => <option key={ts.id} value={ts.username}>{ts.username}</option>) })()}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-between gap-2">
              <button className="px-3 py-2 rounded bg-red-600 text-white" onClick={deleteEvent}>Hapus</button>
              <div className="flex gap-2">
                <button className="px-3 py-2 rounded bg-gray-200" onClick={()=>setEditingEvent(null)}>Tutup</button>
                <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={saveEdit}>Simpan</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
