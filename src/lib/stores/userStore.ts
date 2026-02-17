import { create } from "zustand";
import { db } from "@/lib/db";
import type { User } from "@/types";

interface UserState {
  currentUser: User | null;
  users: User[];
  isLoading: boolean;
  isOnboarded: boolean;

  loadUsers: () => Promise<void>;
  setCurrentUser: (user: User) => void;
  createUser: (user: Omit<User, "id" | "createdAt" | "lastLogin">) => Promise<User>;
  updateUser: (id: number, updates: Partial<User>) => Promise<void>;
  deleteUser: (id: number) => Promise<void>;
  getTotalPoints: () => Promise<number>;
  getLevel: () => Promise<number>;
}

export const useUserStore = create<UserState>((set, get) => ({
  currentUser: null,
  users: [],
  isLoading: true,
  isOnboarded: false,

  loadUsers: async () => {
    try {
      const users = await db.users.toArray();
      const lastUserId = localStorage.getItem("lastUserId");
      const currentUser = lastUserId
        ? users.find((u) => u.id === Number(lastUserId)) || users[0] || null
        : users[0] || null;

      if (currentUser?.id) {
        await db.users.update(currentUser.id, { lastLogin: new Date() });
      }

      set({
        users,
        currentUser,
        isOnboarded: users.length > 0,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  setCurrentUser: (user) => {
    if (user.id) {
      localStorage.setItem("lastUserId", String(user.id));
    }
    set({ currentUser: user });
  },

  createUser: async (userData) => {
    const user: User = {
      ...userData,
      createdAt: new Date(),
      lastLogin: new Date(),
    };
    const id = await db.users.add(user);
    const created = { ...user, id };
    localStorage.setItem("lastUserId", String(id));

    const defaultSettings = {
      userId: id,
      theme: "light" as const,
      fontSize: 16,
      reminderEnabled: false,
      reminderTime: "18:00",
      soundEnabled: true,
      parentControlEnabled: false,
      parentPin: "",
    };
    await db.settings.add(defaultSettings);

    set((state) => ({
      users: [...state.users, created],
      currentUser: created,
      isOnboarded: true,
    }));
    return created;
  },

  updateUser: async (id, updates) => {
    await db.users.update(id, updates);
    set((state) => ({
      users: state.users.map((u) => (u.id === id ? { ...u, ...updates } : u)),
      currentUser:
        state.currentUser?.id === id
          ? { ...state.currentUser, ...updates }
          : state.currentUser,
    }));
  },

  deleteUser: async (id) => {
    await db.users.delete(id);
    await db.settings.delete(id);
    await db.trainingSessions.where("userId").equals(id).delete();
    await db.achievements.where("userId").equals(id).delete();
    await db.dailyGoals.where("userId").equals(id).delete();

    set((state) => {
      const users = state.users.filter((u) => u.id !== id);
      return {
        users,
        currentUser: state.currentUser?.id === id ? users[0] || null : state.currentUser,
        isOnboarded: users.length > 0,
      };
    });
  },

  getTotalPoints: async () => {
    const user = get().currentUser;
    if (!user?.id) return 0;
    const sessions = await db.trainingSessions
      .where("userId")
      .equals(user.id)
      .toArray();
    return sessions.reduce((sum, s) => sum + (s.score || 0), 0);
  },

  getLevel: async () => {
    const points = await get().getTotalPoints();
    if (points <= 1000) return Math.max(1, Math.ceil(points / 100));
    if (points <= 5000) return 10 + Math.ceil((points - 1000) / 266);
    if (points <= 15000) return 25 + Math.ceil((points - 5000) / 400);
    return Math.min(100, 50 + Math.ceil((points - 15000) / 300));
  },
}));
