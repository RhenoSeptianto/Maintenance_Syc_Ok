"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { apiBase, authHeaders } from '@/lib/api'
import { useToast } from '@/components/Toast'
import { SkeletonTable } from '@/components/Skeleton'

type Store = { id: number; code: string; name: string; location?: string; tsAssigned?: string }
type User = { id:number; username:string; role:string }

export default function AdminStorePage() {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Store | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [tsAssigned, setTsAssigned] = useState('')
  const [tsList, setTsList] = useState<User[]>([])
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({})
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [importOpen, setImportOpen] = useState(false)
  const [importCsvText, setImportCsvText] = useState('')
  const [importCreateUsers, setImportCreateUsers] = useState(true)
  const [importDefaultPw, setImportDefaultPw] = useState('pass123')
  const [importDefaultRole, setImportDefaultRole] = useState<'admin'|'user'|'ts'>('user')
  const pageSize = 10
  const toast = useToast()

  const filteredStores = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return stores
    return stores.filter(s =>
      (s.code || '').toLowerCase().includes(q) ||
      (s.name || '').toLowerCase().includes(q) ||
      (s.location || '').toLowerCase().includes(q) ||
      (s.tsAssigned || '').toLowerCase().includes(q)
    )
  }, [stores, search])
  const total = filteredStores.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const rows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredStores.slice(start, start + pageSize)
  }, [filteredStores, page])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/stores`, { headers: authHeaders() })
      if (!res.ok) throw new Error('Gagal memuat store')
      const json = await res.json()
      setStores(json || [])
      const users = await fetch(`${apiBase}/users`, { headers: authHeaders() }).then(r=>r.json())
      setTsList((users||[]).filter((u:User)=> (String(u.role||'').toLowerCase()==='user' || String(u.role||'').toLowerCase()==='ts')))
    } catch (e) {
      console.error(e)
      toast.error('Gagal memuat data store')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function downloadCsv(path: string, filename: string){
    try {
      const res = await fetch(`${apiBase}${path}`, { headers: authHeaders() })
      if (!res.ok) throw new Error('Gagal unduh CSV')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url)
    } catch(e){ console.error(e); toast.error('Gagal mengunduh CSV') }
  }

  async function onImportCsv(){
    if (!importCsvText.trim()) { toast.error('CSV kosong'); return }
    if ((importCreateUsers && String(importDefaultPw||'').length < 3)) { toast.error('Default Password minimal 3 karakter'); return }
    try {
      const payload = {
        csv: importCsvText,
        createUsers: importCreateUsers,
        defaultPassword: importDefaultPw,
        defaultRole: importDefaultRole,
        upsert: true,
      }
      const res = await fetch(`${apiBase}/stores/import`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) })
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      toast.success(`Import selesai. Baru: ${json.created}, Update: ${json.updated}, User baru: ${json.usersCreated}`)
      setImportOpen(false); setImportCsvText('')
      await load()
    } catch (e:any) {
      console.error(e)
      toast.error('Import gagal. Periksa format CSV.')
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => setImportCsvText(String(reader.result || ''))
    reader.readAsText(f)
  }

  function startAdd() {
    setEditing(null); setShowForm(true); setCode(''); setName(''); setLocation(''); setTsAssigned('')
    setErrors({})
  }

  function startEdit(s: Store) {
    setEditing(s); setShowForm(true); setCode(s.code); setName(s.name); setLocation(s.location || ''); setTsAssigned(s.tsAssigned || '')
    setErrors({})
  }

  function validate(currentCode: string, currentName: string){
    const errs: any = {}
    const c = (currentCode||'').trim()
    if (!c) errs.code = 'Kode wajib diisi'
    const exists = stores.some(s => s.code.toLowerCase() === c.toLowerCase() && (!editing || s.id !== editing.id))
    if (c && exists) errs.code = 'Kode/store sudah ada'
    return errs as { code?: string; name?: string }
  }

  async function save() {
    try {
      const codeTrim = code.trim()
      if (!codeTrim) { alert('Kode wajib diisi'); return }
      const exists = stores.some(s => s.code.toLowerCase() === codeTrim.toLowerCase() && (!editing || s.id !== editing.id))
      if (exists) { alert('Kode/store sudah ada'); return }
      if (editing) {
        const res = await fetch(`${apiBase}/stores/${editing.id}`, {
          method: 'PUT', headers: authHeaders(), body: JSON.stringify({ code: codeTrim, name, location, tsAssigned: tsAssigned || null })
        })
        if (!res.ok) {
          const txt = await res.text()
          if (res.status === 409 || /exists/i.test(txt)) throw new Error('DUP')
          throw new Error('Gagal update')
        }
      } else {
        const res = await fetch(`${apiBase}/stores`, {
          method: 'POST', headers: authHeaders(), body: JSON.stringify({ code: codeTrim, name, location, tsAssigned: tsAssigned || null })
        })
        if (!res.ok) {
          const txt = await res.text()
          if (res.status === 409 || /exists/i.test(txt)) throw new Error('DUP')
          throw new Error('Gagal create')
        }
      }
      await load()
      setEditing(null); setShowForm(false); setCode(''); setName(''); setLocation(''); setTsAssigned('')
      toast.success('Store disimpan')
    } catch (e:any) {
      console.error(e)
      if (String(e?.message) === 'DUP') toast.error('Kode/store sudah ada, gunakan kode lain')
      else toast.error('Gagal menyimpan store')
    }
  }

  async function remove(id: number) {
    if (!confirm('Hapus store ini?')) return
    try {
      const res = await fetch(`${apiBase}/stores/${id}`, { method: 'DELETE', headers: authHeaders() })
      if (!res.ok) throw new Error('Gagal hapus')
      await load(); toast.success('Store dihapus')
    } catch (e) { console.error(e); toast.error('Gagal menghapus store') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Manajemen Store</h2>
        <div className="flex gap-2">
          <button
            className="px-3 py-2 bg-emerald-600 text-white rounded"
            onClick={() => downloadCsv('/stores/export-template', 'stores_template.csv')}
          >Export Template</button>
          <button
            className="px-3 py-2 bg-indigo-600 text-white rounded"
            onClick={() => downloadCsv('/stores/export', 'stores_export.csv')}
          >Export Data</button>
          <button
            className="px-3 py-2 bg-orange-600 text-white rounded"
            onClick={() => setImportOpen(true)}
          >Import CSV</button>
          <button
            className="px-3 py-2 bg-blue-600 text-white rounded flex items-center justify-center"
            style={{ width: 36 }}
            title="Tambah Store"
            aria-label="Tambah Store"
            onClick={startAdd}
          >➕</button>
        </div>
      </div>

      <div className="p-4 bg-white rounded shadow">
        <div className="flex items-center justify-between mb-3">
          <input className="border rounded px-3 py-2 w-64" placeholder="Cari kode/nama/lokasi/TS..." value={search} onChange={e=>{ setSearch(e.target.value); setPage(1) }} />
          <div className="text-sm text-gray-500">Total: {stores.length}</div>
        </div>
        {showForm ? (
          <div className="space-y-3">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600">Kode</label>
                <input
                  className={`w-full border rounded px-2 py-1 ${errors.code? 'border-red-500' : ''}`}
                  placeholder="Mis. STORE001"
                  value={code}
                  onChange={e=>{
                    const v = e.target.value.toUpperCase().replace(/\s+/g,'')
                    setCode(v)
                    setErrors(validate(v, name))
                  }}
                  onBlur={()=>setErrors(validate(code, name))}
                  required
                />
                {errors.code? <div className="text-xs text-red-600 mt-1">{errors.code}</div> : <div className="text-xs text-gray-500 mt-1">Harus unik, gunakan huruf/angka tanpa spasi</div>}
              </div>
              <div>
                <label className="block text-sm text-gray-600">Nama</label>
                <input className="w-full border rounded px-2 py-1" value={name} onChange={e=>setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Lokasi</label>
                <select className="w-full border rounded px-2 py-1" value={location} onChange={e=>setLocation(e.target.value)}>
                  <option value="">-</option>
                  <option value="Jabodetabek">Jabodetabek</option>
                  <option value="Luar Jabodetabek">Luar Jabodetabek</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600">Assign ke TS</label>
                <select className="w-full border rounded px-2 py-1" value={tsAssigned} onChange={e=>setTsAssigned(e.target.value)}>
                  <option value="">-</option>
                  {tsList.map(ts => (
                    <option key={ts.id} value={ts.username}>{ts.username}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-2 bg-green-600 text-white rounded disabled:opacity-50" onClick={save} disabled={!!errors.code}>Simpan</button>
              <button className="px-3 py-2 bg-gray-200 rounded" onClick={()=>{ setEditing(null); setShowForm(false); setCode(''); setName(''); setLocation(''); setTsAssigned(''); setErrors({}) }}>Batal</button>
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          {importOpen && (
            <div className="mb-4 p-4 border rounded bg-slate-50">
              <div className="mb-2 font-semibold">Import CSV Stores</div>
              <div className="text-sm text-gray-600 mb-2">Header yang didukung: <code>code,name,location,tsAssigned,role,password</code>. Wajib: <code>code,name</code>. Jika <code>createUsers</code> aktif, user pada kolom <code>tsAssigned</code> akan dibuat bila belum ada (role/password bisa diisi per baris atau pakai default).</div>
              <div className="flex gap-3 items-center mb-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={importCreateUsers} onChange={e=>setImportCreateUsers(e.target.checked)} /> Buat user otomatis (tsAssigned)
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  Default Password: <input className="border rounded px-2 py-1" value={importDefaultPw} onChange={e=>setImportDefaultPw(e.target.value)} />
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  Default Role: 
                  <select className="border rounded px-2 py-1" value={importDefaultRole} onChange={e=>setImportDefaultRole(e.target.value as any)}>
                    <option value="user">user</option>
                    <option value="ts">ts</option>
                    <option value="admin">admin</option>
                  </select>
                </label>
                <a className="text-blue-600 underline text-sm" href="#" onClick={(e)=>{ e.preventDefault(); downloadCsv('/stores/export-template','stores_template.csv') }}>Unduh Template</a>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <textarea className="w-full h-40 border rounded p-2 font-mono text-sm" placeholder="Tempel CSV di sini atau pilih file di kanan..." value={importCsvText} onChange={e=>setImportCsvText(e.target.value)} />
                <div className="space-y-2 text-sm text-gray-700">
                  <div className="font-semibold">Contoh:</div>
                  <pre className="bg-white border rounded p-2 overflow-auto">
{`code,name,location,tsAssigned,role,password
ST001,Store One,Jakarta,ts_alfa,user,pass123
ST002,Store Two,Bandung,ts_bravo,user,pass123
ST003,HO Office,Jakarta,admin,admin,Admin!234`}
                  </pre>
                  <div>
                    <label className="inline-flex items-center gap-2">
                      <span>atau pilih file CSV:</span>
                      <input type="file" accept=".csv,text/csv" onChange={onPickFile} />
                    </label>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="px-3 py-2 bg-orange-600 text-white rounded" onClick={onImportCsv}>Import</button>
                <button className="px-3 py-2 bg-gray-200 rounded" onClick={()=>{ setImportOpen(false); setImportCsvText('') }}>Tutup</button>
              </div>
            </div>
          )}

          {loading ? <SkeletonTable rows={6} cols={6} /> : (
            <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Kode</th><th>Nama</th><th>Lokasi</th><th>TS</th><th className="col-actions">Aksi</th></tr>
              </thead>
              <tbody>
                {rows.map(s => (
                  <tr key={s.id} className="border-t">
                    <td className="py-2 text-sm">{s.code}</td>
                    <td className="py-2">{s.name}</td>
                    <td className="py-2">{s.location ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${s.location==='Jabodetabek' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>{s.location}</span>
                    ) : '-'}</td>
                    <td className="py-2">
                      <select className="border rounded px-2 py-1" value={s.tsAssigned ?? ''} onChange={async e=>{
                        const v = e.target.value || null
                        await fetch(`${apiBase}/stores/${s.id}`, { method:'PUT', headers: authHeaders(), body: JSON.stringify({ tsAssigned: v }) })
                        await load(); toast.success('TS diperbarui')
                      }}>
                        <option value="">-</option>
                        {tsList.map(ts => (
                          <option key={ts.id} value={ts.username}>{ts.username}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2">
                      <button
                        className="mr-2 px-2 py-1 bg-yellow-400 rounded flex items-center justify-center"
                        style={{ width: 36 }}
                        title="Edit"
                        aria-label="Edit"
                        onClick={()=>startEdit(s)}
                      >✏️</button>
                      <button
                        className="px-2 py-1 bg-red-500 text-white rounded flex items-center justify-center"
                        style={{ width: 36 }}
                        title="Hapus"
                        aria-label="Hapus"
                        onClick={()=>remove(s.id)}
                      >🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
          {!loading && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <div>Halaman {page} dari {totalPages}</div>
              <div className="space-x-2">
                <button className="px-2 py-1 border rounded" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Prev</button>
                <button className="px-2 py-1 border rounded" disabled={(page*pageSize)>= total} onClick={()=>setPage(p=>p+1)}>Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
