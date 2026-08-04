"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  Tags,
  Warehouse,
  ShoppingCart,
  Settings,
  Store,
  Users,
  TicketPercent,
  Award,
  FileText,
  BarChart3,
  LayoutList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/logo";

const LINKS = [
  { href: "/admin", label: "Хяналтын самбар", icon: LayoutDashboard },
  { href: "/admin/products", label: "Бараа", icon: Boxes },
  { href: "/admin/scent-families", label: "Үнэрийн төрөл", icon: Tags },
  { href: "/admin/inventory", label: "Үлдэгдэл", icon: Warehouse },
  { href: "/admin/orders", label: "Захиалга", icon: ShoppingCart },
  { href: "/admin/customers", label: "Хэрэглэгч", icon: Users },
  { href: "/admin/promotions", label: "Урамшуулал", icon: TicketPercent },
  { href: "/admin/loyalty", label: "V point", icon: Award },
  { href: "/admin/content", label: "Контент", icon: FileText },
  { href: "/admin/home-sections", label: "Нүүрийн хэсэг", icon: LayoutList },
  { href: "/admin/reports", label: "Тайлан", icon: BarChart3 },
  { href: "/admin/settings", label: "Тохиргоо", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="bg-card print:hidden lg:w-60 lg:shrink-0">
      <div className="flex h-16 items-center px-6">
        <Logo />
        <span className="ml-2 text-xs font-medium text-muted-foreground">
          admin
        </span>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0">
        {LINKS.map((l) => {
          const active =
            l.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "flex shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <l.icon className="size-4" />
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto hidden p-3 lg:block">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Store className="size-4" />
          Дэлгүүр рүү буцах
        </Link>
      </div>
    </aside>
  );
}
