"use client"

import { useState } from 'react'
import { apiBase } from '@/lib/api'
import { useToast } from '@/components/Toast'

export default function LoginPage() {
  const toast = useToast()
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)

  async function doLogin() {
    const uname = form.username.trim()
    const res = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: uname, password: form.password })
    })
    if (!res.ok) throw new Error('fail')
    return res.json()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    try {
      const data = await doLogin()
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      toast.success('Login berhasil')
      window.location.href = data.user.role === 'admin' ? '/admin/dashboard' : '/user/dashboard'
    } catch (error) {
      console.error('Login error:', error)
      toast.error('Login gagal. Periksa akun Anda.')
    } finally { setLoading(false) }
  }

  return (
    <div className="auth-hero flex items-center justify-center">
      <div className="bg-white/95 backdrop-blur-[1px] p-8 rounded-xl shadow-2xl w-full max-w-md border border-slate-100">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="Logo" className="w-14 h-14 mb-2 rounded" />
          <h1 className="text-2xl font-bold text-gray-800">Maintenance System</h1>
          <div className="text-sm text-gray-500">Masuk untuk melanjutkan</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">Nama Pengguna</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
              placeholder="Masukkan nama pengguna"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">Kata Sandi</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
              placeholder="Masukkan kata sandi"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full brand-grad text-white py-3 px-4 rounded-lg text-lg font-semibold hover:brightness-110 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-60 shadow"
          >
            {loading ? 'Masuk...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  )
}
