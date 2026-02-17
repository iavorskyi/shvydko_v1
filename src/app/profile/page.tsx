"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Trophy, Flame, Clock, Target, Zap, BookOpen, TrendingUp, Calendar } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { useUserStore } from "@/lib/stores/userStore";
import { useSessionStore } from "@/lib/stores/sessionStore";
import { db } from "@/lib/db";
import { getLevelInfo, formatDuration } from "@/lib/utils/scoring";
import { BADGES, type TrainingSession, type Achievement } from "@/types";
import { cn } from "@/lib/utils/cn";
import AppShell from "@/components/layout/AppShell";

const AVATARS = ["🦉", "🦊", "🐱", "🐶", "🦁", "🐼", "🐰", "🦋"];
type ChartTab = "speed" | "activity";

function getLast7DaysActivity(sessions: TrainingSession[]) {
  const days = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const now = new Date();
  const data = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(23, 59, 59, 999);

    const daySessions = sessions.filter((s) => {
      const sd = new Date(s.date);
      return sd >= dayStart && sd <= dayEnd;
    });

    const minutes = Math.round(
      daySessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60
    );

    data.push({
      day: days[d.getDay()],
      date: `${d.getDate()}.${d.getMonth() + 1}`,
      minutes,
      sessions: daySessions.length,
    });
  }

  return data;
}

function getSpeedTrend(sessions: TrainingSession[]) {
  const rsvpSessions = sessions
    .filter((s) => s.sessionType === "rsvp" && s.speed)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (rsvpSessions.length === 0) return [];

  const byDay = new Map<string, { speeds: number[]; date: Date }>();
  rsvpSessions.forEach((s) => {
    const key = new Date(s.date).toDateString();
    if (!byDay.has(key)) {
      byDay.set(key, { speeds: [], date: new Date(s.date) });
    }
    byDay.get(key)!.speeds.push(s.speed || 0);
  });

  return Array.from(byDay.entries())
    .map(([, val]) => ({
      date: `${val.date.getDate()}.${val.date.getMonth() + 1}`,
      speed: Math.round(val.speeds.reduce((a, b) => a + b, 0) / val.speeds.length),
    }))
    .slice(-14);
}

export default function ProfilePage() {
  const { currentUser, getTotalPoints } = useUserStore();
  const { streak, sessionSaveCount } = useSessionStore();

  const [levelInfo, setLevelInfo] = useState(getLevelInfo(0));
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalTime: 0,
    avgSpeed: 0,
    avgComprehension: 0,
    textsRead: 0,
  });
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [chartTab, setChartTab] = useState<ChartTab>("activity");

  useEffect(() => {
    if (!currentUser?.id) return;

    getTotalPoints().then((pts) => setLevelInfo(getLevelInfo(pts)));

    db.trainingSessions
      .where("userId")
      .equals(currentUser.id)
      .toArray()
      .then((allSessions) => {
        setSessions(allSessions);
        const totalTime = allSessions.reduce((s, t) => s + (t.duration || 0), 0);
        const rsvpSessions = allSessions.filter((s) => s.sessionType === "rsvp" && s.speed);
        const testSessions = allSessions.filter((s) => s.sessionType === "test" && s.comprehension != null);
        const avgSpeed = rsvpSessions.length > 0
          ? Math.round(rsvpSessions.reduce((s, t) => s + (t.speed || 0), 0) / rsvpSessions.length)
          : 0;
        const avgComprehension = testSessions.length > 0
          ? Math.round(testSessions.reduce((s, t) => s + (t.comprehension || 0), 0) / testSessions.length)
          : 0;

        setStats({
          totalSessions: allSessions.length,
          totalTime,
          avgSpeed,
          avgComprehension,
          textsRead: rsvpSessions.length,
        });
      });

    db.achievements
      .where("userId")
      .equals(currentUser.id)
      .toArray()
      .then(setAchievements);
  }, [currentUser?.id, getTotalPoints, sessionSaveCount]);

  const activityData = useMemo(() => getLast7DaysActivity(sessions), [sessions]);
  const speedData = useMemo(() => getSpeedTrend(sessions), [sessions]);

  if (!currentUser) return null;

  const earnedBadgeTypes = new Set(achievements.map((a) => a.badgeType));

  return (
    <AppShell>
      <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
        {/* User info */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <div className="w-20 h-20 rounded-full bg-primary-light/20 flex items-center justify-center text-4xl mx-auto mb-3">
            {AVATARS[currentUser.avatarId] || "🦉"}
          </div>
          <h1 className="text-xl font-bold">{currentUser.name}</h1>
          <p className="text-sm text-gray-500">{currentUser.schoolClass} клас</p>

          {/* Level */}
          <div className="mt-3 inline-flex items-center gap-2 bg-primary/10 dark:bg-primary-light/10 text-primary dark:text-primary-light px-4 py-2 rounded-full">
            <Trophy size={16} />
            <span className="font-semibold text-sm">
              {levelInfo.title} — Рівень {levelInfo.level}
            </span>
          </div>

          <div className="mt-3 w-full max-w-xs mx-auto">
            <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${levelInfo.progress * 100}%` }}
                transition={{ duration: 1 }}
                className="h-full bg-primary dark:bg-primary-light rounded-full"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {levelInfo.totalPoints} балів
            </p>
          </div>
        </motion.div>

        {/* Stats grid */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-3 mb-6"
        >
          <div className="card text-center">
            <Clock size={20} className="mx-auto mb-1 text-blue-500" />
            <div className="text-lg font-bold">{formatDuration(stats.totalTime)}</div>
            <div className="text-xs text-gray-500">Загальний час</div>
          </div>
          <div className="card text-center">
            <Target size={20} className="mx-auto mb-1 text-green-500" />
            <div className="text-lg font-bold">{stats.totalSessions}</div>
            <div className="text-xs text-gray-500">Тренувань</div>
          </div>
          <div className="card text-center">
            <Zap size={20} className="mx-auto mb-1 text-amber-500" />
            <div className="text-lg font-bold">
              {stats.avgSpeed > 0 ? `${stats.avgSpeed} сл/хв` : "—"}
            </div>
            <div className="text-xs text-gray-500">Сер. швидкість</div>
          </div>
          <div className="card text-center">
            <BookOpen size={20} className="mx-auto mb-1 text-purple-500" />
            <div className="text-lg font-bold">
              {stats.avgComprehension > 0 ? `${stats.avgComprehension}%` : "—"}
            </div>
            <div className="text-xs text-gray-500">Розуміння</div>
          </div>
          <div className="card text-center col-span-2">
            <Flame size={20} className="mx-auto mb-1 text-orange-500" />
            <div className="text-lg font-bold">{streak} днів</div>
            <div className="text-xs text-gray-500">Серія тренувань</div>
          </div>
        </motion.div>

        {/* Charts */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl flex-1">
              <button
                onClick={() => setChartTab("activity")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all",
                  chartTab === "activity"
                    ? "bg-white dark:bg-gray-600 shadow-sm text-primary dark:text-primary-light"
                    : "text-gray-500"
                )}
              >
                <Calendar size={14} />
                Активність
              </button>
              <button
                onClick={() => setChartTab("speed")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all",
                  chartTab === "speed"
                    ? "bg-white dark:bg-gray-600 shadow-sm text-primary dark:text-primary-light"
                    : "text-gray-500"
                )}
              >
                <TrendingUp size={14} />
                Швидкість
              </button>
            </div>
          </div>

          {chartTab === "activity" ? (
            <div className="h-48">
              {activityData.some((d) => d.minutes > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      width={30}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #e5e7eb",
                        fontSize: "12px",
                      }}
                      formatter={(value) => [`${value} хв`, "Час"]}
                      labelFormatter={(label) => `${label}`}
                    />
                    <Bar
                      dataKey="minutes"
                      fill="#6750A4"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  <div className="text-center">
                    <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                    <p>Поки немає даних</p>
                    <p className="text-xs mt-1">Почни тренуватися!</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-48">
              {speedData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={speedData}>
                    <defs>
                      <linearGradient id="speedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6750A4" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6750A4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #e5e7eb",
                        fontSize: "12px",
                      }}
                      formatter={(value) => [`${value} сл/хв`, "Швидкість"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="speed"
                      stroke="#6750A4"
                      strokeWidth={2}
                      fill="url(#speedGradient)"
                      dot={{ fill: "#6750A4", r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  <div className="text-center">
                    <TrendingUp size={32} className="mx-auto mb-2 opacity-50" />
                    <p>Поки немає даних</p>
                    <p className="text-xs mt-1">Пройди RSVP вправу!</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Achievements */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Trophy size={20} className="text-amber-500" />
            Досягнення
            <span className="text-sm font-normal text-gray-500">
              {earnedBadgeTypes.size}/{Object.keys(BADGES).length}
            </span>
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(BADGES).map(([type, badge]) => {
              const earned = earnedBadgeTypes.has(type);
              return (
                <motion.div
                  key={type}
                  whileHover={earned ? { scale: 1.05 } : undefined}
                  className={cn(
                    "card text-center p-3 transition-all",
                    earned ? "" : "opacity-40 grayscale"
                  )}
                >
                  <div className="text-2xl mb-1">{badge.icon}</div>
                  <div className="text-[10px] font-semibold leading-tight">{badge.name}</div>
                  {earned && (
                    <div className="text-[8px] text-gray-400 mt-0.5">Отримано!</div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </AppShell>
  );
}
