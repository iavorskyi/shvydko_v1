"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useUserStore } from "@/lib/stores/userStore";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { useSessionStore } from "@/lib/stores/sessionStore";
import { useAchievements } from "@/lib/hooks/useAchievements";
import { seedDatabase, restoreUserPdfTexts } from "@/lib/db/seed";
import { syncManager } from "@/lib/services/syncManager";
import BottomNav from "./BottomNav";

const NO_NAV_ROUTES = ["/", "/onboarding", "/auth/login", "/auth/register"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { setUser } = useUserStore();
  const { loadSettings } = useSettingsStore();
  const { loadTodayData, lastSessionUserId, sessionSaveCount } = useSessionStore();
  const { checkAchievements } = useAchievements();

  const seededRef = useRef(false);
  const prevSaveCountRef = useRef(0);
  const syncInitRef = useRef(false);

  // Seed local DB with texts
  useEffect(() => {
    if (!seededRef.current) {
      seededRef.current = true;
      seedDatabase();
    }
  }, []);

  // Sync NextAuth session to Zustand user store
  useEffect(() => {
    if (status === "loading") return;

    if (session?.user) {
      setUser({
        id: session.user.id,
        email: session.user.email,
        name: session.user.name ?? null,
        age: session.user.age ?? null,
        schoolClass: session.user.schoolClass ?? null,
        avatarId: session.user.avatarId ?? null,
        onboarded: session.user.onboarded ?? false,
      });
    } else {
      setUser(null);
    }
  }, [session, status, setUser]);

  // Routing logic
  useEffect(() => {
    if (status === "loading") return;

    const isAuthPage = pathname.startsWith("/auth");

    if (!session && !isAuthPage && pathname !== "/") {
      router.replace("/auth/login");
      return;
    }

    if (session && !session.user.onboarded && pathname !== "/onboarding") {
      router.replace("/onboarding");
      return;
    }

    if (session && session.user.onboarded && (pathname === "/" || pathname === "/onboarding" || isAuthPage)) {
      router.replace("/home");
    }
  }, [status, session, pathname, router]);

  // Load settings and today's data
  useEffect(() => {
    if (session?.user?.id && session.user.onboarded) {
      loadSettings(session.user.id);
      loadTodayData(session.user.id);
      restoreUserPdfTexts();
    }
  }, [session?.user?.id, session?.user?.onboarded, loadSettings, loadTodayData]);

  // Initialize sync manager
  useEffect(() => {
    if (session?.user?.id && !syncInitRef.current) {
      syncInitRef.current = true;
      syncManager.registerListeners();
      syncManager.syncPendingChanges();
    }
  }, [session?.user?.id]);

  // Check achievements whenever a new session is saved
  useEffect(() => {
    if (sessionSaveCount > prevSaveCountRef.current && lastSessionUserId) {
      checkAchievements(lastSessionUserId);
    }
    prevSaveCountRef.current = sessionSaveCount;
  }, [sessionSaveCount, lastSessionUserId, checkAchievements]);

  const showNav =
    !NO_NAV_ROUTES.includes(pathname) &&
    !pathname.startsWith("/auth") &&
    session?.user?.onboarded;

  if (status === "loading") {
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
