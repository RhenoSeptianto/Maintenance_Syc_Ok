"use client"

import React, { useEffect, useState } from 'react'
import { apiBase, authHeaders } from '@/lib/api'
import { SkeletonTable } from '@/components/Skeleton'
import StatusBadge from '@/components/StatusBadge'

type Maintenance = { id:number; title:string; date:string; status:string; submittedBy?:string; details?: string; storeName?: string; technician?: string }
type Schedule = { id:number; title:string; start:string; status:string }

export default function AdminReportPage(){
  const [maintenances,setMaintenances] = useState<Maintenance[]>([])
  const [schedules,setSchedules] = useState<Schedule[]>([])
  const [q,setQ] = useState('')
  const [status,setStatus] = useState('')
  const [dateFrom,setDateFrom] = useState('') // YYYY-MM-DD
  const [dateTo,setDateTo] = useState('')

  useEffect(()=>{(async()=>{
    const [m,s] = await Promise.all([
      fetch(`${apiBase}/maintenances`,{ headers: authHeaders() }).then(r=>r.json()),
      fetch(`${apiBase}/schedules`,{ headers: authHeaders() }).then(r=>r.json()),
    ])
    const notFix = (arr: any[]) => (arr||[]).filter((x:Maintenance)=>{ try { const d=JSON.parse(String((x as any).details||'{}')); return d?.type !== 'fix_request' } catch { return true } })
    setMaintenances(notFix(m||[]).filter((x:Maintenance)=>x.status==='approved' || x.status==='complete' || x.status==='completed' || x.status==='complate'))
    setSchedules(s||[])
  })()},[])

  function downloadCSV(name:string, rows:any[], columns:string[]){
    const header = columns.join(',')
    const body = rows.map(r => columns.map(c => JSON.stringify(r[c] ?? '')).join(',')).join('\n')
    const csv = header + '\n' + body
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
  }

  async function downloadXLSX(name:string, rows:any[], columns:string[]){
    const XLSX = await import('xlsx')
    const data = [columns, ...rows.map(r => columns.map(c => r[c]))]
    const ws = XLSX.utils.aoa_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data')
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
  }

  const filtered = (maintenances||[]).filter(m=>{
    const t = (m.title||'').toLowerCase()
    const qq = q.toLowerCase().trim()
    const okQ = !qq || t.includes(qq)
    const okS = !status || String(m.status||'').toLowerCase().includes(status)
    const d = new Date(m.date); d.setHours(0,0,0,0)
    const okFrom = !dateFrom || d.getTime() >= new Date(dateFrom+'T00:00:00').getTime()
    const okTo = !dateTo || d.getTime() <= new Date(dateTo+'T00:00:00').getTime()
    return okQ && okS && okFrom && okTo
  })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Laporan Maintenance</h2>
      <div className="flex gap-3 flex-wrap">
        <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={()=>downloadCSV('maintenances.csv', maintenances, ['id','title','date','status','submittedBy'])}>Unduh CSV Maintenance (Approved)</button>
        <button className="px-4 py-2 bg-indigo-600 text-white rounded" onClick={()=>downloadXLSX('maintenances.xlsx', maintenances, ['id','title','date','status','submittedBy'])}>Unduh Excel Maintenance</button>
        <button className="px-4 py-2 bg-emerald-600 text-white rounded" onClick={()=>downloadCSV('schedules.csv', schedules, ['id','title','start','status'])}>Unduh CSV Jadwal</button>
      </div>
      <div className="bg-white p-3 rounded shadow flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-600">Cari</label>
          <input className="border rounded px-2 py-1" placeholder="judul / store / teknisi" value={q} onChange={e=>setQ(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-600">Status</label>
          <select className="border rounded px-2 py-1" value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="">Semua</option>
            <option value="approve">Approved</option>
            <option value="complete">Complete</option>
            <option value="reject">Rejected</option>
            <option value="submit">Submitted</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600">Dari</label>
          <input type="date" className="border rounded px-2 py-1" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-600">Sampai</label>
          <input type="date" className="border rounded px-2 py-1" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h3 className="font-semibold mb-2">Daftar Maintenance Disetujui (PDF tersedia)</h3>
        {maintenances.length===0 ? <SkeletonTable rows={5} cols={5} /> : (
        <div className="tbl-wrap">
        <table className="tbl tbl-report text-sm">
          <thead>
            <tr><th>Judul</th><th>Tanggal</th><th>Status</th><th className="col-actions">Aksi</th></tr>
          </thead>
          <tbody>
            {filtered.map(m => (
              <tr key={m.id} className="border-t">
                <td className="p-2">{m.title}</td>
                  <td className="p-2">{new Date(m.date).toLocaleDateString()}</td>
                <td className="p-2"><StatusBadge status={m.status} /></td>
                <td className="p-2 flex gap-2">
                  <button
                    className="px-3 py-1 bg-indigo-600 text-white rounded flex items-center justify-center"
                    onClick={()=>openPdf(m.id)}
                    title="Download PDF"
                    aria-label="Download PDF"
                    style={{ width: 36 }}
                  >📄</button>
                  {/* Edit (admin only) uses static form in admin mode */}
                  <a
                    className="px-3 py-1 bg-amber-500 text-white rounded flex items-center justify-center"
                    href={`/maintenance-form.html?mode=admin&editId=${m.id}${m.storeName?`&storeName=${encodeURIComponent(m.storeName)}`:''}&date=${new Date(m.date).toISOString().slice(0,10)}`}
                    title="Edit"
                    aria-label="Edit"
                    style={{ width: 36 }}
                  >✏️</a>
                  <button
                    className="px-3 py-1 bg-violet-600 text-white rounded flex items-center justify-center"
                    title="Unduh Excel"
                    aria-label="Unduh Excel"
                    style={{ width: 36 }}
                    onClick={async()=>{
                    // Build one-row-per-item workbook
                    const XLSX = await import('xlsx')
                    const normalizeKondisi = (v:string) => {
                      const s = String(v||'').toLowerCase().trim();
                      if (s.includes('tidak')) return 'Tidak Baik';
                      if (s.includes('baik')) return 'Baik';
                      return s;
                    };
                    const fmtDate = (val:any) => {
                      try{
                        const d = val ? new Date(val) : null;
                        if (!d || Number.isNaN(d.getTime())) return '';
                        return d.toLocaleDateString();
                      } catch { return '' }
                    };
                        const fmtUsia = (val:any) => {
                          const n = Number(val);
                          if (!Number.isFinite(n) || n <= 0) return '';
                          const y = Math.floor(n/12); const mth = Math.floor(n%12);
                          if (y && mth) return `${y} th ${mth} bln`;
                          if (y) return `${y} th`; return `${mth} bln`;
                        };
                    const items = (()=>{
                      try { const jd = JSON.parse((m as any).details||'{}'); if (Array.isArray(jd.items)) return jd.items } catch{}
                      const raw = String((m as any).details||'');
                      const lines = raw.replace(/\r/g,'').split('\n').map(s=>s.trim());
                      const out:any[]=[]; let cur:any=null; let no=0;
                      const re = /^(\d+)\.\s*\[(.*?)\]\s*(.*?)\s*\|\s*SN\s*:?(.*?)\|\s*Kondisi\s*:?(.*)$/i;
                      for(const ln of lines){
                        if(!ln) continue; const mm=ln.match(re); if(mm){ cur={ no:Number(mm[1])||(++no), lokasi:(mm[2]||'').trim(), hardware:(mm[3]||'').trim(), sn:String(mm[4]||'').replace(/^\s*:?\s*/,'').trim(), kondisi:(String(mm[5]||'').toLowerCase().includes('tidak')?'tidak':(String(mm[5]||'').toLowerCase().includes('baik')?'baik':'')), panduan:'', keterangan:'' }; out.push(cur); continue }
                        const p = ln.match(/^Panduan:\s*(.*)$/i); if(p&&cur){ cur.panduan=(p[1]||'').trim(); continue }
                        if(cur && !/^\d+\./.test(ln)){ cur.panduan = (cur.panduan?cur.panduan+' ':'')+ln }
                      }
                      return out
                    })();
                    const meta = {
                      storeName: (m as any).storeName || '',
                      date: new Date(m.date).toISOString().slice(0,10),
                      technician: (m as any).technician || (m as any).submittedBy || ''
                    }
                    const header = ['No','Lokasi','Hardware','Merk & SN','Panduan','Kondisi','Usia (th/bln)','Tgl Pembelian','Tgl Perbaikan','Catatan','Keterangan']
                    const data:any[] = [
                      ['Store', meta.storeName],
                      ['Tanggal', meta.date],
                      ['Teknisi', meta.technician],
                      [],
                      header,
                      ...items.map((r:any)=>[
                        r.no,
                        r.lokasi,
                        r.hardware,
                        r.sn,
                        r.panduan,
                        normalizeKondisi(r.kondisi),
                        fmtUsia((r as any).usia),
                        fmtDate((r as any).purchaseDate),
                        fmtDate((r as any).repairDate),
                        (r as any).repairNote || '',
                        r.keterangan || '',
                      ])
                    ]
                    const ws = XLSX.utils.aoa_to_sheet(data)
                    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Maintenance')
                    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
                    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a'); a.href=url; a.download = `maintenance-${m.id}.xlsx`; a.click(); URL.revokeObjectURL(url)
                  }}>📊</button>
                </td>
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
  async function openPdf(id:number){
    const res = await fetch(`${apiBase}/maintenances/${id}/pdf`, { headers: authHeaders() })
    if (!res.ok) { const t = await res.text().catch(()=> ''); alert(`Gagal mengunduh PDF: ${t||res.status}`); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(()=> URL.revokeObjectURL(url), 10_000)
  }
