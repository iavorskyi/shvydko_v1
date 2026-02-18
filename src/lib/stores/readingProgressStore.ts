import { create } from "zustand";
import { db } from "@/lib/db";
import { api } from "@/lib/services/api";
import type { ReadingProgress } from "@/types";

interface ReadingProgressState {
  currentProgress: ReadingProgress | null;

  loadProgress: (userId: string, textId: number) => Promise<ReadingProgress | null>;
  saveProgress: (progress: Omit<ReadingProgress, "id">) => Promise<void>;
  clearProgress: (userId: string, textId: number) => Promise<void>;
  getProgressForLibrary: (userId: string) => Promise<Map<number, ReadingProgress>>;
}

export const useReadingProgressStore = create<ReadingProgressState>((set) => ({
  currentProgress: null,

  loadProgress: async (userId: string, textId: number) => {
    try {
      // Try local first
      const local = await db.readingProgress
        .where("[userId+textId]")
        .equals([userId, textId])
        .first();

      if (local && !local.completed) {
        set({ currentProgress: local });
        return local;
      }

      // Try server
      if (api.isOnline()) {
        try {
          const server = await api.get<ReadingProgress | null>(
            `/reading-progress?textId=${textId}`
          );
          if (server && !server.completed) {
            // Cache locally
            const existing = await db.readingProgress
              .where("[userId+textId]")
              .equals([userId, textId])
              .first();
            if (existing?.id) {
              await db.readingProgress.update(existing.id, server);
            } else {
              await db.readingProgress.add({
                ...server,
                userId,
                textId,
              });
            }
            set({ currentProgress: server });
            return server;
          }
        } catch {
          // Use local
        }
      }

      set({ currentProgress: null });
      return null;
    } catch {
      set({ currentProgress: null });
      return null;
    }
  },

  saveProgress: async (progress) => {
    try {
      // Upsert locally
      const existing = await db.readingProgress
        .where("[userId+textId]")
        .equals([progress.userId, progress.textId])
        .first();

      if (existing?.id) {
        await db.readingProgress.update(existing.id, {
          ...progress,
          updatedAt: new Date(),
        });
      } else {
        await db.readingProgress.add({
          ...progress,
          updatedAt: new Date(),
        });
      }

      set({ currentProgress: { ...progress, updatedAt: new Date() } });

      // Sync to server async
      if (api.isOnline()) {
        try {
          await api.put("/reading-progress", {
            textId: String(progress.textId),
            currentWordIndex: progress.currentWordIndex,
            totalWords: progress.totalWords,
            wpm: progress.wpm,
            fontSize: progress.fontSize,
            elapsedSeconds: progress.elapsedSeconds,
            completed: progress.completed,
          });
        } catch {
          // Will sync later
        }
      }
    } catch (error) {
      console.error("Failed to save reading progress:", error);
    }
  },

  clearProgress: async (userId: string, textId: number) => {
    try {
      const existing = await db.readingProgress
        .where("[userId+textId]")
        .equals([userId, textId])
        .first();

      if (existing?.id) {
        await db.readingProgress.delete(existing.id);
      }

      set({ currentProgress: null });

      if (api.isOnline()) {
        try {
          await api.get(`/reading-progress?textId=${textId}`);
          // Use DELETE method via fetch directly
          await fetch(`/api/reading-progress?textId=${textId}`, {
            method: "DELETE",
            credentials: "include",
          });
        } catch {
          // Non-critical
        }
      }
    } catch (error) {
      console.error("Failed to clear reading progress:", error);
    }
  },

  getProgressForLibrary: async (userId: string) => {
    const progressMap = new Map<number, ReadingProgress>();
    try {
      const allProgress = await db.readingProgress
        .where("userId")
        .equals(userId)
        .filter((p) => !p.completed)
        .toArray();

      for (const p of allProgress) {
        progressMap.set(p.textId, p);
      }
    } catch {
      // Empty map
    }
    return progressMap;
  },
}));
