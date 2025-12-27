"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { apiBase, authHeaders } from '@/lib/api'
import { useToast } from '@/components/Toast'
import { SkeletonTable } from '@/components/Skeleton'
import { useConfirm } from '@/components/Confirm'

type ColumnMeta = {
  key: string
  label: string
  type: 'string' | 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'enum'
  readonly?: boolean
  required?: boolean
  nullable?: boolean
  options?: string[]
  writeOnly?: boolean
  helperText?: string
}
type TableMeta = {
  name: string
  label: string
  primaryKey: string
  columns: ColumnMeta[]
}
type ListResponse = {
  data: Record<string, any>[]
  total: number
  page: number
  pageSize: number
}

function formatValue(val: any, col: ColumnMeta) {
  if (val === null || val === undefined || val === '') return '-'
  if (col.type === 'boolean') {
    const v = typeof val === 'string' ? val.toLowerCase() : val
    const truthy = v === true || v === 'true' || v === '1' || v === 1
    return truthy ? 'Ya' : 'Tidak'
  }
  if (col.type === 'date') return String(val).slice(0, 10)
  if (col.type === 'datetime') {
    const d = new Date(val)
    if (isNaN(d.getTime())) return String(val)
    return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
  }
  if (typeof val === 'string' && val.length > 80) return val.slice(0, 77) + '...'
  return String(val)
}

function toInputValue(col: ColumnMeta, raw: any) {
  if (raw === null || raw === undefined) return ''
  if (col.type === 'date') return String(raw).slice(0, 10)
  if (col.type === 'datetime') {
    const d = new Date(raw)
    if (isNaN(d.getTime())) return ''
    const iso = d.toISOString()
    return iso.slice(0, 16)
  }
  return String(raw)
}

function buildPayload(table: TableMeta, form: Record<string, any>, isUpdate: boolean) {
  const payload: Record<string, any> = {}
  for (const col of table.columns) {
    if (col.readonly) continue
    if (!(col.key in form)) {
      if (!isUpdate && col.required) throw new Error(`Field ${col.label} wajib diisi`)
      continue
    }
    let val = form[col.key]
    const isEmpty = val === '' || val === undefined
    if (isEmpty) {
      if (col.nullable) { payload[col.key] = null; continue }
      if (col.required) throw new Error(`Field ${col.label} wajib diisi`)
      continue
    }
    if (val === null) {
      if (!col.nullable && col.required) throw new Error(`Field ${col.label} wajib diisi`)
      payload[col.key] = val
      continue
    }
    switch (col.type) {
      case 'number':
        if (val === null) { payload[col.key] = null; break }
        const n = Number(val)
        if (isNaN(n)) throw new Error(`${col.label} harus berupa angka`)
        payload[col.key] = n
        break
      case 'boolean':
        payload[col.key] = val === true || val === 'true' || val === '1' || val === 1
        break
      case 'date':
      case 'datetime':
        payload[col.key] = val
        break
      default:
        payload[col.key] = val
    }
  }
  return payload
}

export default function AdminDbPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const [tables, setTables] = useState<TableMeta[]>([])
  const [selected, setSelected] = useState<string>('')
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Record<string, any> | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [rebuildStoreId, setRebuildStoreId] = useState<string>('')
  const [rebuildFromDate, setRebuildFromDate] = useState<string>('')
  const [rebuildToDate, setRebuildToDate] = useState<string>('')
  const [rebuildDryRun, setRebuildDryRun] = useState<boolean>(true)
  const [rebuilding, setRebuilding] = useState(false)
  const [rebuildResult, setRebuildResult] = useState<string>('')

  const currentTable = useMemo(() => tables.find(t => t.name === selected) || null, [tables, selected])
  const visibleColumns = useMemo(() => (currentTable?.columns || []).filter(c => !c.writeOnly), [currentTable])
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  useEffect(() => {
    loadTables()
  }, [])

  useEffect(() => {
    if (currentTable) {
      fetchRows(1, pageSize, search)
      setPage(1)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  async function loadTables() {
    try {
      const res = await fetch(`${apiBase}/db-admin/tables`, { headers: authHeaders() })
      if (!res.ok) throw new Error('Gagal memuat tabel')
      const json = await res.json()
      const list = json?.tables || []
      setTables(list)
      if (!selected && list.length > 0) setSelected(list[0].name)
    } catch (e) {
      console.error(e)
      toast.error('Tidak bisa memuat metadata DB')
    }
  }

  async function fetchRows(nextPage = page, ps = pageSize, q = search) {
    if (!currentTable) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(nextPage), pageSize: String(ps) })
      if (q) params.set('search', q)
      const res = await fetch(`${apiBase}/db-admin/${currentTable.name}?${params.toString()}`, { headers: authHeaders() })
      if (!res.ok) throw new Error(await res.text())
      const json: ListResponse = await res.json()
      setRows(json.data || [])
      setTotal(Number(json.total || 0))
      setPage(Number(json.page || nextPage))
      setPageSize(Number(json.pageSize || ps))
      setSearch(q || '')
    } catch (e: any) {
      console.error(e)
      toast.error('Gagal memuat data tabel')
    } finally {
      setLoading(false)
    }
  }

  function startAdd() {
    setEditing(null)
    setFormData({})
    setFormOpen(true)
  }

  function startEdit(row: Record<string, any>) {
    const next: Record<string, any> = { ...row }
    // kosongkan field writeOnly agar tidak menampilkan data sensitif
    currentTable?.columns.filter(c => c.writeOnly).forEach(c => { next[c.key] = '' })
    setEditing(row)
    setFormData(next)
    setFormOpen(true)
  }

  async function save() {
    if (!currentTable) return
    try {
      const payload = buildPayload(currentTable, formData, !!editing)
      setSaving(true)
      const pk = currentTable.primaryKey
      const url = `${apiBase}/db-admin/${currentTable.name}${editing ? `/${editing?.[pk]}` : ''}`
      const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(payload) })
      if (!res.ok) throw new Error(await res.text())
      toast.success(editing ? 'Data berhasil diperbarui' : 'Data berhasil ditambahkan')
      setFormOpen(false)
      setEditing(null)
      setFormData({})
      await fetchRows(editing ? page : 1, pageSize, search)
      if (!editing) setPage(1)
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || 'Gagal menyimpan data')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row: Record<string, any>) {
    if (!currentTable) return
    const pk = currentTable.primaryKey
    const id = row[pk]
    const ok = await confirm({ title: 'Hapus data?', message: `Data ${pk}=${id} akan dihapus permanen.` })
    if (!ok) return
    setDeletingId(id)
    try {
      const res = await fetch(`${apiBase}/db-admin/${currentTable.name}/${id}`, { method: 'DELETE', headers: authHeaders() })
      if (!res.ok) throw new Error(await res.text())
      toast.success('Data dihapus')
      await fetchRows(Math.max(1, page))
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || 'Gagal menghapus data')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleRebuildAssets() {
    try {
      setRebuilding(true)
      setRebuildResult('')
      const body: any = {
        dryRun: rebuildDryRun,
      }
      if (rebuildStoreId.trim()) {
        const sid = Number(rebuildStoreId.trim())
        if (!Number.isFinite(sid) || sid <= 0) {
          toast.error('Store ID harus berupa angka positif')
          setRebuilding(false)
          return
        }
        body.storeId = sid
      }
      if (rebuildFromDate) body.fromDate = rebuildFromDate
      if (rebuildToDate) body.toDate = rebuildToDate
      const res = await fetch(`${apiBase}/db-admin/maintenance/rebuild-assets`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      const text = await res.text()
      if (!res.ok) {
        toast.error(text || 'Gagal menjalankan rebuild assets')
        return
      }
      setRebuildResult(text)
      toast.success(rebuildDryRun ? 'Dry-run rebuild selesai' : 'Rebuild assets selesai')
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || 'Gagal menjalankan rebuild assets')
    } finally {
      setRebuilding(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-white rounded shadow-sm border border-slate-200">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="px-2 py-1 rounded bg-orange-100 text-orange-700 font-semibold text-xs">Admin DB</span>
              <span>Ubah data langsung dari database yang diizinkan.</span>
            </div>
            <p className="text-sm text-slate-500 mt-1">Gunakan dengan hati-hati. Perubahan disimpan langsung ke DB.</p>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-2 bg-white border rounded shadow-sm hover:bg-slate-50" onClick={()=>fetchRows(page, pageSize, search)}>Refresh</button>
            <button className="px-3 py-2 bg-blue-600 text-white rounded shadow-sm hover:brightness-110" onClick={startAdd}>Tambah data</button>
          </div>
        </div>
        <div className="mt-4 p-3 border border-dashed border-amber-300 rounded bg-amber-50">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1 grid md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Store ID (opsional)</label>
                <input
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="Kosongkan untuk semua store"
                  value={rebuildStoreId}
                  onChange={e => setRebuildStoreId(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Dari tanggal (opsional)</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={rebuildFromDate}
                  onChange={e => setRebuildFromDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Sampai tanggal (opsional)</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={rebuildToDate}
                  onChange={e => setRebuildToDate(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 mt-5 md:mt-6">
                <input
                  id="rebuild-dryrun"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={rebuildDryRun}
                  onChange={e => setRebuildDryRun(e.target.checked)}
                />
                <label htmlFor="rebuild-dryrun" className="text-xs text-slate-700 select-none">Dry run saja (tanpa ubah data)</label>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRebuildAssets}
                disabled={rebuilding}
                className="px-3 py-2 bg-amber-600 text-white rounded shadow-sm hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
              >
                {rebuilding ? 'Memproses...' : 'Rebuild Assets dari Maintenance'}
              </button>
            </div>
          </div>
          {rebuildResult && (
            <pre className="mt-3 max-h-40 overflow-auto text-xs bg-white border border-amber-200 rounded p-2 text-slate-700 whitespace-pre-wrap">
              {rebuildResult}
            </pre>
          )}
        </div>
        <div className="mt-3 grid md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Pilih tabel</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={selected}
              onChange={e => setSelected(e.target.value)}
            >
              {tables.map(t => <option key={t.name} value={t.name}>{t.label} ({t.name})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Cari</label>
            <div className="flex gap-2">
              <input className="border rounded px-3 py-2 w-full" placeholder="Cari nilai kolom..." value={searchInput} onChange={e=>setSearchInput(e.target.value)} />
              <button className="px-3 py-2 border rounded bg-white hover:bg-slate-50" onClick={()=>fetchRows(1, pageSize, searchInput)}>Go</button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Page size</label>
            <select className="border rounded px-3 py-2 w-32" value={String(pageSize)} onChange={e=>{ const ps = Number(e.target.value)||20; setPageSize(ps); fetchRows(1, ps, search) }}>
              {[10,20,50,100].map(v => <option key={v} value={v}>{v} baris</option>)}
            </select>
          </div>
        </div>
      </div>

      {formOpen && currentTable && (
        <div className="p-4 bg-white rounded shadow-sm border border-slate-200 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-base font-semibold">{editing ? 'Edit data' : 'Tambah data'} - {currentTable.label}</div>
              <div className="text-xs text-slate-500">Kolom wajib ditandai * dan disimpan langsung ke DB</div>
            </div>
            <button className="px-3 py-2 bg-gray-100 rounded border" onClick={()=>{ setFormOpen(false); setEditing(null); setFormData({}) }}>Tutup</button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {currentTable.columns.map(col => (
              <div key={col.key} className={col.readonly ? 'opacity-80' : ''}>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {col.label}{col.required && !col.readonly ? ' *' : ''}
                </label>
                {col.readonly ? (
                  <div className="px-3 py-2 border rounded bg-slate-50 text-sm">{formatValue(formData[col.key] ?? editing?.[col.key], col)}</div>
                ) : col.type === 'text' ? (
                  <textarea
                    className="w-full border rounded px-3 py-2 min-h-[120px]"
                    value={String(formData[col.key] ?? '')}
                    onChange={e=>setFormData(prev => ({ ...prev, [col.key]: e.target.value }))}
                  />
                ) : col.type === 'boolean' ? (
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={String(formData[col.key] ?? '')}
                    onChange={e=>setFormData(prev => ({ ...prev, [col.key]: e.target.value }))}
                  >
                    <option value="">-</option>
                    <option value="true">Ya</option>
                    <option value="false">Tidak</option>
                  </select>
                ) : col.type === 'enum' ? (
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={String(formData[col.key] ?? '')}
                    onChange={e=>setFormData(prev => ({ ...prev, [col.key]: e.target.value }))}
                  >
                    <option value="">-</option>
                    {(col.options || []).map(String).concat(
                      (() => {
                        const curr = formData[col.key]
                        if (curr === undefined || curr === null || curr === '') return []
                        const curStr = String(curr)
                        return (col.options || []).map(String).includes(curStr) ? [] : [curStr]
                      })()
                    ).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input
                    className="w-full border rounded px-3 py-2"
                    type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : col.type === 'datetime' ? 'datetime-local' : 'text'}
                    value={toInputValue(col, formData[col.key])}
                    onChange={e=>setFormData(prev => ({ ...prev, [col.key]: e.target.value }))}
                    placeholder={col.helperText}
                  />
                )}
                {col.helperText && <div className="text-[11px] text-slate-500 mt-1">{col.helperText}</div>}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 bg-emerald-600 text-white rounded shadow disabled:opacity-60"
              onClick={save}
              disabled={saving}
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button className="px-4 py-2 bg-gray-200 rounded" onClick={()=>{ setFormOpen(false); setEditing(null); setFormData({}) }}>Batal</button>
          </div>
        </div>
      )}

      <div className="p-4 bg-white rounded shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-3 text-sm text-slate-600 flex-wrap gap-2">
          <div className="font-semibold text-slate-800">{currentTable?.label || 'Tabel'} ({total} data)</div>
          <div className="flex gap-2 items-center text-xs">
            <span>Halaman {page} / {totalPages}</span>
            <button className="px-2 py-1 border rounded disabled:opacity-50" disabled={page<=1} onClick={()=>{ const p=Math.max(1,page-1); setPage(p); fetchRows(p, pageSize, search) }}>Prev</button>
            <button className="px-2 py-1 border rounded disabled:opacity-50" disabled={page>=totalPages} onClick={()=>{ const p=Math.min(totalPages,page+1); setPage(p); fetchRows(p, pageSize, search) }}>Next</button>
          </div>
        </div>

        {loading ? <SkeletonTable rows={5} cols={(visibleColumns.length || 3) + 1} /> : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  {visibleColumns.map(col => <th key={col.key}>{col.label}</th>)}
                  <th className="col-actions">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const rowKey = row[currentTable?.primaryKey || 'id'] ?? idx
                  return (
                    <tr key={rowKey}>
                      {visibleColumns.map(col => (
                        <td key={col.key} className="text-sm align-top">
                          <div title={row[col.key] == null ? '' : String(row[col.key])}>{formatValue(row[col.key], col)}</div>
                        </td>
                      ))}
                      <td className="py-2">
                        <div className="flex gap-2">
                          <button className="px-3 py-1 bg-yellow-400 rounded text-sm" onClick={()=>startEdit(row)}>Edit</button>
                          <button
                            className="px-3 py-1 bg-rose-600 text-white rounded text-sm disabled:opacity-50"
                            onClick={()=>handleDelete(row)}
                            disabled={deletingId === row[currentTable?.primaryKey || 'id']}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={(visibleColumns.length || 1) + 1} className="text-center text-sm text-slate-500 py-6">Data kosong</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
