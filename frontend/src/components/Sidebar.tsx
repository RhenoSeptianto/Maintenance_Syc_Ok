"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useConfirm } from '@/components/Confirm'

type MenuItem = {
  label: string
  href?: string
  onClick?: () => void
  icon?: string // optional semantic icon name
}

export default function Sidebar({ items, title }: { items: MenuItem[]; title?: string }) {
  const pathname = usePathname()
  const router = useRouter()

  const [user, setUser] = useState<{ username: string; role?: string } | null>(null)
  const [collapsed, setCollapsed] = useState<boolean>(false)
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null
      if (raw) {
        const u = JSON.parse(raw)
        if (u?.username) setUser({ username: u.username, role: u.role })
      }
      const col = typeof window !== 'undefined' ? localStorage.getItem('sidebar_collapsed') : null
      if (col === '1') setCollapsed(true)
      // Auto-collapse di layar kecil agar mobile lebih nyaman
      if (typeof window !== 'undefined' && window.innerWidth <= 768 && col == null) {
        setCollapsed(true)
        try { localStorage.setItem('sidebar_collapsed','1') } catch {}
      }
    } catch {}
  }, [])
  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('sidebar_collapsed', next ? '1' : '0') } catch {}
  }

  const initials = useMemo(() => {
    const n = user?.username || ''
    if (!n) return 'U'
    const parts = String(n).replace(/[_.-]+/g, ' ').split(' ').filter(Boolean)
    const first = parts[0]?.[0] || ''
    const second = parts.length > 1 ? (parts[1]?.[0] || '') : ''
    return (first + second).toUpperCase() || 'U'
  }, [user?.username])

  const confirm = useConfirm()

  function Icon({ name, active }: { name?: string; active?: boolean }){
    const c = `w-4 h-4 ${active ? 'text-white' : 'text-gray-500'}`
    switch(name){
      case 'dashboard':
        return (<svg className={c} viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h8v8H3V3Zm10 0h8v5h-8V3ZM3 13h8v8H3v-8Zm10 7v-9h8v9h-8Z"/></svg>)
      case 'users':
        return (<svg className={c} viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 9a7 7 0 0 1 14 0Z"/></svg>)
      case 'store':
        return (<svg className={c} viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16l1 4H3l1-4Zm0 6h16v10H4V10Zm3 2v6h2v-6H7Zm8 0v6h2v-6h-2Z"/></svg>)
      case 'calendar':
        return (<svg className={c} viewBox="0 0 24 24" fill="currentColor"><path d="M7 2h2v3H7V2Zm8 0h2v3h-2V2ZM3 7h18v14H3V7Zm2 4h4v4H5v-4Z"/></svg>)
      case 'form':
        return (<svg className={c} viewBox="0 0 24 24" fill="currentColor"><path d="M4 3h16v18H4V3Zm3 3h10v2H7V6Zm0 4h10v2H7v-2Zm0 4h7v2H7v-2Z"/></svg>)
      case 'approval':
        return (<svg className={c} viewBox="0 0 24 24" fill="currentColor"><path d="m9 16 9-9 1.5 1.5L9 19 4.5 14.5 6 13l3 3Z"/></svg>)
      case 'report':
        return (<svg className={c} viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v16H4V4Zm3 3h10v2H7V7Zm0 4h7v2H7v-2Zm0 4h5v2H7v-2Z"/></svg>)
      case 'database':
        return (<svg className={c} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-4.97 0-9 1.57-9 3.5S7.03 9 12 9s9-1.57 9-3.5S16.97 2 12 2Zm-9 6v3.5C3 13.43 7.03 15 12 15s9-1.57 9-3.5V8c0 1.93-4.03 3.5-9 3.5S3 9.93 3 8Zm0 6v3.5C3 19.43 7.03 21 12 21s9-1.57 9-3.5V14c0 1.93-4.03 3.5-9 3.5S3 15.93 3 14Z"/></svg>)
      case 'logout':
        return (<svg className={c} viewBox="0 0 24 24" fill="currentColor"><path d="M10 3h10v18H10v-2h8V5h-8V3Zm-1.59 6.59L5 13l3.41 3.41L7 15h6v-2H7l1.41-1.41Z"/></svg>)
      default:
        return (<span className={c}>•</span>)
    }
  }

  return (
    <aside className={`${collapsed ? 'w-16 md:w-20' : 'w-64'} bg-white border-r shadow-sm min-h-screen transition-all duration-300 ease-in-out sticky top-0`}> 
      <div className={`p-4 border-b bg-gradient-to-r from-indigo-600 to-blue-600 text-white ${collapsed ? 'py-3' : ''}`}>
        <div className={`flex items-center ${collapsed ? 'justify-between' : 'justify-between'} gap-3`}>
          <img src="/logo.png" alt="Logo" className={`${collapsed ? 'w-9 h-9' : 'w-9 h-9'} rounded-sm shadow-sm bg-white/90 p-1`} />
          {!collapsed && (
            <div className="flex-1">
              <h2 className="text-lg font-semibold leading-tight truncate">{title ?? 'Maintenance'}</h2>
              <div className="text-[11px] opacity-90">System Console</div>
            </div>
          )}
          <button aria-label="Toggle sidebar" onClick={toggleCollapsed} className={`shrink-0 rounded-md ${collapsed ? 'bg-white/10 hover:bg-white/20' : 'bg-white/10 hover:bg-white/20'} p-1 transition-colors`}>
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              {collapsed ? (
                <path d="M15 6 9 12l6 6"/>
              ) : (
                <path d="m9 6 6 6-6 6"/>
              )}
            </svg>
          </button>
        </div>
        {!collapsed && user && (
          <div className="mt-3 flex items-center gap-3 p-2 rounded-md bg-white text-slate-800 shadow-sm">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold shadow">
              {initials}
            </div>
            <div className="leading-tight">
              <div className="font-medium">{user.username}</div>
              <div className="text-xs text-gray-500 capitalize">{user.role || 'user'}</div>
            </div>
          </div>
        )}
      </div>
      <nav className="p-2">
        <ul className="space-y-2">
          {items.map((it, idx) => {
            const active = it.href ? pathname?.startsWith(it.href) : false
            return (
              <li key={idx}>
                <button
                  onClick={async () => {
                    // Konfirmasi khusus untuk aksi logout
                    try {
                      const isLogout = String(it.icon||'').toLowerCase()==='logout' || /keluar/i.test(String(it.label||''))
                      if (isLogout) {
                        let ok = true
                        try { ok = await confirm({ title: 'Konfirmasi Logout', message: 'Apakah Anda yakin ingin logout?', confirmText: 'Logout', cancelText: 'Batal' }) } catch {}
                        if (!ok) return
                      }
                    } catch {}
                    if (it.href) {
                      // Jika mengarah ke file HTML statis atau external, lakukan hard navigation
                      if (it.href.includes('.html') || it.href.startsWith('http')) {
                        window.location.href = it.href
                      } else {
                        router.push(it.href)
                      }
                    }
                    if (it.onClick) it.onClick()
                  }}
                  title={collapsed ? it.label : undefined}
                  className={`w-full text-left ${collapsed ? 'px-2 justify-center' : 'px-3 justify-between'} py-2 rounded-md transition-colors flex items-center ${active ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  <span className={`flex items-center ${collapsed ? '' : 'gap-2'}`}>
                    <Icon name={it.icon} active={active} />
                    {!collapsed && <span className="truncate">{it.label}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
