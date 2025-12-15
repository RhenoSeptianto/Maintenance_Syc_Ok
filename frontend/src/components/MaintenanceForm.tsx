"use client"

import React, { useMemo, useState } from 'react'
import { apiBase, authHeaders } from '@/lib/api'

type Row = { lokasi?:string; hardware:string; panduan:string }

const MASTER_ROWS: Row[] = [
  { lokasi:'Back Office', hardware:'PC', panduan:'Cleaning PC (blower mainboard, fan processor & fan PSU), update antivirus, memastikan tombol dan pointer (keyboard+mouse), memastikan aplikasi (HSIS, LPS, Finger, Helpdesk, Pest control, dll) berfungsi, update database (store, storedb & posdb).' },
  { hardware:'Monitor', panduan:'Memastikan monitor berfungsi dengan baik' },
  { hardware:'UPS', panduan:'Memastikan UPS berfungsi (backup daya)' },
  { hardware:'Printer Inkjet', panduan:'Memastikan print berfungsi dengan baik' },
]

export default function MaintenanceForm({ mode }: { mode: 'admin' | 'user' }){
  const [store,setStore] = useState('')
  const [tanggal,setTanggal] = useState<string>(new Date().toISOString().slice(0,10))
  const [teknisi,setTeknisi] = useState('')
  const [rows,setRows] = useState<Row[]>(() => MASTER_ROWS.map(r=>({ ...r })))
  const [sn,setSn] = useState<Record<number,string>>({})
  const [cond,setCond] = useState<Record<number,'baik'|'tidak'|''>>({} as any)
  const [ket,setKet] = useState<Record<number,string>>({})

  async function submit(e:React.FormEvent){
    e.preventDefault()
    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user')||'{}') : {}
    const items = rows.map((r,idx)=>({ no: idx+1, lokasi:r.lokasi||'', hardware:r.hardware, panduan:r.panduan, sn: sn[idx]||'', kondisi: cond[idx]||'', keterangan: ket[idx]||'' }))
    const payload:any = { title:`Form Maintenance - ${store}`, details: JSON.stringify({ store, teknisi: teknisi || user?.username, tanggal, items }), date: `${tanggal}T00:00:00`, storeName: store, technician: teknisi || user?.username, status: 'submitted' }
    if (mode==='user') payload.submittedBy = user?.username
    const res = await fetch(`${apiBase}/maintenances`,{ method:'POST', headers: authHeaders(), body: JSON.stringify(payload) })
    if(!res.ok) return alert('Gagal menyimpan form')
    alert('Form tersimpan')
  }

  function setCondition(idx:number, val:'baik'|'tidak'){
    setCond(prev=>({ ...prev, [idx]: prev[idx]===val? '' : val }))
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">FORM MAINTENANCE STORE</h2>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm">Nama Store</label>
            <input className="w-full border rounded px-3 py-2" value={store} onChange={e=>setStore(e.target.value)} placeholder="Contoh: Hokben Grand Kota Bintang" required />
          </div>
          <div>
            <label className="block text-sm">Tanggal Maintenance</label>
            <input type="date" className="w-full border rounded px-3 py-2" value={tanggal} onChange={e=>setTanggal(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm">Technical Support</label>
            <input className="w-full border rounded px-3 py-2" value={teknisi} onChange={e=>setTeknisi(e.target.value)} placeholder="Contoh: Rheno Septianto" />
          </div>
        </div>

        <div className="overflow-auto max-h-[70vh] border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="text-gray-700">
                <th className="p-2">No</th>
                <th className="p-2">Lokasi</th>
                <th className="p-2">Hardware</th>
                <th className="p-2">Merk & SN</th>
                <th className="p-2">Panduan</th>
                <th className="p-2">Kondisi</th>
                <th className="p-2">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r,idx)=> (
                <tr key={idx} className="border-t align-top">
                  <td className="p-2">{idx+1}</td>
                  <td className="p-2">{r.lokasi||''}</td>
                  <td className="p-2">{r.hardware}</td>
                  <td className="p-2"><input className="border rounded px-2 py-1 w-56" placeholder="Merk & SN" value={sn[idx]||''} onChange={e=>setSn(v=>({ ...v, [idx]: e.target.value }))} /></td>
                  <td className="p-2 text-xs max-w-md">{r.panduan}</td>
                  <td className="p-2 whitespace-nowrap">
                    <label className="mr-2"><input type="checkbox" checked={cond[idx]==='baik'} onChange={()=>setCondition(idx,'baik')} /> Baik</label>
                    <label><input type="checkbox" checked={cond[idx]==='tidak'} onChange={()=>setCondition(idx,'tidak')} /> Tidak Baik</label>
                  </td>
                  <td className="p-2"><input className="border rounded px-2 py-1 w-56" placeholder="Keterangan" value={ket[idx]||''} onChange={e=>setKet(v=>({ ...v, [idx]: e.target.value }))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <button className="px-4 py-2 bg-blue-600 text-white rounded">Kirim</button>
        </div>
      </form>
    </div>
  )
}

