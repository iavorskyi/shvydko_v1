import { create } from "zustand";
import { db } from "@/lib/db";
import { api } from "@/lib/services/api";

interface AppUser {
  id: string;
  email: string;
  name: string | null;
  age: number | null;
  schoolClass: number | null;
  avatarId: number | null;
  onboarded: boolean;
}

interface UserState {
  currentUser: AppUser | null;
  isLoading: boolean;
  isOnboarded: boolean;

  setUser: (user: AppUser | null) => void;
  completeOnboarding: (data: {
    name: string;
    age: number;
    schoolClass: number;
    avatarId: number;
  }) => Promise<void>;
  getTotalPoints: () => Promise<number>;
  getLevel: () => Promise<number>;
}

export const useUserStore = create<UserState>((set, get) => ({
  currentUser: null,
  isLoading: true,
  isOnboarded: false,

  setUser: (user) => {
    set({
      currentUser: user,
      isOnboarded: user?.onboarded ?? false,
      isLoading: false,
    });
  },

  completeOnboarding: async (data) => {
    try {
      const result = await api.put<AppUser>("/user/profile", {
        ...data,
        onboarded: true,
      });

      set((state) => ({
        currentUser: state.currentUser
          ? { ...state.currentUser, ...result, onboarded: true }
          : null,
        isOnboarded: true,
      }));
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
      throw error;
    }
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
