import { createClient } from "@/lib/supabase/server";

// Auth-User aus Session holen (fuer API Routes + Server Actions)
export async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
