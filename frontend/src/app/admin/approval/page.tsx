"use client"

import React, { useEffect, useState } from 'react'
import { apiBase, authHeaders } from '@/lib/api'
import StatusBadge from '@/components/StatusBadge'
import { useToast } from '@/components/Toast'
import { SkeletonTable } from '@/components/Skeleton'

type Maintenance = { id:number; title:string; date:string; status:string; submittedBy?:string }

export default function AdminApprovalPage() {
  const [items, setItems] = useState<Maintenance[]>([])
  const [loading, setLoading] = useState(true)
  const [previewId, setPreviewId] = useState<number|null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const toast = useToast()

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/maintenances`, { headers: authHeaders() })
      if (!res.ok) throw new Error('Gagal load')
      const all: Maintenance[] = await res.json()
      setItems((all||[]).filter(m => m.status === 'submitted'))
    } catch (e) {
      console.error(e); toast.error('Gagal memuat pengajuan')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function act(id: number, action: 'approve'|'reject') {
    try {
      const res = await fetch(`${apiBase}/maintenances/${id}/${action}`, { method: 'PUT', headers: authHeaders() })
      if (!res.ok) throw new Error('Gagal update')
      await load()
      toast.success(action==='approve' ? 'Pengajuan disetujui' : 'Pengajuan ditolak')
    } catch (e) { console.error(e); toast.error('Gagal mengubah status') }
  }

  async function openPreview(id:number){
    setPreviewId(id); setPreviewLoading(true); setPreviewUrl('')
    try{
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const headers: any = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(`${apiBase}/maintenances/${id}/pdf`, { headers })
      if (!res.ok) throw new Error('Gagal memuat PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
    } catch(e){ console.error(e); toast.error('Gagal memuat pratinjau') }
    finally { setPreviewLoading(false) }
  }

  function closePreview(){
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(''); setPreviewId(null)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Persetujuan Maintenance</h2>
      {loading ? <SkeletonTable rows={5} cols={5} /> : (
        <div className="tbl-wrap">
        <table className="tbl bg-white rounded shadow text-sm">
          <thead>
            <tr>
              <th>Judul</th>
              <th>Tanggal</th>
              <th>Diajukan Oleh</th>
              <th className="col-actions">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td className="p-4 text-center text-gray-500" colSpan={4}>Tidak ada permintaan</td></tr>
            )}
            {items.map(it => (
              <tr key={it.id} className="border-t">
                <td className="p-2">{it.title}</td>
                <td className="p-2">{new Date(it.date).toLocaleDateString()}</td>
                <td className="p-2">{it.submittedBy ?? '-'}</td>
                <td className="p-2">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <button className="px-3 py-1 rounded bg-gray-700 text-white" onClick={()=>openPreview(it.id)}>Preview</button>
                    <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={()=>act(it.id,'approve')}>Setujui</button>
                    <button className="px-3 py-1 rounded bg-red-600 text-white" onClick={()=>act(it.id,'reject')}>Tolak</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {previewId !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-5xl h-[85vh] rounded shadow-lg flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold">Pratinjau Maintenance #{previewId}</h3>
              <div className="space-x-2">
                <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={()=>{ const id=previewId!; closePreview(); act(id,'approve') }}>Setujui</button>
                <button className="px-3 py-1 rounded bg-red-600 text-white" onClick={()=>{ const id=previewId!; closePreview(); act(id,'reject') }}>Tolak</button>
                <button className="px-3 py-1 rounded bg-gray-200" onClick={closePreview}>Tutup</button>
              </div>
            </div>
            <div className="flex-1">
              {previewLoading ? (
                <div className="h-full flex items-center justify-center">Memuat...</div>
              ) : previewUrl ? (
                <iframe title="preview" src={previewUrl} className="w-full h-full" />
              ) : (
                <div className="h-full flex items-center justify-center">Gagal memuat pratinjau</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
