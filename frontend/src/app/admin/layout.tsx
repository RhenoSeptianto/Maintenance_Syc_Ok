"use client"

import React, { useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import { useConfirm } from '@/components/Confirm'
import { usePathname, useRouter } from 'next/navigation'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // simple auth guard: check token
    const token = localStorage.getItem('token')
    const user = localStorage.getItem('user')
    if (!token || !user) {
      router.push('/login')
      return
    }
    try {
      const parsed = JSON.parse(user)
      if (parsed.role !== 'admin') router.push('/login')
    } catch (e) {
      router.push('/login')
    }
    // Fallback: jika berada di /admin/form, paksa pindah ke HTML statis
    if (typeof window !== 'undefined' && window.location.pathname === '/admin/form') {
      window.location.href = '/maintenance-form.html?mode=admin'
    }
  }, [])

  // Auto reload saat ada event global (submit/edit maintenance atau update jadwal/aset)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const keys = ['maintenance_last_submit','maintenance_last_edit','lastEditedMaintenanceId','schedule_last_update','asset_last_update']
    let lastReload = 0
    const trigger = () => {
      const now = Date.now()
      if (now - lastReload < 1000) return
      lastReload = now
      try { window.location.reload() } catch {}
    }
    const onStorage = (e: StorageEvent) => {
      if (!e.key || !keys.includes(e.key)) return
      trigger()
    }
    const onSchedule = () => trigger()
    const onAsset = () => trigger()
    window.addEventListener('storage', onStorage)
    window.addEventListener('schedule:updated', onSchedule as any)
    window.addEventListener('asset:updated', onAsset as any)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('schedule:updated', onSchedule as any)
      window.removeEventListener('asset:updated', onAsset as any)
    }
  }, [])

  const confirm = useConfirm()
  const handleLogout = async () => {
    const ok = await confirm({ title: 'Konfirmasi Logout', message: 'Apakah Anda yakin ingin logout?', confirmText: 'Logout', cancelText: 'Batal' })
    if (!ok) return
    try { localStorage.removeItem('token'); localStorage.removeItem('user') } catch {}
    router.push('/login')
  }

  const menu = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: 'dashboard' },
    { label: 'Pengguna', href: '/admin/user', icon: 'users' },
    { label: 'Store', href: '/admin/store', icon: 'store' },
    { label: 'Jadwal Maintenance', href: '/admin/jadwal', icon: 'calendar' },
    { label: 'Assets', href: '/admin/assets', icon: 'inventory' },
    // Arahkan langsung ke HTML statis agar ringan (paksa hard redirect via onClick sebagai jaring pengaman)
    { label: 'Form Maintenance', href: '/maintenance-form.html?mode=admin', icon: 'form', onClick: () => { if (typeof window !== 'undefined') window.location.replace('/maintenance-form.html?mode=admin') } },
    { label: 'Persetujuan Maintenance', href: '/admin/approval', icon: 'approval' },
    { label: 'Laporan Maintenance', href: '/admin/report', icon: 'report' },
    { label: 'DB UI', href: '/admin/db', icon: 'database' },
    { label: 'Keluar', onClick: handleLogout, icon: 'logout' },
  ]

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar items={menu} title="Admin Menu" />
      <main className="flex-1 p-3 md:p-6">
        {pathname?.startsWith('/admin/dashboard') && (
          <header className="mb-6">
            <h1 className="text-2xl font-semibold">Dashboard Admin</h1>
            <div className="h-1 brand-grad rounded mt-3" />
          </header>
        )}
        {!pathname?.startsWith('/admin/dashboard') && (<div className="h-1 brand-grad rounded mb-4" />)}
        <section>{children}</section>
      </main>
    </div>
  )
}
