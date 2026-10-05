import { createClient } from "@supabase/supabase-js";

// Cliente con service_role key: solo se usa en el backend, nunca en la app Expo.
// Ignora RLS por diseño (documentado en el modelo de datos del proyecto).
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);