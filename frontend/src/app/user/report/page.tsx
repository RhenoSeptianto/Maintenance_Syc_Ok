"use client"

import React, { useEffect, useState } from 'react'
import { apiBase, authHeaders } from '@/lib/api'
import { SkeletonTable } from '@/components/Skeleton'
import StatusBadge from '@/components/StatusBadge'

type Maintenance = { id:number; title:string; date:string; status:string; submittedBy?:string; details?: string; storeName?: string; technician?: string; updatedAt?: string }

export default function UserReportPage(){
  const [items,setItems] = useState<Maintenance[]>([])
  const [loading,setLoading] = useState(true)
  const [q,setQ] = useState('')
  const [status,setStatus] = useState('')
  const [dateFrom,setDateFrom] = useState('')
  const [dateTo,setDateTo] = useState('')
  const [all,setAll] = useState<Maintenance[]>([])

  const load = React.useCallback(async()=>{
    setLoading(true)
    try{
      const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user')||'{}') : {}
      const res = await fetch(`${apiBase}/maintenances?ts=${Date.now()}`,{ headers: authHeaders(), cache: 'no-store' as RequestCache })
      const json:Maintenance[] = await res.json()
      const mine = user?.username ? json.filter(x=>x.submittedBy===user.username) : json
      // Sembunyikan tiket fix_request dari daftar laporan utama
      const notFix = (arr: any[]) => (arr||[]).filter(x => { try { const d=JSON.parse(String(x.details||'{}')); return d?.type !== 'fix_request' } catch { return true } })
      setItems(notFix(mine).filter(x=>x.status==='approved' || x.status==='complete' || x.status==='completed' || x.status==='complate'))
      setAll(mine||[])
    } finally { setLoading(false) }
  },[])

  useEffect(()=>{
    let mounted = true
    load()
    // Refresh saat kembali fokus/visible/pageshow atau ada sinyal dari form
    const onFocus = () => { if (mounted) load() }
    const onVis = () => { if (mounted && document.visibilityState==='visible') load() }
    const onShow = () => { if (mounted) load() }
    const onStorage = (e: StorageEvent) => {
      if (!mounted) return
      if (['maintenance_last_submit','maintenance_last_edit','lastEditedMaintenanceId'].includes(e.key||'')) load()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pageshow', onShow)
    window.addEventListener('storage', onStorage)
    // Poll ringan setiap 20 detik saat tab visible
    const iv = window.setInterval(()=>{ if (document.visibilityState==='visible') load() }, 5000)
    return ()=>{
      mounted = false
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pageshow', onShow)
      window.removeEventListener('storage', onStorage)
      window.clearInterval(iv)
    }
  },[load])

  async function downloadXLSX(name:string, rows:any[], columns:string[]){
    const XLSX = await import('xlsx')
    const data = [columns, ...rows.map(r => columns.map(c => (r as any)[c]))]
    const ws = XLSX.utils.aoa_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data')
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
  }

  const filtered = (items||[]).filter(m=>{
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
      <h2 className="text-lg font-semibold">Laporan Saya</h2>
      {loading ? <SkeletonTable rows={5} cols={5} /> : (
        <>
          <div className="bg-white p-3 rounded shadow grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-600">Cari</label>
              <input className="border rounded px-3 py-2 w-full" placeholder="judul / store" value={q} onChange={e=>setQ(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-600">Status</label>
              <select className="border rounded px-3 py-2 w-full" value={status} onChange={e=>setStatus(e.target.value)}>
                <option value="">Semua</option>
                <option value="approve">Approved</option>
                <option value="complete">Complete</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600">Dari</label>
              <input type="date" className="border rounded px-3 py-2 w-full" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-600">Sampai</label>
              <input type="date" className="border rounded px-3 py-2 w-full" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
            </div>
            <div className="sm:text-right">
              <button className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded" onClick={()=>downloadXLSX('laporan-saya.xlsx', filtered, ['id','title','date','status'])}>Unduh Excel</button>
            </div>
          </div>
          <div className="tbl-wrap">
          <table className="tbl tbl-report bg-white rounded shadow text-sm">
            <thead>
              <tr>
                <th>Judul</th>
                <th>Tanggal</th>
                <th>Status</th>
                <th className="col-actions">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(it=> (
                <tr key={it.id} className="border-t">
                  <td className="p-2">{it.title}</td>
                  <td className="p-2">{new Date(it.date).toLocaleDateString()}</td>
                  <td className="p-2"><StatusBadge status={it.status} /></td>
                  <td className="p-2 flex gap-2">
                    <button
                      className="px-3 py-1 bg-indigo-600 text-white rounded flex items-center justify-center"
                      onClick={()=>openPdf(it.id)}
                      title="Download PDF"
                      aria-label="Download PDF"
                      style={{ width: 36 }}
                    >📄</button>
                    <button className="px-3 py-1 bg-violet-600 text-white rounded" onClick={async()=>{
                      const XLSX = await import('xlsx')
                      const m:any = it
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
                        try { const jd = JSON.parse(m.details||'{}'); if (Array.isArray(jd.items)) return jd.items } catch{}
                        const raw = String(m.details||'');
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
                      const a = document.createElement('a'); a.href=url; a.download = `maintenance-${it.id}.xlsx`; a.click(); URL.revokeObjectURL(url)
                    }}>Excel</button>
                    {(() => {
                      try{
                        // Sembunyikan tombol jika baru saja selesai diperbaiki
                        try {
                          if (typeof window !== 'undefined') {
                            const last = Number(localStorage.getItem('lastEditedMaintenanceId')||'');
                            const qs = new URLSearchParams(window.location.search);
                            const fromQs = Number(qs.get('editedId')||'');
                            if ((Number.isFinite(last) && last === it.id) || (Number.isFinite(fromQs) && fromQs === it.id)) {
                              localStorage.removeItem('lastEditedMaintenanceId');
                              return null;
                            }
                          }
                        } catch {}
                        // Kumpulkan semua tiket fix yang kemungkinan terkait laporan ini.
                        const titleLC = String(it.title||'').toLowerCase().trim();
                        const storeFromTitle = titleLC.replace(/^form\s+maintenance\s+-\s*/,'').trim();
                        const related = (all||[]).filter(x => {
                          try{
                            const d = JSON.parse(String(x.details||'{}'))
                            if (d?.type !== 'fix_request') return false
                            if (Number(d?.fixForId) === it.id) return true
                            const src = String(d?.sourceTitle||'').toLowerCase().trim()
                            if (src && (src === titleLC || src.includes(storeFromTitle))) return true
                            const t = String(x.title||'').toLowerCase()
                            return t.startsWith('fix request') && (t.includes(titleLC) || t.includes(storeFromTitle))
                          }catch{ return false }
                        })
                        const parsed = (related||[]).filter(x => String(x.status||'').toLowerCase().includes('submit'))
                        const approvedFix = (related||[]).find(x => {
                          const s = String(x.status||'').toLowerCase();
                          return s.includes('approve') || s.includes('complete') || s.includes('completed') || s.includes('complate');
                        })
                        if (approvedFix){
                          // Jika laporan ini sudah diperbaiki setelah fix disetujui, sembunyikan tombol Perbaiki
                          try{
                            const upd = Date.parse(String((it as any).updatedAt||''));
                            let approvedAt = NaN; let approvedObj:any = null; try{ approvedObj=JSON.parse(String((approvedFix as any).details||'{}')); if(approvedObj?.approvedAt){ approvedAt = Date.parse(String(approvedObj.approvedAt)) } }catch{}
                            if (isNaN(approvedAt)) { const base = Date.parse(String((approvedFix as any).date)); if (!isNaN(base)) approvedAt = base }
                            // Prioritaskan penanda fixedAt dari details pada laporan yang diedit
                            try{ const curObj=JSON.parse(String((it as any).details||'{}')); if (curObj?.fixedAt){ const fx=Date.parse(String(curObj.fixedAt)); if(!isNaN(fx) && (isNaN(approvedAt) || fx >= approvedAt)) return null } }catch{}
                            if (!isNaN(upd) && !isNaN(approvedAt) && upd > approvedAt) return null
                          }catch{}
                          let expiresAt:number|undefined
                          try{
                            const d=JSON.parse(String((approvedFix as any).details||'{}'));
                            const t=d?.expiresAt; if (t) { const ms=Date.parse(String(t)); if (!isNaN(ms)) expiresAt=ms }
                            // Fallback: jika tidak ada expiresAt di data lama, pakai tanggal record + 1 jam
                            if (!expiresAt) {
                              const base = Date.parse(String((approvedFix as any).date));
                              if (!isNaN(base)) expiresAt = base + 60*60*1000;
                            }
                          }catch{}
                          const now = Date.now()
                          // Mulai sekarang, perbaikan dikerjakan admin saja
                          return null
                        }
                        if ((parsed||[]).length>0){
                          return (<span className="px-3 py-1 bg-gray-300 text-gray-600 rounded">Menunggu ACC</span>)
                        }
                        // Jika pernah ada approved yang sudah expired, sembunyikan tombol Ajukan
                        try{
                          const expiredAny = (related||[]).some(r => {
                            try{
                              const d=JSON.parse(String(r.details||'{}'));
                              let ms = NaN;
                              if (d?.expiresAt) ms = Date.parse(String(d.expiresAt));
                              if (isNaN(ms)) {
                                const base = Date.parse(String((r as any).date));
                                if (!isNaN(base)) ms = base + 60*60*1000;
                              }
                              // anggap expired jika pernah approve/complete dan sudah lewat 1 jam
                              const s = String((r as any).status||'').toLowerCase();
                              const approvedish = s.includes('approve') || s.includes('complete') || s.includes('completed') || s.includes('complate');
                              return approvedish && !isNaN(ms) && Date.now() > ms;
                            }catch{ return false }
                          })
                          if (expiredAny) return null
                        }catch{}
                        // Tidak ada Ajukan Perbaikan di sisi user
                        return null
                      }catch{return null}
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  )
}



  async function openPdf(id:number){
    const res = await fetch(`${apiBase}/maintenances/${id}/pdf`, { headers: authHeaders() })
    if (!res.ok) { const t = await res.text().catch(()=> ''); alert(`Gagal mengunduh PDF: ${t||res.status}`); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)

    const cd = res.headers.get('content-disposition') || res.headers.get('Content-Disposition') || ''
    let filename = `maintenance-${id}.pdf`
    try {
      const m = cd.match(/filename\*?=(?:UTF-8''|\")?([^";]+)/i)
      if (m && m[1]) {
        filename = decodeURIComponent(m[1].replace(/"/g,''))
      }
    } catch {}

    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }
