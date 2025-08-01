import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
