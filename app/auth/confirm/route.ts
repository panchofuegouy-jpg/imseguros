import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/reset-password'

  // Only allow local paths so an email link cannot redirect the user off-site.
  const requestUrl = new URL(request.url)
  const resolvedNext = new URL(next, requestUrl)
  const safeNext = resolvedNext.origin === requestUrl.origin
    ? `${resolvedNext.pathname}${resolvedNext.search}${resolvedNext.hash}`
    : '/reset-password'
  const errorDestination = safeNext.startsWith('/reset-password')
    ? '/reset-password?error=link'
    : '/login?error=link'

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, request.url))
    }
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error) {
      return NextResponse.redirect(new URL(safeNext, request.url))
    }
  }

  // Keep the user in the app and let the relevant screen explain how to retry.
  return NextResponse.redirect(new URL(errorDestination, request.url))
}
