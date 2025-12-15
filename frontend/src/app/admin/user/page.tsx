"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { apiBase, authHeaders } from '@/lib/api'
import { useToast } from '@/components/Toast'

type User = { id:number; username:string; name?:string|null; role:string }

export default function AdminUserPage(){
  const toast = useToast()
  const protectedUsername = (process.env.NEXT_PUBLIC_PROTECT_ADMIN_USERNAME as string) || 'admin'
  const me = useMemo(()=>{
    if (typeof window === 'undefined') return {} as any
    try { return JSON.parse(localStorage.getItem('user')||'{}') } catch { return {} as any }
  }, [])
  const [users,setUsers] = useState<User[]>([])
  const [loading,setLoading] = useState(true)
  const [username,setUsername] = useState('')
  const [password,setPassword] = useState('')
  const [name,setName] = useState('')
  const [role,setRole] = useState<'admin'|'user'|'ts'>('user' as any)
  const [editId,setEditId] = useState<number|null>(null)
  const [editUsername,setEditUsername] = useState('')
  const [editPassword,setEditPassword] = useState('')
  const [editName,setEditName] = useState('')
  const [editRole,setEditRole] = useState<'admin'|'user'|'ts'>('user' as any)
  const [notice, setNotice] = useState<{ kind:'success'|'error'; text:string }|null>(null)
  const showNotice = (kind:'success'|'error', text:string) => { setNotice({ kind, text }); setTimeout(()=> setNotice(null), 3500) }
  const notify = (ok:boolean, msg:string) => { if (ok) { toast.success(msg); showNotice('success', msg) } else { toast.error(msg); showNotice('error', msg) } try { alert(msg) } catch {} }

  async function load(){
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/users`, { headers: authHeaders() })
      if (res.status === 401 || res.status === 403) {
        alert('Sesi berakhir atau akses ditolak. Silakan login sebagai Admin.');
        window.location.href = '/login'
        return
      }
      if (!res.ok) {
        const txt = await res.text().catch(()=> '')
        console.error('Gagal memuat users:', res.status, txt)
        alert('Gagal memuat data user')
        return
      }
      const data = await res.json().catch(()=> [])
      setUsers(Array.isArray(data) ? data : [])
    } finally { setLoading(false) }
  }
  // diinisiasi oleh effect di bawah yang juga cek token
  useEffect(()=>{
    try{
      if (typeof window !== 'undefined'){
        const t = localStorage.getItem('token')
        if (!t) { window.location.href = '/login'; return }
      }
    }catch{}
    load().catch(e=>{ console.error('load users failed:', e); alert('Gagal memuat data user'); })
  },[])

  const MIN_PW = 3

  async function add(){
    if(!username || !password) return notify(false, 'Username & Password wajib')
    if(String(password).length < MIN_PW) return notify(false, `Password minimal ${MIN_PW} karakter`)
    try {
      const res = await fetch(`${apiBase}/users`,{ method:'POST', headers: authHeaders(), body: JSON.stringify({ username, password, role, name: name || undefined }) })
      if (!res.ok) { const txt = await res.text().catch(()=> 'Gagal menambah user'); notify(false, `Gagal menambah user: ${txt}`); return }
      notify(true, 'User berhasil ditambahkan')
      setUsername(''); setPassword(''); setName(''); setRole('user' as any); await load()
    } catch(e) { console.error(e); notify(false, 'Gagal menambah user') }
  }
  async function remove(id:number){
    if(!confirm('Hapus user?')) return
    try{
      const res = await fetch(`${apiBase}/users/${id}`,{ method:'DELETE', headers: authHeaders() })
      if(!res.ok){ const t = await res.text().catch(()=> 'Gagal menghapus'); notify(false, `Gagal menghapus: ${t}`); return }
      notify(true, 'User berhasil dihapus')
      await load()
    }catch(e){ console.error(e); toast.error('Gagal menghapus'); alert('Gagal menghapus') }
  }
  async function setUserRole(id:number, newRole:'admin'|'user'|'ts'){
    try{
      const res = await fetch(`${apiBase}/users/${id}`,{ method:'PUT', headers: authHeaders(), body: JSON.stringify({ role:newRole }) })
      if(!res.ok){ const t = await res.text().catch(()=> 'Gagal menyimpan role'); notify(false, `Gagal menyimpan role: ${t}`); return }
      notify(true, 'Role pengguna berhasil diperbarui')
      await load()
    }catch(e){ console.error(e); toast.error('Gagal menyimpan role'); alert('Gagal menyimpan role') }
  }
  function beginEdit(u:User){ setEditId(u.id); setEditUsername(u.username); setEditName(u.name||''); setEditPassword(''); setEditRole(u.role as any); notify(true, `Mode edit: ${u.username}`) }
  function cancelEdit(){ setEditId(null); setEditUsername(''); setEditName(''); setEditPassword(''); }
  async function saveEdit(){
    if (editId==null) return; if(!editUsername) return alert('Username wajib diisi')
    const body:any = { username: editUsername, role: editRole, name: editName }
    if (editPassword) {
      if (String(editPassword).length < MIN_PW) return alert(`Password minimal ${MIN_PW} karakter`)
      body.password = editPassword
    }
    try {
      const res = await fetch(`${apiBase}/users/${editId}`,{ method:'PUT', headers: authHeaders(), body: JSON.stringify(body) })
      if (!res.ok) {
        const txt = await res.text().catch(()=> 'Gagal menyimpan perubahan')
        notify(false, `Gagal menyimpan: ${txt}`)
        return
      }
      notify(true, 'Perubahan pengguna berhasil disimpan')
      cancelEdit(); await load()
    } catch (e:any) {
      console.error('saveEdit error:', e)
      notify(false, 'Terjadi kesalahan saat menyimpan')
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Manajemen Pengguna</h2>
      {notice && (
        <div className={`fixed left-1/2 -translate-x-1/2 top-4 z-[99999] px-4 py-2 text-sm rounded shadow ${notice.kind==='success'?'bg-emerald-600 text-white':'bg-rose-600 text-white'}`}>{notice.text}</div>
      )}
      <div className="bg-white p-4 rounded shadow grid md:grid-cols-5 gap-3">
        <input placeholder="username" className="border rounded px-3 py-2" value={username} onChange={e=>setUsername(e.target.value)} />
        <input placeholder="nama (opsional)" className="border rounded px-3 py-2" value={name} onChange={e=>setName(e.target.value)} />
        <input placeholder="password" type="password" className="border rounded px-3 py-2" value={password} onChange={e=>setPassword(e.target.value)} />
        <select className="border rounded px-3 py-2" value={role} onChange={e=>setRole(e.target.value as any)}>
          <option value="user">TS (user)</option>
          <option value="ts">TS (ts)</option>
          <option value="admin">Admin</option>
        </select>
        <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={add}>Tambah</button>
      </div>

      <div className="bg-white p-4 rounded shadow">
        {loading? <div>Memuat...</div> : (
          <div className="tbl-wrap">
          <table className="tbl text-sm">
            <thead>
              <tr><th>Username</th><th>Nama</th><th>Role</th><th className="col-actions">Aksi</th></tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isProtected = String(u.role||'').toLowerCase()==='admin' && String(u.username||'').toLowerCase()===String(protectedUsername||'').toLowerCase() && String(me?.username||'').toLowerCase()!==String(protectedUsername||'').toLowerCase()
                return (
                <tr key={u.id} className="border-t opacity-100">
                  <td className="p-2">
                    {editId===u.id ? (
                      <input className="border rounded px-2 py-1 w-full" value={editUsername} onChange={e=>setEditUsername(e.target.value)} />
                    ) : (
                      u.username
                    )}
                  </td>
                  <td className="p-2">
                    {editId===u.id ? (
                      <input className="border rounded px-2 py-1 w-full" placeholder="nama (opsional)" value={editName} onChange={e=>setEditName(e.target.value)} />
                    ) : (
                      u.name || '-'
                    )}
                  </td>
                 <td className="p-2">
                    {editId===u.id ? (
                      <select className="border rounded px-2 py-1" value={editRole} onChange={e=>setEditRole(e.target.value as any)}>
                        <option value="user">TS (user)</option>
                        <option value="ts">TS (ts)</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      isProtected ? (
                        <span className="px-2 py-1 inline-block">{u.role === 'admin' ? 'Admin' : 'TS'}</span>
                      ) : (
                        <select className="border rounded px-2 py-1" value={u.role} onChange={e=>setUserRole(u.id, e.target.value as any)}>
                          <option value="user">TS (user)</option>
                          <option value="ts">TS (ts)</option>
                          <option value="admin">Admin</option>
                        </select>
                      )
                    )}
                  </td>
                  <td className="p-2 text-right">
                    {editId===u.id ? (
                      <div className="flex gap-2 justify-end items-center">
                        <input placeholder="password baru (opsional)" type="password" className="border rounded px-2 py-1" value={editPassword} onChange={e=>setEditPassword(e.target.value)} />
                        <button className="px-2 py-1 bg-gray-300 rounded" onClick={cancelEdit}>Batal</button>
                        <button className="px-2 py-1 bg-green-600 text-white rounded" onClick={saveEdit} disabled={isProtected}>Simpan</button>
                      </div>
                    ) : (
                      isProtected ? (
                        <div className="flex gap-2 justify-end"></div>
                      ) : (
                        <div className="flex gap-2 justify-end">
                          <button
                            className="px-2 py-1 bg-yellow-500 text-black rounded flex items-center justify-center"
                            style={{ width: 36 }}
                            title="Edit"
                            aria-label="Edit"
                            onClick={()=>beginEdit(u)}
                          >✏️</button>
                          <button className="px-2 py-1 bg-red-500 text-white rounded" onClick={()=>remove(u.id)}>Hapus</button>
                        </div>
                      )
                    )}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}
