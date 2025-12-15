"use client"

import React, { createContext, useContext, useState, useCallback } from 'react'

type ConfirmOptions = {
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
}

type ConfirmContextType = {
  confirm: (opts?: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextType | null>(null)

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx.confirm
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ opts: ConfirmOptions; open: boolean; resolve?: (v: boolean) => void }>({ opts: {}, open: false })

  const confirm = useCallback((opts?: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, opts: opts || {}, resolve })
    })
  }, [])

  const close = (val: boolean) => {
    try { state.resolve?.(val) } finally { setState(s => ({ ...s, open: false, resolve: undefined })) }
  }

  const { open, opts } = state
  const title = opts.title || 'Konfirmasi'
  const message = opts.message || 'Apakah Anda yakin?'
  const okText = opts.confirmText || 'Ya'
  const cancelText = opts.cancelText || 'Batal'

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => close(false)} />
          <div className="relative bg-white w-[92%] max-w-sm rounded-lg shadow-xl p-5 animate-in fade-in zoom-in">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 1 21h22L12 2Zm1 15h-2v-2h2v2Zm0-4h-2V9h2v4Z"/></svg>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                <p className="text-sm text-gray-600 mt-1">{message}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300" onClick={() => close(false)}>{cancelText}</button>
              <button className="px-4 py-2 rounded bg-indigo-600 text-white hover:brightness-110" onClick={() => close(true)}>{okText}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

