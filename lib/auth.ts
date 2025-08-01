import { supabase } from "./supabase"

export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase.from("user_profiles").select("*, client:clients(*)").eq("id", user.id).single()

  return { user, profile }
}

export async function signIn(email: string, password: string) {
  console.log("Attempting to sign in with password...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("signInWithPassword error:", error);
    return { data, error };
  }
  console.log("signInWithPassword successful. Data:", data);

  let profileData = null;
  let profileError = null;

  try {
    // Attempt to fetch user profile after successful sign-in
    const { data: fetchedProfile, error: fetchError } = await supabase
      .from("user_profiles")
      .select("role") // Only select the role
      .eq("id", data.user.id)
      .single();

    if (fetchError) {
      // If the error is 'PGRST116' (no rows found), attempt to create a default profile
      if (fetchError.code === 'PGRST116') {
        console.warn("User profile not found, attempting to create a default profile.");

        const { data: newProfile, error: createProfileError } = await supabase
          .from("user_profiles")
          .insert({
            id: data.user.id,
            role: "client", // Default role for new users
          })
          .select("role")
          .single(); // Select the role back to attach to user

        if (createProfileError) {
          console.error("Error creating default user profile:", createProfileError);
          return { data: null, error: createProfileError }; // Return this error if profile creation fails
        }
        console.log("Default user profile created:", newProfile);
        profileData = newProfile;
      } else {
        // If it's another type of error, return it
        console.error("Error fetching user profile:", fetchError);
        return { data: null, error: fetchError };
      }
    } else {
      console.log("User profile fetched:", fetchedProfile);
      profileData = fetchedProfile;
    }
  } catch (e) {
    console.error("Unhandled error during profile fetching/creation:", e);
    return { data: null, error: { message: "An unexpected error occurred during profile handling." } };
  }

  // Attach the profile to the user object
  if (data.user) {
    data.user.profile = profileData;
  }
  console.log("Final signIn data before return:", data);
  return { data, error: null };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function createClientUser(clientData: {
  nombre: string
  email: string
  telefono?: string
  documento: string
  direccion?: string
}) {
  // First create the client
  const { data: client, error: clientError } = await supabase.from("clients").insert(clientData).select().single()

  if (clientError) throw clientError

  // Create auth user with temporary password
  const tempPassword = Math.random().toString(36).slice(-8)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: clientData.email,
    password: tempPassword,
    email_confirm: true,
  })

  if (authError) throw authError

  // Create user profile linking to client
  const { error: profileError } = await supabase.from("user_profiles").insert({
    id: authData.user.id,
    client_id: client.id,
    role: "client",
  })

  if (profileError) throw profileError

  return { client, tempPassword }
}
