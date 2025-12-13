import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  
  // Check if this is an OAuth callback with a code
  const code = url.searchParams.get('code')
  
  if (code && url.pathname === '/') {
    // This is an OAuth callback - redirect to our callback handler
    url.pathname = '/callback'
    return NextResponse.redirect(url)
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/'],
}
