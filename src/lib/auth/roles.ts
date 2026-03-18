// RBAC — Rollen-basierte Zugriffskontrolle
// Rollen: marketing, creative, legal, admin

import { getServerClient } from "@/lib/db/supabase";

export type UserRole = "marketing" | "creative" | "legal" | "admin";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
}

// Berechtigungen pro Rolle
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  marketing: [
    "campaign:create", "campaign:read", "campaign:edit",
    "concept:generate", "concept:feedback",
    "translation:generate",
    "asset:generate", "asset:read",
    "export:start",
  ],
  creative: [
    "campaign:read",
    "concept:read",
    "asset:read", "asset:approve", "asset:reject", "asset:regenerate",
  ],
  legal: [
    "campaign:read",
    "concept:read", "concept:approve", "concept:reject",
    "translation:read", "translation:approve", "translation:reject",
    "compliance:review",
  ],
  admin: ["*"], // Alle Berechtigungen
};

// Berechtigungen pro ApprovalStage
const STAGE_REVIEWERS: Record<string, UserRole[]> = {
  concept: ["legal", "admin"],
  draft_concept: ["legal", "admin"],
  detail_concept: ["legal", "admin"],
  translations: ["legal", "admin"],
  assets: ["creative", "admin"],
};

// Profil des aktuellen Users laden
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const db = await getServerClient();
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  return data as UserProfile;
}

// Pruefen ob User eine Berechtigung hat
export function hasPermission(role: UserRole, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  if (permissions.includes("*")) return true;
  return permissions.includes(permission);
}

// Pruefen ob User eine bestimmte Stage reviewen darf
export function canReviewStage(role: UserRole, stage: string): boolean {
  const allowed = STAGE_REVIEWERS[stage];
  if (!allowed) return false;
  return allowed.includes(role);
}

// Rolle-Validierung + Fehler werfen
export async function requireRole(userId: string, ...allowedRoles: UserRole[]): Promise<UserProfile> {
  const profile = await getUserProfile(userId);
  if (!profile) {
    throw new Error("Benutzerprofil nicht gefunden");
  }

  if (profile.role === "admin") return profile; // Admin darf alles

  if (!allowedRoles.includes(profile.role)) {
    throw new Error(`Zugriff verweigert. Erforderliche Rolle: ${allowedRoles.join(" oder ")}`);
  }

  return profile;
}

// Berechtigung pruefen + Fehler werfen
export async function requirePermission(userId: string, permission: string): Promise<UserProfile> {
  const profile = await getUserProfile(userId);
  if (!profile) {
    throw new Error("Benutzerprofil nicht gefunden");
  }

  if (!hasPermission(profile.role, permission)) {
    throw new Error(`Zugriff verweigert. Fehlende Berechtigung: ${permission}`);
  }

  return profile;
}
