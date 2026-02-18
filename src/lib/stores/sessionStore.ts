import { create } from "zustand";
import { db } from "@/lib/db";
import { api } from "@/lib/services/api";
import type { TrainingSession, DailyGoal } from "@/types";

interface SessionState {
  todaySessions: TrainingSession[];
  dailyGoals: DailyGoal[];
  streak: number;
  sessionSaveCount: number;
  lastSessionUserId: string | null;

  loadTodayData: (userId: string) => Promise<void>;
  saveSession: (session: Omit<TrainingSession, "id">) => Promise<number>;
  getDailyGoals: (userId: string) => Promise<DailyGoal[]>;
  updateGoalProgress: (userId: string, goalType: string) => Promise<void>;
  calculateStreak: (userId: string) => Promise<number>;
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

  loadTodayData: async (userId: string) => {
    const todayStart = getTodayStart();

    // Load from IndexedDB cache
    const sessions = await db.trainingSessions
      .where("userId")
      .equals(userId)
      .filter((s) => new Date(s.date) >= todayStart)
      .toArray();

    const goals = await get().getDailyGoals(userId);
    const streak = await get().calculateStreak(userId);

    set({ todaySessions: sessions, dailyGoals: goals, streak });

    // Refresh from server in background
    if (api.isOnline()) {
      try {
        const serverSessions = await api.get<TrainingSession[]>("/sessions/today");
        // We trust server data — update cache
        set({ todaySessions: serverSessions });
      } catch {
        // Use cached data
      }

      try {
        const serverGoals = await api.get<DailyGoal[]>("/goals/today");
        set({ dailyGoals: serverGoals });
      } catch {
        // Use cached data
      }
    }
  },

  saveSession: async (session) => {
    // Save to local IndexedDB immediately
    const localSession = { ...session, pendingSync: true };
    const id = await db.trainingSessions.add(localSession as TrainingSession);

    set((state) => ({
      todaySessions: [...state.todaySessions, { ...session, id }],
      lastSessionUserId: session.userId,
      sessionSaveCount: state.sessionSaveCount + 1,
    }));

    // Sync to server
    if (api.isOnline()) {
      try {
        const serverSession = await api.post<{ id: string }>("/sessions", {
          sessionType: session.sessionType,
          date: session.date,
          duration: session.duration,
          result: session.result,
          score: session.score,
          speed: session.speed,
          comprehension: session.comprehension,
        });
        // Update local with server ID
        await db.trainingSessions.update(id, {
          serverId: serverSession.id,
          pendingSync: false,
          syncedAt: new Date(),
        });

        // Also trigger server-side achievement check
        try {
          await api.post("/achievements/check");
        } catch {
          // Non-critical
        }
      } catch {
        // Failed — add to sync queue for later
        await db.syncQueue.add({
          table: "trainingSessions",
          operation: "create",
          localId: id,
          data: session as unknown as Record<string, unknown>,
          createdAt: new Date(),
        });
      }
    } else {
      // Offline — queue for sync
      await db.syncQueue.add({
        table: "trainingSessions",
        operation: "create",
        localId: id,
        data: session as unknown as Record<string, unknown>,
        createdAt: new Date(),
      });
    }

    // Update local goals
    await get().updateGoalProgress(session.userId, session.sessionType);

    // Update minutes goal locally
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

  getDailyGoals: async (userId: string) => {
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

  updateGoalProgress: async (userId: string, goalType: string) => {
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

    if (goalType === "rsvp" || goalType === "test" || goalType === "longread") {
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
        if ((goalType === "rsvp" || goalType === "test" || goalType === "longread") && g.goalType === "texts")
          return { ...g, achieved: g.achieved + 1 };
        return g;
      }),
    }));
  },

  calculateStreak: async (userId: string) => {
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
