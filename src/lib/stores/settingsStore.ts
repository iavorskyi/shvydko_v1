import { create } from "zustand";
import { db } from "@/lib/db";
import { api } from "@/lib/services/api";
import type { UserSettings } from "@/types";

interface SettingsState {
  settings: UserSettings | null;
  isLoading: boolean;

  loadSettings: (userId: string) => Promise<void>;
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const DEFAULT_SETTINGS: Omit<UserSettings, "userId"> = {
  theme: "light",
  fontSize: 16,
  reminderEnabled: false,
  reminderTime: "18:00",
  soundEnabled: true,
  parentControlEnabled: false,
  parentPin: "",
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  isLoading: true,

  loadSettings: async (userId: string) => {
    try {
      // Try to load from local cache first
      let settings = await db.settings.get(userId);

      // Try server if online
      if (api.isOnline()) {
        try {
          const serverSettings = await api.get<UserSettings>("/settings");
          settings = { ...serverSettings, userId };
          await db.settings.put(settings);
        } catch {
          // Use cached version
        }
      }

      if (!settings) {
        settings = { userId, ...DEFAULT_SETTINGS };
        await db.settings.add(settings);
      }

      set({ settings, isLoading: false });
      applyTheme(settings.theme);
    } catch {
      set({ isLoading: false });
    }
  },

  updateSettings: async (updates) => {
    const { settings } = get();
    if (!settings) return;

    const updated = { ...settings, ...updates };
    await db.settings.put(updated);
    set({ settings: updated });

    if (updates.theme) {
      applyTheme(updates.theme);
    }

    // Sync to server
    if (api.isOnline()) {
      try {
        await api.put("/settings", updates);
      } catch {
        // Will sync later
      }
    }
  },

  toggleTheme: async () => {
    const { settings, updateSettings } = get();
    if (!settings) return;
    const next = settings.theme === "light" ? "dark" : "light";
    await updateSettings({ theme: next });
  },
}));

function applyTheme(theme: string) {
  if (typeof window === "undefined") return;
  const root = document.documentElement;

  if (theme === "auto") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
  } else {
    root.classList.toggle("dark", theme === "dark");
  }
}
