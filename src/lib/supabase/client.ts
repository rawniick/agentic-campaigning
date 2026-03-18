import { createBrowserClient } from "@supabase/ssr";

// Browser-Client fuer Client Components (mit Anon-Key, RLS-geschuetzt)
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
