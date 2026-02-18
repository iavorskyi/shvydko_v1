"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Sun, Moon, Monitor, Type, Bell, BellOff, Volume2, VolumeX,
  Shield, ChevronRight, Info, LogOut
} from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useUserStore } from "@/lib/stores/userStore";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { cn } from "@/lib/utils/cn";
import AppShell from "@/components/layout/AppShell";

const AVATARS = ["🦉", "🦊", "🐱", "🐶", "🦁", "🐼", "🐰", "🦋"];

export default function SettingsPage() {
  const router = useRouter();
  const { currentUser } = useUserStore();
  const { settings, updateSettings } = useSettingsStore();

  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  if (!currentUser || !settings) {
    return (
      <AppShell>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  const themeIcons = {
    light: Sun,
    dark: Moon,
    auto: Monitor,
  };
  const ThemeIcon = themeIcons[settings.theme];

  return (
    <AppShell>
      <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold mb-6">Налаштування</h1>

        {/* Current profile */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card mb-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-primary-light/20 flex items-center justify-center text-3xl">
              {AVATARS[currentUser.avatarId ?? 0] || "🦉"}
            </div>
            <div className="flex-1">
              <h3 className="font-bold">{currentUser.name}</h3>
              <p className="text-sm text-gray-500">
                {currentUser.age} років, {currentUser.schoolClass} клас
              </p>
              <p className="text-xs text-gray-400">{currentUser.email}</p>
            </div>
          </div>
        </motion.div>

        {/* Appearance */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="card mb-4 space-y-4"
        >
          <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide">
            Зовнішній вигляд
          </h3>

          {/* Theme */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ThemeIcon size={20} className="text-gray-500" />
              <span>Тема</span>
            </div>
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
              {(["light", "dark", "auto"] as const).map((t) => {
                const Icon = themeIcons[t];
                return (
                  <button
                    key={t}
                    onClick={() => updateSettings({ theme: t })}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      settings.theme === t
                        ? "bg-white dark:bg-gray-600 shadow-sm"
                        : "text-gray-400"
                    )}
                  >
                    <Icon size={16} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font size */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Type size={20} className="text-gray-500" />
                <span>Розмір шрифту</span>
              </div>
              <span className="text-sm font-semibold">{settings.fontSize}px</span>
            </div>
            <input
              type="range"
              min={12}
              max={24}
              value={settings.fontSize}
              onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>
        </motion.div>

        {/* Notifications */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card mb-4 space-y-4"
        >
          <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide">
            Сповіщення
          </h3>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings.reminderEnabled ? <Bell size={20} className="text-gray-500" /> : <BellOff size={20} className="text-gray-400" />}
              <span>Нагадування</span>
            </div>
            <button
              onClick={() => updateSettings({ reminderEnabled: !settings.reminderEnabled })}
              className={cn(
                "w-12 h-7 rounded-full transition-all relative",
                settings.reminderEnabled ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-full bg-white absolute top-1 transition-all",
                  settings.reminderEnabled ? "left-6" : "left-1"
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings.soundEnabled ? <Volume2 size={20} className="text-gray-500" /> : <VolumeX size={20} className="text-gray-400" />}
              <span>Звуки</span>
            </div>
            <button
              onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
              className={cn(
                "w-12 h-7 rounded-full transition-all relative",
                settings.soundEnabled ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-full bg-white absolute top-1 transition-all",
                  settings.soundEnabled ? "left-6" : "left-1"
                )}
              />
            </button>
          </div>
        </motion.div>

        {/* Parent control */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card mb-4"
        >
          <button
            onClick={() => router.push("/parent")}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Shield size={20} className="text-gray-500" />
              <span>Батьківський контроль</span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
        </motion.div>

        {/* About */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card mb-4"
        >
          <div className="flex items-center gap-3">
            <Info size={20} className="text-gray-500" />
            <div>
              <span className="font-medium">Швидкочитач</span>
              <p className="text-xs text-gray-500">Версія 1.0.0</p>
            </div>
          </div>
        </motion.div>

        {/* Sign Out */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="card mb-4"
        >
          <button
            onClick={() => setShowSignOutConfirm(true)}
            className="w-full flex items-center gap-3 text-red-500"
          >
            <LogOut size={20} />
            <span className="font-medium">Вийти з облікового запису</span>
          </button>
        </motion.div>

        {/* Sign out confirm modal */}
        {showSignOutConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full"
            >
              <h3 className="font-bold text-lg mb-2">Вийти з облікового запису?</h3>
              <p className="text-sm text-gray-500 mb-4">
                Ви зможете увійти знову з тим самим акаунтом. Ваші дані збережуться.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSignOutConfirm(false)}
                  className="btn-secondary flex-1"
                >
                  Скасувати
                </button>
                <button
                  onClick={() => signOut({ callbackUrl: "/auth/login" })}
                  className="flex-1 bg-red-500 text-white rounded-2xl px-6 py-3 font-semibold active:scale-95"
                >
                  Вийти
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
