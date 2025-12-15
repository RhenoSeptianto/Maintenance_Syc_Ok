import { NextResponse } from 'next/server'

export function GET(request: Request) {
  const url = new URL('/maintenance-form.html?mode=admin', request.url)
  return NextResponse.redirect(url, { status: 307 })
}

