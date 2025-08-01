import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs"
import { NextResponse } from "next/server"
git remote set-url origin https://panchofuegouy-jpg@github.com/panchofuegouy-jpg/imseguros.gitimport type { NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  console.log("Middleware: NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("Middleware: NEXT_PUBLIC_SUPABASE_ANON_KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const supabase = createMiddlewareClient({
    req,
    res,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    cookieOptions: {
      domain: 'localhost', // Explicitly localhost for dev
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      sameSite: 'Lax', // Explicitly Lax
      secure: false, // Explicitly false for development (HTTP)
    },
  })

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
