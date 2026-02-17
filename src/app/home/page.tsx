"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, Grid3X3, Zap, ClipboardCheck, BookOpen, Flame, Target, Clock } from "lucide-react";
import { useUserStore } from "@/lib/stores/userStore";
import { useSessionStore } from "@/lib/stores/sessionStore";
import { getLevelInfo } from "@/lib/utils/scoring";
import { cn } from "@/lib/utils/cn";
import AppShell from "@/components/layout/AppShell";

const AVATARS = ["🦉", "🦊", "🐱", "🐶", "🦁", "🐼", "🐰", "🦋"];

const EXERCISES = [
  {
    href: "/exercises/peripheral",
    icon: Eye,
    label: "Поле зору",
    color: "bg-blue-500",
    lightBg: "bg-blue-50 dark:bg-blue-500/10",
  },
  {
    href: "/exercises/schulte",
    icon: Grid3X3,
    label: "Таблиці Шульте",
    color: "bg-amber-500",
    lightBg: "bg-amber-50 dark:bg-amber-500/10",
  },
  {
    href: "/exercises/rsvp",
    icon: Zap,
    label: "RSVP Читання",
    color: "bg-green-500",
    lightBg: "bg-green-50 dark:bg-green-500/10",
  },
  {
    href: "/library",
    icon: ClipboardCheck,
    label: "Тексти & Тести",
    color: "bg-purple-500",
    lightBg: "bg-purple-50 dark:bg-purple-500/10",
  },
];

const GOAL_LABELS: Record<string, { label: string; icon: typeof Target }> = {
  sessions: { label: "Тренувань", icon: Target },
  minutes: { label: "Хвилин", icon: Clock },
  texts: { label: "Текстів", icon: BookOpen },
};

export default function HomePage() {
  const router = useRouter();
  const { currentUser } = useUserStore();
  const { todaySessions, dailyGoals, streak, loadTodayData, sessionSaveCount } = useSessionStore();
  const [levelInfo, setLevelInfo] = useState(getLevelInfo(0));
  const { getTotalPoints } = useUserStore();

  useEffect(() => {
    if (currentUser?.id) {
      loadTodayData(currentUser.id);
      getTotalPoints().then((pts) => setLevelInfo(getLevelInfo(pts)));
    }
  }, [currentUser?.id, loadTodayData, getTotalPoints, sessionSaveCount]);

  if (!currentUser) return null;

  const completedGoals = dailyGoals.filter((g) => g.achieved >= g.target).length;

  return (
    <AppShell>
      <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary-light/20 flex items-center justify-center text-2xl">
              {AVATARS[currentUser.avatarId] || "🦉"}
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Привіт! 👋</p>
              <h1 className="text-xl font-bold">{currentUser.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {streak > 0 && (
              <div className="flex items-center gap-1 bg-orange-50 dark:bg-orange-500/10 text-orange-600 px-3 py-1.5 rounded-full text-sm font-semibold">
                <Flame size={16} />
                {streak}
              </div>
            )}
          </div>
        </motion.div>

        {/* Level progress */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card mb-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-primary dark:text-primary-light">
              {levelInfo.title}
            </span>
            <span className="text-sm text-gray-500">Рівень {levelInfo.level}</span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${levelInfo.progress * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full bg-primary dark:bg-primary-light rounded-full"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {levelInfo.totalPoints} балів
            {levelInfo.nextLevelPoints && ` / ${levelInfo.nextLevelPoints}`}
          </p>
        </motion.div>

        {/* Daily goals */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card mb-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Щоденні завдання</h3>
            <span className="text-xs bg-primary/10 text-primary dark:text-primary-light px-2 py-1 rounded-full font-medium">
              {completedGoals}/{dailyGoals.length}
            </span>
          </div>
          <div className="space-y-2.5">
            {dailyGoals.map((goal) => {
              const info = GOAL_LABELS[goal.goalType];
              const Icon = info?.icon || Target;
              const progress = Math.min(1, goal.achieved / goal.target);
              const done = goal.achieved >= goal.target;
              return (
                <div key={goal.id} className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      done
                        ? "bg-green-100 text-green-600 dark:bg-green-500/10"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-700"
                    )}
                  >
                    {done ? "✓" : <Icon size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className={done ? "line-through text-gray-400" : ""}>
                        {goal.achieved}/{goal.target} {info?.label}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          done ? "bg-green-500" : "bg-primary"
                        )}
                        style={{ width: `${progress * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Exercises grid */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="font-semibold mb-3">Тренування</h3>
          <div className="grid grid-cols-2 gap-3">
            {EXERCISES.map((ex, i) => {
              const Icon = ex.icon;
              return (
                <motion.button
                  key={ex.href}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.25 + i * 0.05 }}
                  onClick={() => router.push(ex.href)}
                  className="card-interactive flex flex-col items-center py-6 gap-3"
                >
                  <div
                    className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center text-white",
                      ex.color
                    )}
                  >
                    <Icon size={28} />
                  </div>
                  <span className="text-sm font-medium text-center">{ex.label}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Today's stats */}
        {todaySessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card mt-4"
          >
            <h3 className="font-semibold mb-2">Сьогодні</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-2.5">
                <div className="text-lg font-bold">{todaySessions.length}</div>
                <div className="text-[10px] text-gray-500">Сесій</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-2.5">
                <div className="text-lg font-bold">
                  {Math.round(
                    todaySessions.reduce((s, t) => s + (t.duration || 0), 0) / 60
                  )}
                </div>
                <div className="text-[10px] text-gray-500">Хвилин</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-2.5">
                <div className="text-lg font-bold text-primary">
                  +{todaySessions.reduce((s, t) => s + (t.score || 0), 0)}
                </div>
                <div className="text-[10px] text-gray-500">Балів</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Motivation */}
        {todaySessions.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card mt-4 bg-gradient-to-br from-primary/5 to-primary-light/10 border-primary/10"
          >
            <p className="text-sm text-center text-gray-600 dark:text-gray-400">
              ✨ Давай потренуємось! Обери вправу і почни тренування
            </p>
          </motion.div>
        )}
      </div>
    </AppShell>
  );
}
