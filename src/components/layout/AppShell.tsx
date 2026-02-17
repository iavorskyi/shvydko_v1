"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUserStore } from "@/lib/stores/userStore";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { useSessionStore } from "@/lib/stores/sessionStore";
import { useAchievements } from "@/lib/hooks/useAchievements";
import { seedDatabase } from "@/lib/db/seed";
import BottomNav from "./BottomNav";

const NO_NAV_ROUTES = ["/", "/onboarding"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, isLoading, isOnboarded, loadUsers } = useUserStore();
  const { loadSettings } = useSettingsStore();
  const { loadTodayData, lastSessionUserId, sessionSaveCount } = useSessionStore();
  const { checkAchievements } = useAchievements();

  const seededRef = useRef(false);
  const prevSaveCountRef = useRef(0);

  useEffect(() => {
    if (!seededRef.current) {
      seededRef.current = true;
      seedDatabase().then(() => loadUsers());
    }
  }, [loadUsers]);

  useEffect(() => {
    if (isLoading) return;

    if (!isOnboarded && pathname !== "/onboarding") {
      router.replace("/onboarding");
      return;
    }

    if (isOnboarded && (pathname === "/" || pathname === "/onboarding")) {
      router.replace("/home");
    }
  }, [isLoading, isOnboarded, pathname, router]);

  useEffect(() => {
    if (currentUser?.id) {
      loadSettings(currentUser.id);
      loadTodayData(currentUser.id);
    }
  }, [currentUser?.id, loadSettings, loadTodayData]);

  // Check achievements whenever a new session is saved
  useEffect(() => {
    if (sessionSaveCount > prevSaveCountRef.current && lastSessionUserId) {
      checkAchievements(lastSessionUserId);
    }
    prevSaveCountRef.current = sessionSaveCount;
  }, [sessionSaveCount, lastSessionUserId, checkAchievements]);

  const showNav = !NO_NAV_ROUTES.includes(pathname) && isOnboarded;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="text-center text-white">
          <div className="text-6xl mb-4 animate-bounce-in">📖</div>
          <h1 className="text-2xl font-bold">Швидкочитач</h1>
          <p className="text-white/60 text-sm mt-1">Тренуй швидкочитання</p>
          <div className="mt-4 w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <main className={showNav ? "pb-20" : ""}>{children}</main>
      {showNav && <BottomNav />}
    </div>
  );
}
