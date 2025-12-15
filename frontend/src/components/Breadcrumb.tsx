"use client"

import React from 'react'
import Link from 'next/link'

export default function Breadcrumb({ base, path }: { base: string; path: string }){
  const parts = path.split('/').filter(Boolean)
  const items: { href: string; label: string }[] = []
  let acc = ''
  for (const p of parts){
    acc += '/' + p
    if (p === base.replace('/','')) continue
    items.push({ href: acc, label: p.replace(/-/g,' ').replace(/\b\w/g, m=>m.toUpperCase()) })
  }
  if (items.length===0) return null
  return (
    <nav className="text-sm text-slate-600 flex items-center gap-2 mb-3">
      <Link className="hover:underline" href={`/${base}`}>{base[0].toUpperCase()+base.slice(1)}</Link>
      {items.map((it,i)=> (
        <React.Fragment key={it.href}>
          <span>/</span>
          <Link className={i===items.length-1? 'font-medium text-slate-800' : 'hover:underline'} href={it.href}>{it.label}</Link>
        </React.Fragment>
      ))}
    </nav>
  )
}

