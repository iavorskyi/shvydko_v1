"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, Dumbbell, BookOpen, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { href: "/home", label: "Головна", icon: Home },
  { href: "/exercises", label: "Вправи", icon: Dumbbell },
  { href: "/library", label: "Бібліотека", icon: BookOpen },
  { href: "/profile", label: "Профіль", icon: BarChart3 },
  { href: "/settings", label: "Ще", icon: Settings },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => {
    if (href === "/exercises") {
      return pathname.startsWith("/exercises");
    }
    return pathname === href || (href !== "/home" && pathname.startsWith(href));
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 safe-bottom">
      <div className="flex items-center justify-around max-w-lg mx-auto h-16">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors",
                active
                  ? "text-primary dark:text-primary-light"
                  : "text-gray-500 dark:text-gray-400"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-16 h-8 rounded-full transition-colors",
                  active && "bg-primary-light/30 dark:bg-primary-light/10"
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              </div>
              <span className="text-[11px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
