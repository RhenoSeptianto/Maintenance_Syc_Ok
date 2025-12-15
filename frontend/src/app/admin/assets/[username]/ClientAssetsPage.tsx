"use client"

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { authHeaders, fetchJson, apiBase } from '@/lib/api'

type Asset = {
  id: number
  name: string
  category?: string | null
  serialNumber?: string | null
  status?: string
  ageMonths?: number | null
  isOld?: boolean
  lastMaintenanceDate?: string | null
  lastHistoryDate?: string | null
  lastHistoryNote?: string | null
}

type AssetHistoryItem = { id: number; date: string; note: string; createdBy?: string | null }

function fmtAge(m: number | null | undefined) {
  if (m == null) return '-'
  const y = Math.floor(m / 12)
  const mo = m % 12
  return y > 0 ? `${y} th ${mo} bl` : `${mo} bl`
}

const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  const s = String(status || '').toLowerCase()
  if (s === 'in_repair' || s === 'tidak') return <span className="text-red-600 font-semibold">Tidak</span>
  if (s === 'active' || s === 'baik') return <span className="text-green-700 font-semibold">Baik</span>
  return <span>-</span>
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export default function ClientAssetsByUserPage() {
  const route = useParams() as any
  const username = decodeURIComponent(String(route?.username || ''))

  const [stores, setStores] = useState<any[]>([])
  const [assetCounts, setAssetCounts] = useState<Record<number, number>>({})
  const [selStoreId, setSelStoreId] = useState<number | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [q, setQ] = useState('')
  const [oldOnly, setOldOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [ageInput, setAgeInput] = useState<string>('')
  const [historyAsset, setHistoryAsset] = useState<Asset | null>(null)
  const [historyDate, setHistoryDate] = useState<string>('')
  const [historyNote, setHistoryNote] = useState<string>('')
  const [viewHistoryAsset, setViewHistoryAsset] = useState<Asset | null>(null)
  const [historyItems, setHistoryItems] = useState<AssetHistoryItem[]>([])
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        setError('')
        const headers = authHeaders()
        const allStores = await fetchJson('/stores', { headers })
        const uname = (username || '').toLowerCase().trim()
        const mine = (allStores || []).filter((s: any) => String(s.tsAssigned || '').toLowerCase().trim() === uname)
        setStores(mine)
        if (!selStoreId && mine.length > 0) setSelStoreId(mine[0].id)
        const ids = mine.map((s: any) => s.id).join(',')
        const counts = ids ? await fetchJson(`/assets/counts?storeIds=${ids}`, { headers }) : {}
        const mapped: Record<number, number> = {}
        for (const s of mine) mapped[s.id] = Number((counts as any)[s.id] || 0)
        setAssetCounts(mapped)
      } catch (e: any) {
        setError(String(e?.message || e))
      }
    })()
  }, [username, selStoreId])

  async function loadAssets() {
    if (!selStoreId) {
      setAssets([])
      return
    }
    setLoading(true)
    try {
      const headers = authHeaders()
      const p = new URLSearchParams()
      p.set('storeId', String(selStoreId))
      if (q) p.set('q', q)
      if (oldOnly) p.set('oldOnly', 'true')
      const res: Asset[] = await fetchJson(`/assets?${p.toString()}`, { headers })
      const withSn = (res || []).filter((it: any) => String(it?.serialNumber || '').trim() !== '')
      const list = withSn.map((it: any) => ({
        ...it,
        lastMaintenanceDate: it.lastMaintenanceDate || null,
      }))
      list.sort((a: any, b: any) => {
        const am = a?.ageMonths == null ? -1 : Number(a.ageMonths)
        const bm = b?.ageMonths == null ? -1 : Number(b.ageMonths)
        return bm - am
      })
      setAssets(list)
    } catch (e: any) {
      setError(String(e?.message || e))
    }
    setLoading(false)
  }

  useEffect(() => {
    loadAssets()
  }, [selStoreId])

  const filtered = useMemo(() => {
    let arr = assets
    const kw = q.trim().toLowerCase()
    if (kw) arr = arr.filter(a => (a.name || '').toLowerCase().includes(kw) || (a.category || '').toLowerCase().includes(kw) || (a.serialNumber || '').toLowerCase().includes(kw))
    return arr
  }, [assets, q])

  function openEditAge(a: Asset) {
    setEditingAsset(a)
    setAgeInput(a.ageMonths != null ? String(a.ageMonths) : '')
  }

  async function submitEditAge() {
    if (!editingAsset) return
    try {
      const months = Number(ageInput)
      if (!Number.isFinite(months) || months < 0) {
        alert('Angka usia tidak valid')
        return
      }
      const res = await fetch(`${apiBase}/assets/${editingAsset.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ ageSnapshotMonths: Math.round(months) }),
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        alert(txt || 'Gagal menyimpan usia')
        return
      }
      setEditingAsset(null)
      await loadAssets()
    } catch (e) {
      console.error(e)
      alert('Gagal mengubah usia')
    }
  }

  function openAddHistory(a: Asset) {
    setHistoryAsset(a)
    const today = new Date().toISOString().slice(0, 10)
    setHistoryDate(today)
    setHistoryNote('')
  }

  async function submitAddHistory() {
    if (!historyAsset) return
    try {
      const date = historyDate.trim()
      const note = historyNote.trim()
      if (!date || !note) {
        alert('Tanggal dan catatan wajib diisi')
        return
      }
      await fetchJson(`/assets/${historyAsset.id}/history`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ date, note, createdBy: username }),
      } as any)
      setHistoryAsset(null)
      setHistoryNote('')
      await loadAssets()
    } catch (e) {
      console.error(e)
      alert('Gagal menambah history')
    }
  }

  async function openViewHistory(a: Asset) {
    try {
      const items: AssetHistoryItem[] = await fetchJson(`/assets/${a.id}/history`, { headers: authHeaders() })
      setHistoryItems(items || [])
      setViewHistoryAsset(a)
    } catch (e) {
      console.error(e)
      alert('Gagal memuat history')
    }
  }

  async function deleteAsset(a: Asset) {
    if (!a || !a.id) return
    const name = a.name || ''
    const sn = a.serialNumber || ''
    const label = [name, sn].filter(Boolean).join(' / ')
    const ok = window.confirm(`Yakin ingin menghapus asset ini?\n${label || `ID: ${a.id}`}`)
    if (!ok) return
    try {
      const res = await fetch(`${apiBase}/assets/${a.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        alert(txt || 'Gagal menghapus asset')
        return
      }
      await loadAssets()
    } catch (e) {
      console.error(e)
      alert('Gagal menghapus asset')
    }
  }

  async function deleteFilteredAssets() {
    if (!selStoreId) {
      alert('Pilih store terlebih dahulu')
      return
    }
    if (filtered.length === 0) {
      alert('Tidak ada asset di daftar saat ini')
      return
    }
    const store = stores.find((s: any) => s.id === selStoreId)
    const storeLabel = store ? `${store.code ? `${store.code} - ` : ''}${store.name}` : `Store ID ${selStoreId}`
    const ok = window.confirm(
      `Yakin ingin menghapus ${filtered.length} asset untuk store:\n${storeLabel}\n\n` +
      `Yang dihapus hanya asset yang sedang tampil (sesuai filter/cari saat ini).`
    )
    if (!ok) return
    try {
      for (const a of filtered) {
        if (!a?.id) continue
        const res = await fetch(`${apiBase}/assets/${a.id}`, {
          method: 'DELETE',
          headers: authHeaders(),
        })
        if (!res.ok) {
          console.error('Gagal hapus asset', a.id, await res.text().catch(() => ''))
        }
      }
      await loadAssets()
      alert('Hapus asset selesai. Cek kembali daftar assets.')
    } catch (e) {
      console.error(e)
      alert('Terjadi error saat menghapus asset')
    }
  }

  async function exportAssets() {
    if (filtered.length === 0) {
      alert('Tidak ada data untuk diexport')
      return
    }
    const XLSX = await import('xlsx')

    const selectedStore = stores.find((s: any) => s.id === selStoreId)
    const storeName = selectedStore?.name || ''
    const today = new Date().toISOString().slice(0, 10)
    const teknik = username || ''

    // Header seperti format lama
    const headerRows = [
      ['Store', storeName],
      ['Tanggal', today],
      ['Teknisi', teknik],
      [],
      ['No', 'Lokasi', 'Hardware', 'Merk & SN', 'Panduan', 'Kondisi', 'Keterangan'],
    ]

    // Hanya isi kolom Hardware dan Merk & SN sesuai permintaan
    const bodyRows = filtered.map((a, idx) => [
      idx + 1,
      '',
      a.name || '',
      a.serialNumber || '',
      '',
      '',
      '',
    ])

    const data = [...headerRows, ...bodyRows]

    const XLSXMod = XLSX as any
    const ws = XLSXMod.utils.aoa_to_sheet(data)
    const wb = XLSXMod.utils.book_new()
    XLSXMod.utils.book_append_sheet(wb, ws, 'Assets')
    const wbout = XLSXMod.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `assets-${username}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importAssets(file: File) {
    try {
      if (!selStoreId) {
        alert('Pilih store terlebih dahulu sebelum import')
        return
      }
      const store = stores.find((s: any) => s.id === selStoreId)
      const XLSXMod = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSXMod.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]

      // Baca sebagai array-of-array dan paksa pakai kolom "Hardware" + "Merk & SN" saja.
      const aoa: any[][] = XLSXMod.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][]
      if (!aoa || aoa.length === 0) {
        alert('File kosong')
        return
      }

      // Cari baris header yang punya kata Hardware dan Merk (SN)
      let headerRowIndex = -1
      let colHardware = -1
      let colMerkSn = -1
      for (let i = 0; i < aoa.length; i++) {
        const row = aoa[i] || []
        const lower = row.map(c => String(c ?? '').trim().toLowerCase())
        const hIdx = lower.findIndex(v => v === 'hardware')
        const mIdx = lower.findIndex(v => v.includes('merk') && v.includes('sn'))
        if (hIdx >= 0 && mIdx >= 0) {
          headerRowIndex = i
          colHardware = hIdx
          colMerkSn = mIdx
          break
        }
      }

      if (headerRowIndex < 0) {
        alert('Format tidak dikenali. Pastikan ada kolom \"Hardware\" dan \"Merk & SN\" seperti template.')
        return
      }

      const records: { name: string; category: string; serialNumber: string }[] = []
      for (let i = headerRowIndex + 1; i < aoa.length; i++) {
        const row = aoa[i] || []
        const name = String(row[colHardware] ?? '').trim()
        const serialNumber = String(row[colMerkSn] ?? '').trim()
        if (!name && !serialNumber) continue
        records.push({ name, category: '', serialNumber })
      }

      if (records.length === 0) {
        alert('Tidak ada baris asset yang terbaca dari file')
        return
      }

      let ok = 0
      let fail = 0
      let skipped = 0
      let firstError = ''
      for (const rec of records) {
        const name = (rec.name || '').trim()
        if (!name) {
          skipped++
          continue
        }
        const category = (rec.category || '').trim()
        const sn = (rec.serialNumber || '').trim()
        const body: any = {
          name,
          category,
          serialNumber: sn || null,
          storeId: selStoreId,
          storeName: store?.name || null,
          status: 'active',
        }

        let success = false
        for (let attempt = 0; attempt < 3 && !success; attempt++) {
          try {
            const res = await fetch(`${apiBase}/assets`, {
              method: 'POST',
              headers: authHeaders(),
              body: JSON.stringify(body),
            })
            if (res.ok) {
              ok++
              success = true
            } else if (res.status === 429 && attempt < 2) {
              // Terlalu banyak request, tunggu sebentar lalu ulangi
              await sleep(1000)
              continue
            } else {
              const txt = await res.text().catch(() => '')
              if (!firstError) firstError = txt || `HTTP ${res.status}`
              console.error('Gagal import asset', { body, status: res.status, text: txt })
              fail++
              success = true
            }
          } catch (err: any) {
            console.error('Error network import asset', err)
            if (!firstError) firstError = String(err?.message || err)
            fail++
            success = true
          }
        }
      }
      let msg = `Import assets selesai. Berhasil: ${ok}, Dilewati: ${skipped}, Gagal: ${fail}`
      if (fail > 0 && firstError) {
        msg += `\n\nContoh error dari server:\n${firstError}`
      }
      alert(msg)
      await loadAssets()
    } catch (e) {
      console.error(e)
      alert('Gagal mengimpor file assets')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-500">
          <Link href="/admin/assets" className="text-blue-600">Assets</Link>
          <span> ≫ {username}</span>
        </div>
        <Link href="/admin/assets" className="text-blue-600">Kembali</Link>
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
      )}

      <div className="flex flex-wrap gap-2 items-end mb-3">
        <div>
          <label className="text-sm text-gray-500">Pilih Store</label>
          <select className="border rounded px-2 py-1 block" value={selStoreId ?? ''} onChange={e => setSelStoreId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">- pilih store -</option>
            {stores.map((s: any) => (
              <option key={s.id} value={s.id}>{s.code ? `${s.code} - ${s.name}` : s.name} ({assetCounts[s.id] ?? 0})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-500">Cari</label>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="nama/kategori/SN" className="border rounded px-2 py-1 block" />
        </div>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={oldOnly} onChange={e => setOldOnly(e.target.checked)} />
          <span>≥ 5 Tahun</span>
        </label>
        <button onClick={loadAssets} className="btn px-3 py-2 border rounded bg-blue-600 text-white">Terapkan</button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="ml-2 px-3 py-2 border rounded bg-amber-600 text-white"
        >
          Import
        </button>
        <button
          onClick={deleteFilteredAssets}
          disabled={filtered.length === 0}
          className="ml-2 px-3 py-2 border rounded bg-red-600 text-white disabled:opacity-60"
        >
          Hapus
        </button>
        <button onClick={exportAssets} disabled={filtered.length === 0} className="ml-2 px-3 py-2 border rounded bg-emerald-600 text-white disabled:opacity-60">Export</button>
        {loading && <span className="text-sm text-gray-500">Memuat...</span>}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) importAssets(f)
          if (e.target) (e.target as any).value = ''
        }}
      />

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2">No</th>
              <th className="text-left p-2">Hardware</th>
              <th className="text-left p-2">Merk & SN</th>
              <th className="text-left p-2">Kondisi</th>
              <th className="text-left p-2">Usia</th>
              <th className="text-left p-2">History</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a: any, idx: number) => (
              <tr key={a.id} className="border-t">
                <td className="p-2 w-12 text-center">{idx + 1}</td>
                <td className="p-2">{a.name}</td>
                <td className="p-2">
                  <div className="leading-tight">{a.serialNumber || '-'}</div>
                  <div className="text-xs text-gray-500">{(a as any).category || '-'}</div>
                </td>
                <td className="p-2"><StatusBadge status={a.status} /></td>
                <td className="p-2">
                  {a.isOld ? <span className="text-red-600 font-semibold">{fmtAge(a.ageMonths)}</span> : fmtAge(a.ageMonths)}
                  <button
                    className="ml-2 inline-flex items-center justify-center text-blue-600 hover:text-blue-800"
                    type="button"
                    onClick={() => openEditAge(a)}
                    aria-label="Edit usia aset"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                    </svg>
                  </button>
                </td>
                <td className="p-2">
                  {a.lastHistoryDate
                    ? new Date(a.lastHistoryDate).toLocaleDateString()
                    : (a.lastMaintenanceDate ? new Date(a.lastMaintenanceDate).toLocaleDateString() : '-')}
                  {(a as any).lastHistoryNote && (
                    <div className="text-xs text-gray-500 truncate max-w-[220px]">{(a as any).lastHistoryNote}</div>
                  )}
                  <button
                    className="mt-1 text-xs text-blue-600 underline block"
                    type="button"
                    onClick={() => openAddHistory(a)}
                  >
                    Tambah
                  </button>
                  <button
                    className="mt-0.5 inline-flex items-center justify-center text-blue-600 hover:text-blue-800"
                    type="button"
                    onClick={() => openViewHistory(a)}
                    aria-label="Lihat history aset"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                  <button
                    className="mt-1 text-xs text-red-600 underline block"
                    type="button"
                    onClick={() => deleteAsset(a)}
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr><td className="p-3 text-gray-500" colSpan={6}>Pilih store / Tidak ada data</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingAsset(null)} />
          <div className="relative bg-white w-[92%] max-w-sm rounded-lg shadow-xl p-5">
            <h3 className="text-base font-semibold mb-2">Edit Usia Aset</h3>
            <p className="text-sm text-gray-600 mb-3">{editingAsset.name} — {editingAsset.serialNumber}</p>
            <label className="block text-sm text-gray-700 mb-1">Usia (bulan)</label>
            <input
              type="number"
              min={0}
              className="border rounded px-3 py-2 w-full mb-4"
              value={ageInput}
              onChange={e => setAgeInput(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button className="px-3 py-2 rounded bg-gray-200" onClick={() => setEditingAsset(null)}>Batal</button>
              <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={submitEditAge}>Simpan</button>
            </div>
          </div>
        </div>
      )}

      {historyAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setHistoryAsset(null)} />
          <div className="relative bg-white w-[92%] max-w-md rounded-lg shadow-xl p-5 space-y-3">
            <h3 className="text-base font-semibold">Tambah History Perbaikan</h3>
            <p className="text-sm text-gray-600">{historyAsset.name} — {historyAsset.serialNumber}</p>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Tanggal</label>
              <input
                type="date"
                className="border rounded px-3 py-2 w-full"
                value={historyDate}
                onChange={e => setHistoryDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Catatan</label>
              <textarea
                className="border rounded px-3 py-2 w-full min-h-[80px]"
                value={historyNote}
                onChange={e => setHistoryNote(e.target.value)}
                placeholder="Contoh: ganti mainboard karena mati total"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button className="px-3 py-2 rounded bg-gray-200" onClick={() => setHistoryAsset(null)}>Batal</button>
              <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={submitAddHistory}>Simpan</button>
            </div>
          </div>
        </div>
      )}

      {viewHistoryAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setViewHistoryAsset(null)} />
          <div className="relative bg-white w-[92%] max-w-md rounded-lg shadow-xl p-5 space-y-3">
            <h3 className="text-base font-semibold">Riwayat Perbaikan</h3>
            <p className="text-sm text-gray-600">{viewHistoryAsset.name} — {viewHistoryAsset.serialNumber}</p>
            <div className="max-h-[320px] overflow-y-auto space-y-2">
              {historyItems.length === 0 && (
                <div className="text-sm text-gray-500">Belum ada history tercatat.</div>
              )}
              {historyItems.map(h => (
                <div key={h.id} className="border rounded px-3 py-2 text-sm">
                  <div className="font-medium">{new Date(h.date).toLocaleDateString()}</div>
                  <div className="text-gray-700">{h.note}</div>
                  {h.createdBy && <div className="text-xs text-gray-400 mt-0.5">oleh {h.createdBy}</div>}
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-1">
              <button className="px-3 py-2 rounded bg-gray-200" onClick={() => setViewHistoryAsset(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
