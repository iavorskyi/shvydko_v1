import { db } from "@/lib/db";
import type { Achievement, TrainingSession } from "@/types";
import { BADGES } from "@/types";

export interface AchievementCheckResult {
  newAchievements: string[];
}

export async function checkAchievements(userId: number): Promise<AchievementCheckResult> {
  const existingAchievements = await db.achievements
    .where("userId")
    .equals(userId)
    .toArray();

  const earned = new Set(existingAchievements.map((a) => a.badgeType));
  const sessions = await db.trainingSessions
    .where("userId")
    .equals(userId)
    .toArray();

  const newAchievements: string[] = [];

  async function grant(type: string) {
    if (earned.has(type)) return;
    await db.achievements.add({
      userId,
      badgeType: type,
      earnedAt: new Date(),
    });
    newAchievements.push(type);
    earned.add(type);
  }

  // first_session: First training session
  if (sessions.length >= 1) {
    await grant("first_session");
  }

  // first_text: First text read via RSVP
  const rsvpSessions = sessions.filter((s) => s.sessionType === "rsvp");
  if (rsvpSessions.length >= 1) {
    await grant("first_text");
  }

  // speed_300: Reading speed 300 wpm
  if (rsvpSessions.some((s) => (s.speed || 0) >= 300)) {
    await grant("speed_300");
  }

  // speed_600: Reading speed 600 wpm
  if (rsvpSessions.some((s) => (s.speed || 0) >= 600)) {
    await grant("speed_600");
  }

  // speed_1000: Reading speed 1000 wpm
  if (rsvpSessions.some((s) => (s.speed || 0) >= 1000)) {
    await grant("speed_1000");
  }

  // streak_7: 7-day streak
  const streak = await calculateStreakForAchievements(sessions);
  if (streak >= 7) {
    await grant("streak_7");
  }

  // daily_streak_30: 30-day streak
  if (streak >= 30) {
    await grant("daily_streak_30");
  }

  // texts_50: Read 50 texts
  if (rsvpSessions.length >= 50) {
    await grant("texts_50");
  }

  // texts_100: Read 100 texts
  if (rsvpSessions.length >= 100) {
    await grant("texts_100");
  }

  // schulte_10: 10 Schulte tables completed
  const schulteSessions = sessions.filter((s) => s.sessionType === "schulte");
  if (schulteSessions.length >= 10) {
    await grant("schulte_10");
  }

  // schulte_fast: 5x5 table in 30 seconds
  if (
    schulteSessions.some((s) => {
      const result = s.result as Record<string, unknown>;
      return result.gridSize === 5 && (result.timeMs as number) <= 30000;
    })
  ) {
    await grant("schulte_fast");
  }

  // accuracy_95: 95%+ comprehension in 20 tests
  const testSessions = sessions.filter(
    (s) => s.sessionType === "test" && (s.comprehension || 0) >= 95
  );
  if (testSessions.length >= 20) {
    await grant("accuracy_95");
  }

  // perfect_100: 100 tests with 100% comprehension
  const perfectTests = sessions.filter(
    (s) => s.sessionType === "test" && s.comprehension === 100
  );
  if (perfectTests.length >= 100) {
    await grant("perfect_100");
  }

  // all_exercises: All exercise types completed
  const exerciseTypes = new Set(sessions.map((s) => s.sessionType));
  if (
    exerciseTypes.has("peripheral") &&
    exerciseTypes.has("schulte") &&
    exerciseTypes.has("rsvp") &&
    exerciseTypes.has("test")
  ) {
    await grant("all_exercises");
  }

  // level_100: Reach level 100
  const totalPoints = sessions.reduce((sum, s) => sum + (s.score || 0), 0);
  if (totalPoints >= 15000 + 50 * 300) {
    // Level 100 = 50 + ceil((pts-15000)/300) >= 100 → pts >= 30000
    await grant("level_100");
  }

  return { newAchievements };
}

function calculateStreakForAchievements(sessions: TrainingSession[]): number {
  if (sessions.length === 0) return 0;

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
}

export function getAchievementInfo(type: string) {
  return BADGES[type] || null;
}
