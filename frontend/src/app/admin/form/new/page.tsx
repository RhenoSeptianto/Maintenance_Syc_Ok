"use client"

import React, { useEffect } from 'react'
import { apiBase, authHeaders } from '@/lib/api'
import { useRouter } from 'next/navigation'

export default function AdminNewMaintenanceForm(){
  const router = useRouter()

  useEffect(()=>{
    function onMsg(ev: MessageEvent){
      const data:any = ev.data || {}
      if (data.type === 'maintenance_form_submit' && data.mode === 'admin'){
        const p = data.payload
        const body = {
          title: `Form Maintenance - ${p.storeName}`,
          details: JSON.stringify({ store: p.storeName, teknisi: p.technician, tanggal: p.date, items: p.items }),
          date: `${p.date}T00:00:00`,
          storeName: p.storeName,
          technician: p.technician,
          status: 'submitted'
        }
        fetch(`${apiBase}/maintenances`,{ method:'POST', headers: authHeaders(), body: JSON.stringify(body) })
          .then(r=>{ if(!r.ok) throw new Error('gagal'); return r.json() })
          .then(()=>{ alert('Form tersimpan'); router.push('/admin/form'); })
          .catch(()=> alert('Gagal menyimpan'))
      }
    }
    window.addEventListener('message', onMsg)
    return ()=> window.removeEventListener('message', onMsg)
  },[])

  return (
    <div className="space-y-4">
      <iframe src="/maintenance-form.html?mode=admin" style={{ width:'100%', height:'80vh', border:'none', background:'#fff', borderRadius:8 }} />
    </div>
  )
}
