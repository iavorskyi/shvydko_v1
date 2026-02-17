"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Sun, Moon, Monitor, Type, Bell, BellOff, Volume2, VolumeX,
  Shield, Users, ChevronRight, Trash2, Info
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/lib/stores/userStore";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { cn } from "@/lib/utils/cn";
import AppShell from "@/components/layout/AppShell";

const AVATARS = ["🦉", "🦊", "🐱", "🐶", "🦁", "🐼", "🐰", "🦋"];

export default function SettingsPage() {
  const router = useRouter();
  const { currentUser, users, setCurrentUser, deleteUser } = useUserStore();
  const { settings, updateSettings, toggleTheme } = useSettingsStore();

  const [showProfiles, setShowProfiles] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

  if (!currentUser || !settings) return null;

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
              {AVATARS[currentUser.avatarId] || "🦉"}
            </div>
            <div className="flex-1">
              <h3 className="font-bold">{currentUser.name}</h3>
              <p className="text-sm text-gray-500">
                {currentUser.age} років, {currentUser.schoolClass} клас
              </p>
            </div>
          </div>
        </motion.div>

        {/* Profiles */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="card mb-4"
        >
          <button
            onClick={() => setShowProfiles(!showProfiles)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Users size={20} className="text-gray-500" />
              <span className="font-medium">Профілі</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">{users.length}/5</span>
              <ChevronRight
                size={18}
                className={cn("transition-transform", showProfiles && "rotate-90")}
              />
            </div>
          </button>

          {showProfiles && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              className="mt-3 space-y-2 overflow-hidden"
            >
              {users.map((user) => (
                <div
                  key={user.id}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-xl transition-all",
                    user.id === currentUser.id
                      ? "bg-primary/5"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  )}
                >
                  <button
                    onClick={() => {
                      if (user.id !== currentUser.id) setCurrentUser(user);
                    }}
                    className="flex items-center gap-3 flex-1"
                  >
                    <span className="text-xl">
                      {AVATARS[user.avatarId] || "🦉"}
                    </span>
                    <span className="text-sm font-medium">{user.name}</span>
                    {user.id === currentUser.id && (
                      <span className="text-[10px] bg-primary text-white px-2 py-0.5 rounded-full">
                        Активний
                      </span>
                    )}
                  </button>
                  {users.length > 1 && (
                    <button
                      onClick={() => setShowDeleteConfirm(user.id!)}
                      className="p-1.5 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}

              {users.length < 5 && (
                <button
                  onClick={() => router.push("/onboarding")}
                  className="w-full p-2 text-sm text-primary font-medium text-center rounded-xl hover:bg-primary/5"
                >
                  + Додати профіль
                </button>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* Appearance */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
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
          transition={{ delay: 0.15 }}
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
          transition={{ delay: 0.2 }}
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
          transition={{ delay: 0.25 }}
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

        {/* Delete confirm modal */}
        {showDeleteConfirm !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full"
            >
              <h3 className="font-bold text-lg mb-2">Видалити профіль?</h3>
              <p className="text-sm text-gray-500 mb-4">
                Всі дані профілю будуть видалені. Цю дію неможливо скасувати.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="btn-secondary flex-1"
                >
                  Скасувати
                </button>
                <button
                  onClick={() => {
                    deleteUser(showDeleteConfirm);
                    setShowDeleteConfirm(null);
                  }}
                  className="flex-1 bg-red-500 text-white rounded-2xl px-6 py-3 font-semibold active:scale-95"
                >
                  Видалити
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
