import { LEVELS, POINTS } from "@/types";
import type { ExerciseType } from "@/types";

const EXERCISE_POINTS: Record<ExerciseType, number> = {
  peripheral: POINTS.peripheral,
  schulte: POINTS.schulte,
  rsvp: POINTS.rsvp,
  test: POINTS.test_perfect,
};

export function getPointsForExercise(type: ExerciseType, extra?: { comprehension?: number }): number {
  if (type === "test" && extra?.comprehension === 100) {
    return POINTS.test_perfect;
  }
  return EXERCISE_POINTS[type] || 10;
}

export function getLevelInfo(totalPoints: number) {
  const level = calculateLevel(totalPoints);
  const current = LEVELS.find(
    (l) => totalPoints >= l.minPoints && totalPoints <= l.maxPoints
  ) || LEVELS[0];

  const pointsInLevel = totalPoints - current.minPoints;
  const levelRange = Math.min(current.maxPoints, 100000) - current.minPoints;
  const progress = Math.min(1, pointsInLevel / levelRange);

  return {
    level,
    title: current.name,
    progress,
    totalPoints,
    nextLevelPoints: current.maxPoints === Infinity ? null : current.maxPoints,
  };
}

function calculateLevel(points: number): number {
  if (points <= 1000) return Math.max(1, Math.ceil(points / 100));
  if (points <= 5000) return 10 + Math.ceil((points - 1000) / 266);
  if (points <= 15000) return 25 + Math.ceil((points - 5000) / 400);
  return Math.min(100, 50 + Math.ceil((points - 15000) / 300));
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} сек`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins} хв ${secs} сек` : `${mins} хв`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours} год ${remainMins} хв`;
}

export function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("uk-UA", {
    day: "numeric",
    month: "long",
  });
}
