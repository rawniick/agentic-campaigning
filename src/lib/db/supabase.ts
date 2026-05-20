import { createClient } from "@supabase/supabase-js";

// Browser-Client (mit Anon-Key, RLS-geschuetzt)
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase URL und Anon Key muessen gesetzt sein");
  }

  return createClient(url, key);
}

// Service-Role-Client (umgeht RLS, fuer Server-Actions ohne User-Session)
// Wirft Fehler wenn kein Service Role Key gesetzt — nutze getServerClient() als sichere Alternative
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key || key === "PASTE_FROM_DASHBOARD") {
    throw new Error("Supabase Service Role Key nicht gesetzt");
  }

  return createClient(url, key);
}

// Legacy-Alias
export function createServerClient() {
  return createServiceRoleClient();
}

// Async Server-Client: Service Role Key falls vorhanden, sonst Cookie-basierter Auth-Client
// Sicher in API Routes, Server Actions und Server Components
export async function getServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Service Role Key vorhanden → nutzen (umgeht RLS)
  if (url && key && key !== "PASTE_FROM_DASHBOARD") {
    return createClient(url, key);
  }

  // Fallback: Cookie-basierter Auth-Client (braucht Auth-Session)
  const { createClient: createSSRClient } = await import("@/lib/supabase/server");
  return createSSRClient();
}

export type SupabaseClient = ReturnType<typeof createBrowserClient>;
