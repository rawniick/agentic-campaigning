import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Oeffentliche Pfade — kein Auth-Redirect.
// Single-User V1: /signup ist BEWUSST nicht oeffentlich (keine Selbst-
// Registrierung). Die Signup-Seite ist entfernt; das Konto wird im Supabase-
// Dashboard provisioniert. Fuer vollen Schutz dort zusaetzlich "Enable email
// signups" deaktivieren (Code kann den Auth-API-Endpunkt nicht abschalten).
const PUBLIC_PATHS = ["/login", "/auth"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() robust: ein defektes/abgelaufenes Session-Cookie (z.B. aus einem
  // anderen Supabase-Projekt nach Instanz-Wechsel) wirft hier sonst und liesse
  // JEDE Seite mit 500 crashen. Fehler -> als nicht-eingeloggt behandeln
  // (Login-Redirect), statt die ganze App zu killen.
  const authRes = await supabase.auth.getUser().catch(() => null);
  const user = authRes?.data.user ?? null;

  const { pathname } = request.nextUrl;

  // Nicht eingeloggt + geschuetzter Pfad → Redirect zu /login
  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Eingeloggt + auf Login → Redirect zu Dashboard
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
