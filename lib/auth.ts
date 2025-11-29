import { createClient as createClientClient } from "@/lib/supabase/client"

// Client-side authentication functions
export async function getCurrentUser() {
  const supabase = createClientClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase.from("user_profiles").select("*, client:clients(*)").eq("id", user.id).single()

  return { user, profile }
}

export async function signIn(email: string, password: string) {
  const supabase = createClientClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { data, error }
  }

  // Fetch user profile to get the role and first_login status
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role, first_login")
    .eq("id", data.user?.id)
    .single()

  if (profileError) {
    console.error("Error fetching user profile after sign in:", profileError)
    return { data, error: profileError }
  }

  return { data: { ...data, profile }, error }
}

export async function signOut() {
  const supabase = createClientClient()
  const { error } = await supabase.auth.signOut()
  return { error }
}

// Password reset functions
export async function sendPasswordResetEmail(email: string) {
  const supabase = createClientClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
  })
  return { error }
}

export async function resetPassword(password: string) {
  const supabase = createClientClient()
  const { data, error } = await supabase.auth.updateUser({
    password: password
  })
  return { data, error }
}

export async function signInWithMagicLink(email: string) {
  const supabase = createClientClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/confirm?next=/dashboard`,
    },
  })
  return { error }
}
