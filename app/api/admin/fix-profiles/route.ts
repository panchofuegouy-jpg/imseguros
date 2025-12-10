import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth-server";

// Helper for secure password generation
function generateSecurePassword(length = 16): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  for (let i = 0; i < length; i++) {
    password += charset[values[i] % charset.length];
  }
  return password + "1!";
}

export async function POST(request: NextRequest) {
  try {
    // 1. Security Check
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.profile?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // 2. Parse Query Params
    const searchParams = request.nextUrl.searchParams;
    const dryRun = searchParams.get("dryRun") !== "false"; // Default true
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const sendEmails = searchParams.get("sendEmails") === "true"; // Default false

    const adminSupabase = createAdminClient();

    // 3. Fetch Data
    // Get all clients
    const { data: clients, error: clientsError } = await adminSupabase
      .from("clients")
      .select("id, email, nombre, documento, numero_cliente");
    
    if (clientsError) throw new Error(`Error fetching clients: ${clientsError.message}`);

    // Get all user_profiles
    const { data: profiles, error: profilesError } = await adminSupabase
      .from("user_profiles")
      .select("client_id, id");

    if (profilesError) throw new Error(`Error fetching profiles: ${profilesError.message}`);

    // Fetch all Auth users to build Email -> ID map
    // Note: This might be heavy if there are thousands of users, but necessary for conflict detection
    const authUsersMap = new Map<string, string>(); // Email -> ID
    let page = 1;
    let hasMore = true;
    const perPage = 50;

    while (hasMore) {
      const { data: { users }, error: usersError } = await adminSupabase.auth.admin.listUsers({
        page: page,
        perPage: perPage,
      });
      
      if (usersError) throw new Error(`Error fetching auth users: ${usersError.message}`);
      
      if (!users || users.length === 0) {
        hasMore = false;
      } else {
        users.forEach(u => {
          if (u.email) authUsersMap.set(u.email.toLowerCase(), u.id);
        });
        if (users.length < perPage) hasMore = false;
        page++;
      }
    }

    // 4. Identify Orphans
    const profileClientIds = new Set(profiles?.map(p => p.client_id));
    const profileAuthIds = new Set(profiles?.map(p => p.id));
    
    // Map Auth ID -> Client ID (to detect conflicts)
    const authIdToClientId = new Map<string, string>();
    profiles?.forEach(p => authIdToClientId.set(p.id, p.client_id));

    const orphans = clients?.filter(c => !profileClientIds.has(c.id)) || [];

    const summary = {
      dryRun,
      limit,
      totalOrphansFound: orphans.length,
      processed: 0,
      createdProfiles: 0,
      linkedProfiles: 0,
      skippedNoEmail: 0,
      conflicts: 0,
      errors: 0,
      emailsSent: 0,
    };

    const details: any[] = [];

    // 5. Process Batch
    const batch = orphans.slice(0, limit);
    summary.processed = batch.length;

    for (const client of batch) {
      const detail = {
        clientId: client.id,
        email: client.email,
        action: "pending",
        reason: "",
        authUserId: null as string | null,
      };

      try {
        // Validation
        if (!client.email || !/.+@.+\..+/.test(client.email)) {
          detail.action = "skipped_no_email";
          detail.reason = "Invalid or missing email";
          summary.skippedNoEmail++;
          details.push(detail);
          continue;
        }

        const normalizedEmail = client.email.toLowerCase();
        const existingAuthId = authUsersMap.get(normalizedEmail);

        if (existingAuthId) {
          // Scenario A: User Exists in Auth
          detail.authUserId = existingAuthId;
          
          const existingLinkId = authIdToClientId.get(existingAuthId);
          
          if (existingLinkId) {
            // CONFLICT: User already linked to another client
            detail.action = "conflict";
            detail.reason = `User already linked to client ${existingLinkId}`;
            summary.conflicts++;
          } else {
            // LINK: User exists but has no profile
            detail.action = dryRun ? "would_link" : "linked";
            detail.reason = "User exists in Auth, creating profile";
            
            if (!dryRun) {
              const { error: linkError } = await adminSupabase
                .from("user_profiles")
                .insert({
                  id: existingAuthId,
                  client_id: client.id,
                  role: "client",
                  first_login: true,
                });
                
              if (linkError) throw linkError;
              summary.linkedProfiles++;
              
              // Send Email if requested (and not dryRun)
              if (sendEmails) {
                 // For linked users, we might NOT want to send a welcome email with a temp password
                 // because we don't know their password.
                 // We should probably send a "Account Linked" email or just skip?
                 // User request said: "Invoca tu Edge Function... para disparar Resend."
                 // But we can't send tempPassword for existing user.
                 // So we skip email for Linked users or send a different one.
                 // Let's skip for safety and log it.
                 detail.reason += " (Email skipped for existing user)";
              }
            } else {
               summary.linkedProfiles++; // Count as if it would happen
            }
          }
        } else {
          // Scenario B: User Does Not Exist
          detail.action = dryRun ? "would_create" : "created";
          detail.reason = "Creating new Auth user and profile";
          
          if (!dryRun) {
            const tempPassword = generateSecurePassword();
            
            // Create Auth User
            const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
              email: client.email,
              password: tempPassword,
              email_confirm: true,
              user_metadata: {
                full_name: client.nombre
              }
            });

            if (authError) throw new Error(`Auth create failed: ${authError.message}`);
            
            const newUserId = authData.user.id;
            detail.authUserId = newUserId;

            // Create Profile
            const { error: profileError } = await adminSupabase
              .from("user_profiles")
              .insert({
                id: newUserId,
                client_id: client.id,
                role: "client",
                first_login: true,
              });

            if (profileError) {
              // ROLLBACK Auth User
              await adminSupabase.auth.admin.deleteUser(newUserId);
              throw new Error(`Profile create failed (Rolled back Auth): ${profileError.message}`);
            }
            
            summary.createdProfiles++;

            // Send Email
            if (sendEmails) {
              try {
                const { data: functionData, error: functionError } = await adminSupabase.functions.invoke('send-welcome-email', {
                  body: {
                    email: client.email,
                    nombre: client.nombre,
                    tempPassword: tempPassword
                  }
                });

                if (functionError || !functionData?.success) {
                  detail.reason += " (Profile created, Email FAILED)";
                  console.error(`Email failed for ${client.email}:`, functionError || functionData);
                } else {
                  summary.emailsSent++;
                  detail.reason += " (Email sent)";
                }
              } catch (emailErr) {
                 detail.reason += " (Profile created, Email EXCEPTION)";
                 console.error(`Email exception for ${client.email}:`, emailErr);
              }
            }
          } else {
            summary.createdProfiles++;
            if (sendEmails) summary.emailsSent++;
          }
        }
        
        details.push(detail);

      } catch (err: any) {
        detail.action = "error";
        detail.reason = err.message;
        summary.errors++;
        details.push(detail);
        console.error(`Error processing client ${client.id}:`, err);
      }
    }

    return NextResponse.json({
      summary,
      details
    });

  } catch (error: any) {
    console.error("Migration script fatal error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
