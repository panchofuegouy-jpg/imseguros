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

  // The rest of the logic to handle profiles can be simplified or removed
  // if the middleware and other parts of the app correctly handle profile creation.
  return { data, error }
}

export async function signOut() {
  const supabase = createClientClient()
  const { error } = await supabase.auth.signOut()
  return { error }
}
