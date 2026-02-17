"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Lock, Unlock, Clock, BarChart3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/lib/stores/userStore";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { db } from "@/lib/db";
import { formatDuration } from "@/lib/utils/scoring";
import { cn } from "@/lib/utils/cn";
import AppShell from "@/components/layout/AppShell";

export default function ParentPage() {
  const router = useRouter();
  const { currentUser } = useUserStore();
  const { settings, updateSettings } = useSettingsStore();

  const [isLocked, setIsLocked] = useState(true);
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [error, setError] = useState("");
  const [weekStats, setWeekStats] = useState<{ day: string; sessions: number; minutes: number }[]>([]);

  useEffect(() => {
    if (!settings?.parentPin) {
      setIsLocked(false);
      setIsSettingPin(true);
    }
  }, [settings]);

  useEffect(() => {
    if (!currentUser?.id || isLocked) return;

    const now = new Date();
    const weekData: { day: string; sessions: number; minutes: number }[] = [];
    const days = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);

      weekData.push({
        day: days[d.getDay()],
        sessions: 0,
        minutes: 0,
      });
    }

    db.trainingSessions
      .where("userId")
      .equals(currentUser.id)
      .toArray()
      .then((sessions) => {
        sessions.forEach((s) => {
          const sDate = new Date(s.date);
          for (let i = 0; i < weekData.length; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() - (6 - i));
            if (sDate.toDateString() === d.toDateString()) {
              weekData[i].sessions++;
              weekData[i].minutes += Math.round((s.duration || 0) / 60);
            }
          }
        });
        setWeekStats(weekData);
      });
  }, [currentUser?.id, isLocked]);

  const handleUnlock = () => {
    if (pin === settings?.parentPin) {
      setIsLocked(false);
      setError("");
    } else {
      setError("Невірний PIN-код");
      setPin("");
    }
  };

  const handleSetPin = async () => {
    if (newPin.length !== 4) {
      setError("PIN повинен бути 4 цифри");
      return;
    }
    await updateSettings({ parentPin: newPin, parentControlEnabled: true });
    setIsSettingPin(false);
    setError("");
  };

  if (isLocked && settings?.parentPin) {
    return (
      <AppShell>
        <div className="max-w-lg mx-auto px-4 pt-4 min-h-screen flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
              <ArrowLeft size={22} />
            </button>
            <h1 className="text-lg font-bold">Батьківський контроль</h1>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center">
            <Lock size={48} className="text-gray-400 mb-4" />
            <h2 className="text-xl font-bold mb-2">Введіть PIN-код</h2>
            <p className="text-sm text-gray-500 mb-6">
              Цей розділ захищений PIN-кодом
            </p>

            <div className="flex gap-3 mb-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "w-12 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-bold",
                    pin.length > i
                      ? "border-primary bg-primary/5"
                      : "border-gray-300 dark:border-gray-600"
                  )}
                >
                  {pin.length > i ? "•" : ""}
                </div>
              ))}
            </div>

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

            <div className="grid grid-cols-3 gap-2 w-56">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "del"].map((key) => {
                if (key === null) return <div key="empty" />;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      if (key === "del") {
                        setPin((p) => p.slice(0, -1));
                      } else {
                        const newP = pin + key;
                        setPin(newP);
                        if (newP.length === 4) {
                          setTimeout(() => {
                            if (newP === settings?.parentPin) {
                              setIsLocked(false);
                            } else {
                              setError("Невірний PIN-код");
                              setPin("");
                            }
                          }, 200);
                        }
                      }
                    }}
                    className="w-16 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 font-semibold text-lg active:bg-gray-200 dark:active:bg-gray-700"
                  >
                    {key === "del" ? "←" : key}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-lg mx-auto px-4 pt-4 pb-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-lg font-bold flex-1">Батьківський контроль</h1>
          <Unlock size={18} className="text-green-500" />
        </div>

        {isSettingPin ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card mb-4">
            <h3 className="font-semibold mb-3">Встановіть PIN-код</h3>
            <p className="text-sm text-gray-500 mb-3">
              Створіть 4-значний PIN для захисту батьківського контролю
            </p>
            <input
              type="password"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              placeholder="0000"
              className="w-full text-center text-2xl tracking-[1em] px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:border-primary"
            />
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            <button onClick={handleSetPin} className="btn-primary w-full mt-4">
              Зберегти PIN
            </button>
          </motion.div>
        ) : (
          <>
            {/* Week stats */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card mb-4"
            >
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <BarChart3 size={18} />
                Активність за тиждень
              </h3>
              <div className="flex items-end justify-between gap-1 h-32">
                {weekStats.map((day, i) => {
                  const maxMins = Math.max(...weekStats.map((d) => d.minutes), 1);
                  const height = (day.minutes / maxMins) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-gray-500">{day.minutes}хв</span>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-t-lg relative" style={{ height: "80px" }}>
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${height}%` }}
                          transition={{ delay: i * 0.1, duration: 0.5 }}
                          className="absolute bottom-0 w-full bg-primary dark:bg-primary-light rounded-t-lg"
                        />
                      </div>
                      <span className="text-[10px] text-gray-400">{day.day}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* PIN management */}
            <div className="card mb-4">
              <button
                onClick={() => {
                  setIsSettingPin(true);
                  setNewPin("");
                }}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Lock size={20} className="text-gray-500" />
                  <span>Змінити PIN-код</span>
                </div>
                <span className="text-sm text-gray-400">••••</span>
              </button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
