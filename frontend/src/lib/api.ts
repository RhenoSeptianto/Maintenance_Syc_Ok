// Penentuan API base yang mobile-friendly (hindari hardcoded localhost)
const envApi = (process.env.NEXT_PUBLIC_API_URL as string) || ''
const lsApi = (typeof window !== 'undefined' ? (localStorage.getItem('apiBase') || '') : '')

function deriveFromLocation() {
  if (typeof window === 'undefined') return ''
  const { protocol, hostname } = window.location
  // Jika hostname bukan localhost, asumsikan backend ada di host yang sama port 4010
  if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `${protocol}//${hostname}:4010`
  }
  // Untuk localhost, akan ditangani di bawah
  return ''
}

// Prefer env over localStorage to avoid stale overrides in production
let base = (envApi || lsApi || '').replace(/\/$/, '')
// Jika berjalan di localhost, pakai host yang sama port 4010 agar tidak tergantung env IP
if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
  const dyn = `${window.location.protocol}//${window.location.hostname}:4010`
  base = dyn
} else if (!base || /localhost(:\d+)?$/i.test(base)) {
  const dyn = deriveFromLocation()
  if (dyn) base = dyn
}
if (!base) base = 'http://localhost:4010'
export const apiBase = base.replace(/\/$/, '')

export function authHeaders() {
  if (typeof window === 'undefined') return { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('token')
  const headers: any = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

export async function fetchJson(path: string, opts: RequestInit = {}) {
  const url = `${apiBase}${path}`
  const maxRetry = Number((opts as any).retries ?? 2)
  let lastErr: any
  for (let attempt = 0; attempt <= maxRetry; attempt++) {
    try {
      const res = await fetch(url, opts)
      if (!res.ok) {
        // retry only for transient errors
        if ([502,503,504].includes(res.status) && attempt < maxRetry) {
          await new Promise(r=>setTimeout(r, 500 * Math.pow(2, attempt)))
          continue
        }
        const text = await res.text()
        let json
        try { json = JSON.parse(text) } catch (e) { json = { message: text } }
        const err: any = new Error(json?.message || res.statusText)
        err.status = res.status
        err.body = json
        throw err
      }
      return res.json()
    } catch (e: any) {
      lastErr = e
      // Network failure: retry
      if (attempt < maxRetry) {
        await new Promise(r=>setTimeout(r, 500 * Math.pow(2, attempt)))
        continue
      }
      throw e
    }
  }
  throw lastErr || new Error('Request failed')
}
