import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const existingAchievements = await prisma.achievement.findMany({
    where: { userId },
    select: { badgeType: true },
  });
  const earned = new Set(existingAchievements.map((a: { badgeType: string }) => a.badgeType));

  const sessions = await prisma.trainingSession.findMany({
    where: { userId },
  });

  const newAchievements: string[] = [];

  async function grant(type: string) {
    if (earned.has(type)) return;
    try {
      await prisma.achievement.create({
        data: { userId, badgeType: type, earnedAt: new Date() },
      });
      newAchievements.push(type);
      earned.add(type);
    } catch {
      // Ignore duplicate key errors
    }
  }

  // first_session
  if (sessions.length >= 1) await grant("first_session");

  const rsvpSessions = sessions.filter((s) => s.sessionType === "rsvp");
  if (rsvpSessions.length >= 1) await grant("first_text");
  if (rsvpSessions.some((s) => (s.speed || 0) >= 300)) await grant("speed_300");
  if (rsvpSessions.some((s) => (s.speed || 0) >= 600)) await grant("speed_600");
  if (rsvpSessions.some((s) => (s.speed || 0) >= 1000)) await grant("speed_1000");
  if (rsvpSessions.length >= 50) await grant("texts_50");
  if (rsvpSessions.length >= 100) await grant("texts_100");

  // Streak
  const streak = calculateStreak(sessions.map((s) => s.date));
  if (streak >= 7) await grant("streak_7");
  if (streak >= 30) await grant("daily_streak_30");

  // Schulte
  const schulteSessions = sessions.filter((s) => s.sessionType === "schulte");
  if (schulteSessions.length >= 10) await grant("schulte_10");
  if (
    schulteSessions.some((s) => {
      const result = s.result as Record<string, unknown>;
      return result.gridSize === 5 && (result.timeMs as number) <= 30000;
    })
  ) {
    await grant("schulte_fast");
  }

  // Tests
  const testSessions = sessions.filter((s) => s.sessionType === "test");
  const highAccuracy = testSessions.filter((s) => (s.comprehension || 0) >= 95);
  if (highAccuracy.length >= 20) await grant("accuracy_95");
  const perfect = testSessions.filter((s) => s.comprehension === 100);
  if (perfect.length >= 100) await grant("perfect_100");

  // All exercises
  const types = new Set(sessions.map((s) => s.sessionType));
  if (types.has("peripheral") && types.has("schulte") && types.has("rsvp") && types.has("test")) {
    await grant("all_exercises");
  }

  // Level 100
  const totalPoints = sessions.reduce((sum, s) => sum + s.score, 0);
  if (totalPoints >= 30000) await grant("level_100");

  return NextResponse.json({ newAchievements });
}

function calculateStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let streak = 0;
  for (let i = 0; i <= 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dayStart = new Date(checkDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(checkDate);
    dayEnd.setHours(23, 59, 59, 999);

    const hasSession = dates.some((d) => {
      const dt = new Date(d);
      return dt >= dayStart && dt <= dayEnd;
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
}
