import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    cookieOptions: {
      domain: 'localhost', // For development. Change to your production domain (e.g., '.yourdomain.com') for deployment.
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production', // Use secure in production
    },
  },
})
console.log("Supabase client initialized with cookieOptions:", supabase.auth.api.cookieOptions);

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string
          nombre: string
          email: string
          telefono: string | null
          documento: string
          direccion: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          email: string
          telefono?: string | null
          documento: string
          direccion?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          email?: string
          telefono?: string | null
          documento?: string
          direccion?: string | null
          created_at?: string
        }
      }
      companies: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      policies: {
        Row: {
          id: string
          client_id: string
          company_id: string | null // New field for company association
          numero_poliza: string
          tipo: string
          vigencia_inicio: string
          vigencia_fin: string
          archivo_url: string | null
          notas: string | null
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          company_id?: string | null // New field for company association
          numero_poliza: string
          tipo: string
          vigencia_inicio: string
          vigencia_fin: string
          archivo_url?: string | null
          notas?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          company_id?: string | null // New field for company association
          numero_poliza?: string
          tipo?: string
          vigencia_inicio?: string
          vigencia_fin?: string
          archivo_url?: string | null
          notas?: string | null
          created_at?: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          client_id: string | null
          role: string
          created_at: string
        }
        Insert: {
          id: string
          client_id?: string | null
          role?: string
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string | null
          role?: string
          created_at?: string
        }
      }
    }
  }
}
