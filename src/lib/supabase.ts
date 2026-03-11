import { createClient } from "@supabase/supabase-js";

// Função para retornar uma instância segura no lado do servidor
export const createServerSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn("Supabase credentials not found. Ensure environment variables are set.");
  }

  return createClient(supabaseUrl, supabaseServiceKey);
};
