import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Sajikan HTML statis via rewrite untuk semua variasi /user/form
  if (pathname === '/user/form' || pathname.startsWith('/user/form/')) {
    const url = new URL('/maintenance-form.html?mode=user', req.url)
    return NextResponse.rewrite(url)
  }

  // Sajikan HTML statis via rewrite untuk /admin/form kecuali /admin/form/new
  if (
    pathname === '/admin/form' ||
    (pathname.startsWith('/admin/form') && !pathname.startsWith('/admin/form/new'))
  ) {
    const url = new URL('/maintenance-form.html?mode=admin', req.url)
    return NextResponse.rewrite(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/user/form/:path*', '/admin/form/:path*'],
}
