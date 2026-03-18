"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Megaphone, PlusCircle, Settings, LogOut, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Kampagnen", href: "/campaigns", icon: Megaphone },
  { name: "Neue Kampagne", href: "/campaigns/new", icon: PlusCircle },
  { name: "Brand Brain", href: "/settings/brand-brain", icon: Brain },
];

interface SidebarProps {
  user?: { email?: string };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Megaphone className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold">ACE</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href) &&
              // Kampagnen-Link nicht aktiv wenn auf Sub-Route wie /campaigns/new
              (item.href !== "/campaigns" || pathname === "/campaigns"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer mit User-Info + Logout */}
      <div className="border-t px-3 py-4">
        {user?.email && (
          <p className="mb-2 truncate px-3 text-xs text-sidebar-foreground/50">
            {user.email}
          </p>
        )}
        <div className="flex items-center gap-2">
          <Link
            href="/settings/brand-brain"
            className="flex flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/50 hover:text-sidebar-foreground"
          >
            <Settings className="h-4 w-4" />
            Einstellungen
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/50 hover:text-destructive"
              title="Abmelden"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
