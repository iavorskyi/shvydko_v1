import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface SyncPayload {
  sessions?: Array<{
    localId: number;
    sessionType: string;
    date: string;
    duration: number;
    result: Record<string, unknown>;
    score: number;
    speed?: number;
    comprehension?: number;
  }>;
  achievements?: Array<{
    localId: number;
    badgeType: string;
    earnedAt: string;
  }>;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const payload: SyncPayload = await request.json();
    const mappings: Array<{ localId: number; serverId: string; table: string }> = [];

    // Sync sessions
    if (payload.sessions) {
      for (const s of payload.sessions) {
        const created = await prisma.trainingSession.create({
          data: {
            userId,
            sessionType: s.sessionType,
            date: new Date(s.date),
            duration: s.duration,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            result: s.result as any,
            score: s.score,
            speed: s.speed,
            comprehension: s.comprehension,
          },
        });
        mappings.push({
          localId: s.localId,
          serverId: created.id,
          table: "trainingSessions",
        });
      }
    }

    // Sync achievements
    if (payload.achievements) {
      for (const a of payload.achievements) {
        try {
          const created = await prisma.achievement.upsert({
            where: {
              userId_badgeType: { userId, badgeType: a.badgeType },
            },
            update: {},
            create: {
              userId,
              badgeType: a.badgeType,
              earnedAt: new Date(a.earnedAt),
            },
          });
          mappings.push({
            localId: a.localId,
            serverId: created.id,
            table: "achievements",
          });
        } catch {
          // Skip duplicates
        }
      }
    }

    return NextResponse.json({ mappings, synced: true });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
