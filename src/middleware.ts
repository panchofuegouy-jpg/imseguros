import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  let res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          req.cookies.set({
            name,
            value,
            ...options,
          })
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          res.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          req.cookies.set({
            name,
            value: '',
            ...options,
          })
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          res.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  if (sessionError) {
    console.error("Auth session error");
  }

  const protectedRoutes = ["/admin", "/cliente"];
  const isProtectedRoute = protectedRoutes.some((route) => req.nextUrl.pathname.startsWith(route));

  if (!session && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (session) {
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const userRole = profile.role;

    // Admin access control
    if (req.nextUrl.pathname.startsWith("/admin")) {
      if (userRole !== "admin") {
        return NextResponse.redirect(new URL("/cliente", req.url));
      }
    }

    // Client access control
    if (req.nextUrl.pathname.startsWith("/cliente")) {
      if (userRole !== "client") {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
    }
  }

  return res
}

export const config = {
  matcher: ["/admin/:path*", "/cliente/:path*"],
}
