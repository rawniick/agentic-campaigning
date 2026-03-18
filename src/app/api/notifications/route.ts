import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { getNotifications, getUnreadCount } from "@/lib/notifications/notify";

// GET /api/notifications — Eigene Notifications laden
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const [notifications, unreadCount] = await Promise.all([
      getNotifications(user.id),
      getUnreadCount(user.id),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
