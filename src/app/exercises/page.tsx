"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Eye, Grid3X3, Zap, ClipboardCheck, BookOpen, Trophy, ArrowRight, Clock, Target, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/lib/stores/userStore";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils/cn";
import AppShell from "@/components/layout/AppShell";

const EXERCISES = [
  {
    href: "/exercises/peripheral",
    icon: Eye,
    label: "Поле зору",
    description: "Тренуй периферійний зір та швидкість сприйняття слів",
    color: "bg-blue-500",
    lightBg: "bg-blue-50 dark:bg-blue-500/10",
    textColor: "text-blue-600 dark:text-blue-400",
  },
  {
    href: "/exercises/schulte",
    icon: Grid3X3,
    label: "Таблиці Шульте",
    description: "Знаходь числа по порядку якнайшвидше",
    color: "bg-amber-500",
    lightBg: "bg-amber-50 dark:bg-amber-500/10",
    textColor: "text-amber-600 dark:text-amber-400",
  },
  {
    href: "/exercises/rsvp",
    icon: Zap,
    label: "RSVP Читання",
    description: "Читай тексти на високій швидкості з ORP підсвіткою",
    color: "bg-green-500",
    lightBg: "bg-green-50 dark:bg-green-500/10",
    textColor: "text-green-600 dark:text-green-400",
  },
  {
    href: "/exercises/longread",
    icon: BookOpen,
    label: "Довге читання",
    description: "Читай повні тексти з підсвіткою слів на заданій швидкості",
    color: "bg-teal-500",
    lightBg: "bg-teal-50 dark:bg-teal-500/10",
    textColor: "text-teal-600 dark:text-teal-400",
  },
  {
    href: "/exercises/pdfread",
    icon: FileText,
    label: "PDF Читання",
    description: "Читай PDF файли з трекером прогресу та регульованою швидкістю",
    color: "bg-orange-500",
    lightBg: "bg-orange-50 dark:bg-orange-500/10",
    textColor: "text-orange-600 dark:text-orange-400",
  },
  {
    href: "/library",
    icon: ClipboardCheck,
    label: "Тексти & Тести",
    description: "Обери текст для читання та перевір розуміння",
    color: "bg-purple-500",
    lightBg: "bg-purple-50 dark:bg-purple-500/10",
    textColor: "text-purple-600 dark:text-purple-400",
  },
];

export default function ExercisesPage() {
  const router = useRouter();
  const { currentUser } = useUserStore();
  const [stats, setStats] = useState<Record<string, { count: number; totalTime: number }>>({});

  useEffect(() => {
    if (!currentUser?.id) return;

    db.trainingSessions
      .where("userId")
      .equals(currentUser.id)
      .toArray()
      .then((sessions) => {
        const grouped: Record<string, { count: number; totalTime: number }> = {};
        sessions.forEach((s) => {
          if (!grouped[s.sessionType]) {
            grouped[s.sessionType] = { count: 0, totalTime: 0 };
          }
          grouped[s.sessionType].count++;
          grouped[s.sessionType].totalTime += s.duration || 0;
        });
        setStats(grouped);
      });
  }, [currentUser?.id]);

  return (
    <AppShell>
      <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-bold">Вправи</h1>
          <p className="text-sm text-gray-500 mt-1">
            Обери вправу для тренування
          </p>
        </motion.div>

        <div className="space-y-3">
          {EXERCISES.map((ex, i) => {
            const Icon = ex.icon;
            const statKey = ex.href.includes("peripheral") ? "peripheral" :
                           ex.href.includes("schulte") ? "schulte" :
                           ex.href.includes("longread") ? "longread" :
                           ex.href.includes("pdfread") ? "pdfread" :
                           ex.href.includes("rsvp") ? "rsvp" : "test";
            const stat = stats[statKey];
            return (
              <motion.button
                key={ex.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                onClick={() => router.push(ex.href)}
                className="card-interactive w-full flex items-center gap-4"
              >
                <div
                  className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0",
                    ex.color
                  )}
                >
                  <Icon size={28} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <h3 className="font-bold text-base">{ex.label}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                    {ex.description}
                  </p>
                  {stat && (
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-[10px] text-gray-400">
                        <Target size={10} />
                        {stat.count} сесій
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-gray-400">
                        <Clock size={10} />
                        {Math.round(stat.totalTime / 60)} хв
                      </span>
                    </div>
                  )}
                </div>
                <ArrowRight size={18} className="text-gray-400 shrink-0" />
              </motion.button>
            );
          })}
        </div>

        {/* Tips card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card mt-6 bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20 border-primary/20"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Trophy size={20} />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-primary dark:text-primary-light">
                Порада дня
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Тренуйся щодня по 15 хвилин для найкращого результату. Комбінуй різні типи вправ для максимального ефекту!
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AppShell>
  );
}
