import { create } from "zustand";
import { db } from "@/lib/db";
import type { TrainingSession, DailyGoal } from "@/types";
import { POINTS } from "@/types";

interface SessionState {
  todaySessions: TrainingSession[];
  dailyGoals: DailyGoal[];
  streak: number;
  sessionSaveCount: number;
  lastSessionUserId: number | null;

  loadTodayData: (userId: number) => Promise<void>;
  saveSession: (session: Omit<TrainingSession, "id">) => Promise<number>;
  getDailyGoals: (userId: number) => Promise<DailyGoal[]>;
  updateGoalProgress: (userId: number, goalType: string) => Promise<void>;
  calculateStreak: (userId: number) => Promise<number>;
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function getTodayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  todaySessions: [],
  dailyGoals: [],
  streak: 0,
  sessionSaveCount: 0,
  lastSessionUserId: null,

  loadTodayData: async (userId: number) => {
    const todayStart = getTodayStart();
    const sessions = await db.trainingSessions
      .where("userId")
      .equals(userId)
      .filter((s) => new Date(s.date) >= todayStart)
      .toArray();

    const goals = await get().getDailyGoals(userId);
    const streak = await get().calculateStreak(userId);

    set({ todaySessions: sessions, dailyGoals: goals, streak });
  },

  saveSession: async (session) => {
    const id = await db.trainingSessions.add(session as TrainingSession);

    set((state) => ({
      todaySessions: [...state.todaySessions, { ...session, id }],
      lastSessionUserId: session.userId,
      sessionSaveCount: state.sessionSaveCount + 1,
    }));

    await get().updateGoalProgress(session.userId, session.sessionType);

    // Update minutes goal
    const today = getToday();
    const goals = await db.dailyGoals
      .where("userId")
      .equals(session.userId)
      .filter((g) => g.date === today)
      .toArray();

    const minuteGoal = goals.find((g) => g.goalType === "minutes");
    if (minuteGoal?.id) {
      const addedMinutes = Math.max(1, Math.round(session.duration / 60));
      await db.dailyGoals.update(minuteGoal.id, {
        achieved: minuteGoal.achieved + addedMinutes,
      });
      set((state) => ({
        dailyGoals: state.dailyGoals.map((g) =>
          g.goalType === "minutes"
            ? { ...g, achieved: g.achieved + addedMinutes }
            : g
        ),
      }));
    }

    // Recalculate streak
    const streak = await get().calculateStreak(session.userId);
    set({ streak });

    return id;
  },

  getDailyGoals: async (userId: number) => {
    const today = getToday();
    let goals = await db.dailyGoals
      .where("userId")
      .equals(userId)
      .filter((g) => g.date === today)
      .toArray();

    if (goals.length === 0) {
      const newGoals: Omit<DailyGoal, "id">[] = [
        { userId, date: today, goalType: "sessions", target: 3, achieved: 0 },
        { userId, date: today, goalType: "minutes", target: 15, achieved: 0 },
        { userId, date: today, goalType: "texts", target: 2, achieved: 0 },
      ];
      for (const g of newGoals) {
        await db.dailyGoals.add(g as DailyGoal);
      }
      goals = await db.dailyGoals
        .where("userId")
        .equals(userId)
        .filter((g) => g.date === today)
        .toArray();
    }

    return goals;
  },

  updateGoalProgress: async (userId: number, goalType: string) => {
    const today = getToday();
    const goals = await db.dailyGoals
      .where("userId")
      .equals(userId)
      .filter((g) => g.date === today)
      .toArray();

    const sessionGoal = goals.find((g) => g.goalType === "sessions");
    if (sessionGoal?.id) {
      await db.dailyGoals.update(sessionGoal.id, {
        achieved: sessionGoal.achieved + 1,
      });
    }

    if (goalType === "rsvp" || goalType === "test") {
      const textGoal = goals.find((g) => g.goalType === "texts");
      if (textGoal?.id) {
        await db.dailyGoals.update(textGoal.id, {
          achieved: textGoal.achieved + 1,
        });
      }
    }

    set((state) => ({
      dailyGoals: state.dailyGoals.map((g) => {
        if (g.goalType === "sessions") return { ...g, achieved: g.achieved + 1 };
        if ((goalType === "rsvp" || goalType === "test") && g.goalType === "texts")
          return { ...g, achieved: g.achieved + 1 };
        return g;
      }),
    }));
  },

  calculateStreak: async (userId: number) => {
    const sessions = await db.trainingSessions
      .where("userId")
      .equals(userId)
      .reverse()
      .sortBy("date");

    if (sessions.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i <= 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dayStart = new Date(checkDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(checkDate);
      dayEnd.setHours(23, 59, 59, 999);

      const hasSession = sessions.some((s) => {
        const d = new Date(s.date);
        return d >= dayStart && d <= dayEnd;
      });

      if (hasSession) {
        streak++;
      } else if (i === 0) {
        continue;
      } else {
        break;
      }
    }

    return streak;
  },
}));
