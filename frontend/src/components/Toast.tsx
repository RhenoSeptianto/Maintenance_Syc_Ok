"use client"

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

type ToastKind = 'success' | 'error' | 'info'
type ToastItem = { id: number; kind: ToastKind; message: string }

const ToastCtx = createContext<{ push: (kind: ToastKind, message: string) => void }|null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }){
  const [items, setItems] = useState<ToastItem[]>([])
  const idRef = useRef(1)

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = idRef.current++
    setItems(prev => [...prev, { id, kind, message }])
    setTimeout(() => setItems(prev => prev.filter(i => i.id !== id)), 3000)
  }, [])

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed z-[9999] top-4 right-4 space-y-2">
        {items.map(t => (
          <div key={t.id} className={`px-4 py-2 rounded shadow text-white text-sm flex items-center gap-2 ${
            t.kind==='success' ? 'bg-emerald-600' : t.kind==='error' ? 'bg-rose-600' : 'bg-slate-700'
          }`}>
            <span className="inline-block w-2 h-2 rounded-full bg-white/80" />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast(){
  const ctx = useContext(ToastCtx)
  if (!ctx) return { success: (_:string)=>{}, error: (_:string)=>{}, info: (_:string)=>{} }
  return {
    success: (m:string)=>ctx.push('success', m),
    error: (m:string)=>ctx.push('error', m),
    info: (m:string)=>ctx.push('info', m),
  }
}

