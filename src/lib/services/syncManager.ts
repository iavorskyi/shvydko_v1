import { db } from "@/lib/db";
import { api } from "./api";

class SyncManager {
  private syncing = false;
  private registered = false;

  async syncPendingChanges(): Promise<void> {
    if (this.syncing || !api.isOnline()) return;
    this.syncing = true;

    try {
      // ── 1. Process sync queue (sessions, achievements, reading progress) ──
      const pendingQueue = await db.syncQueue.toArray();

      if (pendingQueue.length > 0) {
        const sessions = pendingQueue
          .filter((q) => q.table === "trainingSessions")
          .map((q) => ({ localId: q.localId, ...q.data }));

        const achievements = pendingQueue
          .filter((q) => q.table === "achievements")
          .map((q) => ({ localId: q.localId, ...q.data }));

        const progressItems = pendingQueue
          .filter((q) => q.table === "readingProgress")
          .map((q) => ({ localId: q.localId, ...q.data }));

        const payload: Record<string, unknown> = {};
        if (sessions.length > 0) payload.sessions = sessions;
        if (achievements.length > 0) payload.achievements = achievements;
        if (progressItems.length > 0) payload.readingProgress = progressItems;

        if (Object.keys(payload).length > 0) {
          const response = await api.post<{
            mappings: Array<{ localId: number; serverId: string; table: string }>;
          }>("/sync", payload);

          for (const mapping of response.mappings) {
            try {
              await db.table(mapping.table).update(mapping.localId, {
                serverId: mapping.serverId,
                pendingSync: false,
                syncedAt: new Date(),
              });
            } catch {
              // Ignore if local record was already cleaned up
            }
          }

          const processedIds = pendingQueue.map((q) => q.id!).filter(Boolean);
          await db.syncQueue.bulkDelete(processedIds);
        }
      }

      // ── 2. Sync pending PDF texts (individually, they can be large) ──
      try {
        const pendingPdfs = await db.texts
          .filter((t) => t.pendingSync === true && t.source === "pdf" && !t.serverId)
          .toArray();

        for (const pdfText of pendingPdfs) {
          try {
            const serverText = await api.post<{ id: string }>("/texts/upload", {
              title: pdfText.title,
              content: pdfText.content,
              wordCount: pdfText.wordCount,
              outline: pdfText.outline,
              pageWordOffsets: pdfText.pageWordOffsets,
            });

            await db.texts.update(pdfText.id!, {
              serverId: serverText.id,
              pendingSync: false,
            });
          } catch {
            console.warn(`Failed to sync PDF text: ${pdfText.title}`);
          }
        }
      } catch {
        // Ignore PDF sync errors
      }
    } catch (error) {
      console.warn("Sync failed, will retry:", error);
    } finally {
      this.syncing = false;
    }
  }

  registerListeners(): void {
    if (typeof window === "undefined" || this.registered) return;
    this.registered = true;

    window.addEventListener("online", () => {
      this.syncPendingChanges();
    });

    // Also listen for service worker sync messages
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "SYNC_REQUESTED") {
          this.syncPendingChanges();
        }
      });
    }
  }
}

export const syncManager = new SyncManager();
