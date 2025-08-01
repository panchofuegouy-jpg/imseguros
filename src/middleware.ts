import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  let res = NextResponse.next()

  console.log("Middleware: NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("Middleware: NEXT_PUBLIC_SUPABASE_ANON_KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

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

  // Log all request headers to inspect cookies
  console.log("Middleware: Request Headers:", req.headers);
  console.log("Middleware: Cookie Header (raw):", req.headers.get('cookie'));

  // Refresh session for the user
  // This step is crucial for the middleware to correctly read and update the session cookie
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  console.log("Middleware: Session data after getSession():", session);
  if (sessionError) {
    console.error("Middleware: Error getting session:", sessionError);
  }

  const protectedRoutes = ["/admin", "/cliente"];
  const isProtectedRoute = protectedRoutes.some((route) => req.nextUrl.pathname.startsWith(route));

  // If no session and trying to access protected routes, redirect to login
  if (!session && isProtectedRoute) {
    console.log("Middleware: No session for protected route, redirecting to /login");
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // If session exists, check role for access control
  if (session) {
    console.log("Middleware: Session exists, fetching user profile...");
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profileError || !profile) {
      console.error("Middleware: Error fetching user profile or profile not found:", profileError);
      // If profile not found or error, redirect to login to re-authenticate or handle
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const userRole = profile.role;
    console.log("Middleware: User role:", userRole, "Current path:", req.nextUrl.pathname);

    // Admin access control
    if (req.nextUrl.pathname.startsWith("/admin")) {
      if (userRole !== "admin") {
        console.log("Middleware: Non-admin trying to access /admin, redirecting to /cliente");
        return NextResponse.redirect(new URL("/cliente", req.url)); // Redirect non-admins from admin routes
      }
    }

    // Client access control
    if (req.nextUrl.pathname.startsWith("/cliente")) {
      if (userRole !== "client") {
        console.log("Middleware: Non-client trying to access /cliente, redirecting to /admin");
        return NextResponse.redirect(new URL("/admin", req.url)); // Redirect non-clients from client routes
      }
    }
  }

  return res
}

export const config = {
  matcher: ["/admin/:path*", "/cliente/:path*"],
}
