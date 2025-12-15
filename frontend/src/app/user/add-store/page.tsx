"use client"

import React, { useEffect, useState } from 'react'
import { apiBase, authHeaders } from '@/lib/api'

type Store = { id:number; code:string; name:string; location?:string; tsAssigned?:string }

export default function UserAddStorePage(){
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [code,setCode] = useState('')
  const [name,setName] = useState('')
  const [location,setLocation] = useState('')
  const [saving,setSaving] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importCsvText, setImportCsvText] = useState('')

  const me = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user')||'{}') : {}

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/stores`, { headers: authHeaders() })
      const json = await res.json()
      const mine = (json||[]).filter((s:Store)=> (s.tsAssigned||'') === (me?.username||''))
      setStores(mine)
    } catch(e){ console.error(e) } finally { setLoading(false) }
  }

  useEffect(()=>{ load() }, [])

  function downloadTemplate(){
    // Template sederhana untuk user: hanya kolom yang bisa diisi user sendiri
    const header = 'code,name,location\n'
    const example = 'ST001,Store Contoh,Jabodetabek\n'
    const csv = header + example
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'store_template_user.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function normalizeCsvForUser(raw: string, username: string): string {
    const text = (raw || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const lines = text.split('\n').filter(l => l.trim().length > 0)
    if (lines.length === 0) return 'code,name,location,tsAssigned\n'
    const header = lines[0].split(',').map(h => h.trim())
    const hasTs = header.some(h => h.toLowerCase() === 'tsassigned')
    const out: string[] = []
    if (!hasTs) {
      out.push([...header, 'tsAssigned'].join(','))
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i]
        if (!row.trim()) continue
        out.push(row + ',' + username)
      }
    } else {
      out.push(lines[0])
      const idx = header.findIndex(h => h.toLowerCase() === 'tsassigned')
      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(',')
        if (cells.length === 0 || !lines[i].trim()) continue
        if (!cells[idx] || cells[idx].trim() === '') cells[idx] = username
        out.push(cells.join(','))
      }
    }
    return out.join('\n') + '\n'
  }

  async function importCsv(){
    const meUser = String(me?.username || '')
    if (!meUser) { alert('Tidak dapat mengidentifikasi pengguna'); return }
    if (!importCsvText.trim()) { alert('CSV kosong'); return }
    try {
      const normalized = normalizeCsvForUser(importCsvText, meUser)
      const payload = { csv: normalized, createUsers: false, upsert: true }
      const res = await fetch(`${apiBase}/stores/import`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) })
      if (!res.ok) throw new Error(await res.text())
      setImportOpen(false); setImportCsvText('')
      await load()
      alert('Import selesai')
    } catch (e) {
      console.error(e)
      alert('Import gagal. Periksa format CSV.')
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      const txt = String(reader.result || '')
      setImportCsvText(txt)
    }
    reader.readAsText(f)
  }

  async function submit(e:React.FormEvent){
    e.preventDefault(); setSaving(true)
    try{
      const res = await fetch(`${apiBase}/stores`,{
        method:'POST',
        headers: authHeaders(),
        body: JSON.stringify({ code, name, location, tsAssigned: me?.username || null })
      })
      if(!res.ok){
        const t = await res.text(); throw new Error(t||'Gagal simpan')
      }
      const created = await res.json()
      setStores(prev => [...prev, created])
      setCode(''); setName(''); setLocation('')
      setShowForm(false)
    } catch(e){ console.error(e); alert('Gagal menambah toko') } finally { setSaving(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Store Saya</h2>
        <div className="flex gap-2">
          <button className="px-3 py-2 bg-indigo-600 text-white rounded" onClick={downloadTemplate}>
            Download Template
          </button>
          <button className="px-3 py-2 bg-orange-600 text-white rounded" onClick={()=> setImportOpen(true)}>
            Import CSV
          </button>
          <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={()=>setShowForm(s=>!s)}>
            {showForm ? 'Tutup' : 'Tambah Store'}
          </button>
        </div>
      </div>

      {importOpen && (
        <div className="max-w-3xl bg-white p-6 rounded shadow">
          <h3 className="text-base font-semibold mb-2">Import CSV Store</h3>
          <div className="text-sm text-gray-600 mb-3">Header minimal: <code>code,name</code>. Kolom lain opsional (<code>location</code>, <code>tsAssigned</code>). Jika kolom <code>tsAssigned</code> kosong/kurang, otomatis diisi username kamu.</div>
          <div className="grid md:grid-cols-2 gap-3">
            <textarea className="w-full h-40 border rounded p-2 font-mono text-sm" placeholder="Tempel CSV di sini..." value={importCsvText} onChange={e=>setImportCsvText(e.target.value)} />
            <div className="space-y-2 text-sm text-gray-700">
              <div className="font-semibold">Contoh:</div>
              <pre className="bg-slate-50 border rounded p-2 overflow-auto">{`code,name,location
ST100,Store Satu,Jabodetabek
ST200,Store Dua,Bandung`}</pre>
              <div>
                <label className="inline-flex items-center gap-2">
                  <span className="text-sm">atau pilih file CSV:</span>
                  <input type="file" accept=".csv,text/csv" onChange={onPickFile} />
                </label>
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="px-3 py-2 bg-orange-600 text-white rounded" onClick={importCsv}>Import</button>
            <button className="px-3 py-2 bg-gray-200 rounded" onClick={()=>{ setImportOpen(false); setImportCsvText('') }}>Tutup</button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="max-w-md bg-white p-6 rounded shadow">
          <h3 className="text-base font-semibold mb-4">Tambah Store</h3>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Kode Store</label>
              <input className="w-full border rounded px-3 py-2" value={code} onChange={e=>setCode(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm mb-1">Nama</label>
              <input className="w-full border rounded px-3 py-2" value={name} onChange={e=>setName(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm mb-1">Lokasi</label>
              <select className="w-full border rounded px-3 py-2" value={location} onChange={e=>setLocation(e.target.value)}>
                <option value="">-</option>
                <option value="Jabodetabek">Jabodetabek</option>
                <option value="Luar Jabodetabek">Luar Jabodetabek</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded">{saving?'Menyimpan...':'Simpan'}</button>
              <button type="button" className="px-4 py-2 bg-gray-200 rounded" onClick={()=>{ setShowForm(false); setCode(''); setName(''); setLocation('') }}>Batal</button>
            </div>
          </form>
        </div>
      )}

          <div className="p-4 bg-white rounded shadow">
            {loading ? (
              <div>Memuat...</div>
            ) : stores.length === 0 ? (
              <div className="text-sm text-gray-600">Belum ada store. Klik "Tambah Store" untuk menambahkan.</div>
            ) : (
              <table className="w-full text-left">
            <thead>
              <tr className="text-sm text-gray-500">
                <th className="pb-2">Kode</th>
                <th className="pb-2">Nama</th>
                <th className="pb-2">Lokasi</th>
              </tr>
            </thead>
            <tbody>
              {stores.map(s=> (
                <tr key={s.id} className="border-t">
                  <td className="py-2 text-sm">{s.code}</td>
                  <td className="py-2">{s.name}</td>
                  <td className="py-2">{s.location || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
