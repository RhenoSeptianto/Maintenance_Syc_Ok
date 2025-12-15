"use client"

import React, { useEffect, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import timeGridPlugin from '@fullcalendar/timegrid'
import { apiBase, authHeaders } from '@/lib/api'

type Store = { id:number; code:string; name:string; tsAssigned?:string }
type Schedule = { id:number; title:string; start:string; end?:string; status:string; storeId?:number; assignedTs?:string }

export default function UserJadwalPage(){
  const calendarRef = useRef<FullCalendar | null>(null)
  const [events, setEvents] = useState<any[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [detail, setDetail] = useState<any|null>(null)

  const me = (()=>{ try { return JSON.parse(localStorage.getItem('user')||'{}') } catch { return {} } })()

  async function load(){
    try{
      const headers = authHeaders()
      const [resStores, resSched] = await Promise.all([
        fetch(`${apiBase}/stores`,{ headers }),
        fetch(`${apiBase}/schedules`,{ headers }),
      ])
      const [jsStores, jsSched] = await Promise.all([resStores.json(), resSched.json()])
      const myStores = (jsStores||[]).filter((s:Store)=>(s.tsAssigned||'') === (me?.username||''))
      setStores(myStores)
      const myStoreIds = new Set(myStores.map((s:Store)=>s.id))
      const ev = (jsSched||[])
        .filter((s:Schedule)=> s.assignedTs===me?.username || (s.storeId && myStoreIds.has(s.storeId)))
        .map((s:Schedule)=>({
          id:String(s.id),
          title:s.title,
          start:s.start,
          end:s.end,
          extendedProps:{ status:s.status, storeId:s.storeId, assignedTs:s.assignedTs }
        }))
      setEvents(ev)
    }catch(e){ console.error(e); alert('Gagal memuat jadwal') }
  }

  useEffect(()=>{ load() },[])

  // Refresh jadwal saat ada event global dari admin (schedule_last_update)
  useEffect(()=>{
    if (typeof window === 'undefined') return
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key !== 'schedule_last_update') return
      load()
    }
    const onCustom = () => { load() }
    window.addEventListener('storage', onStorage)
    window.addEventListener('schedule:updated', onCustom as any)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('schedule:updated', onCustom as any)
    }
  },[])

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

  function openDetail(info:any){
    const ev = info?.event
    if (!ev) return
    const p = ev.extendedProps || {}
    const s = stores.find(st => st.id === p.storeId)
    setDetail({ id: ev.id, title: ev.title, date: ev.startStr, status: p.status, store: s?.code ? `${s.code} - ${s?.name}` : (s?.name || '-') , ts: p.assignedTs || '-', storeId: p.storeId })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Jadwal Saya</h2>
      <div className="p-4 bg-white rounded shadow">
        <FullCalendar
          ref={calendarRef}
          plugins={[ dayGridPlugin, timeGridPlugin, interactionPlugin ]}
          initialView="dayGridMonth"
          selectable={false}
          editable={false}
          events={events}
          eventClick={openDetail}
        />
      </div>

      {detail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg w-full max-w-lg p-5 space-y-3">
            <h3 className="text-lg font-semibold">Detail Jadwal</h3>
            <div className="text-sm">Judul: <b>{detail.title}</b></div>
            <div className="text-sm">Tanggal: {new Date(detail.date).toLocaleDateString()}</div>
            <div className="text-sm">Store: {detail.store}</div>
            <div className="text-sm">TS: {detail.ts}</div>
            <div className="text-sm">Status: {detail.status}</div>
            <div className="flex justify-between">
              {(() => {
                const d = new Date(detail.date); const now = new Date();
                const norm = (x:Date)=>{ const t=new Date(x); t.setHours(0,0,0,0); return t.getTime() };
                const isToday = norm(d) === norm(now);
                const st = String(detail.status||'').toLowerCase();
                const inactive = ['complete','completed','complate','done','selesai','cancelled','canceled'];
                const isActive = !inactive.includes(st);
                const ymd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
                if (isToday && isActive){
                  const s = stores.find(st => st.id === detail.storeId)
                  const storeLabel = encodeURIComponent(String(s?.name || (detail.store||'')).replace(/^\d+\s*-\s*/,''))
                  return (
                    <a className="px-3 py-2 rounded bg-indigo-600 text-white" href={`/maintenance-form.html?mode=user&scheduleId=${detail.id}&storeId=${detail.storeId ?? ''}&storeName=${storeLabel}&date=${ymd}`}>
                      Mulai Maintenance
                    </a>
                  )
                }
                const reason = !isActive ? 'Sudah selesai/dibatalkan' : 'Hanya pada tanggal jadwal'
                return <button className="px-3 py-2 rounded bg-gray-300 text-gray-600 cursor-not-allowed" disabled title={reason}>Mulai Maintenance</button>
              })()}
              <button className="px-3 py-2 rounded bg-gray-200" onClick={()=>setDetail(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
