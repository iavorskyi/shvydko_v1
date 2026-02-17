"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, RotateCcw, Settings2, Trophy, Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { useUserStore } from "@/lib/stores/userStore";
import { useSessionStore } from "@/lib/stores/sessionStore";
import { POINTS } from "@/types";
import { cn } from "@/lib/utils/cn";
import AppShell from "@/components/layout/AppShell";

type GridSize = 3 | 4 | 5;

function generateGrid(size: GridSize): number[] {
  const nums = Array.from({ length: size * size }, (_, i) => i + 1);
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  return nums;
}

export default function SchultePage() {
  const router = useRouter();
  const { currentUser } = useUserStore();
  const { saveSession } = useSessionStore();

  const [gridSize, setGridSize] = useState<GridSize>(3);
  const [grid, setGrid] = useState<number[]>([]);
  const [nextNumber, setNextNumber] = useState(1);
  const [gameState, setGameState] = useState<"settings" | "playing" | "done">("settings");
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [errors, setErrors] = useState(0);
  const [clickedCells, setClickedCells] = useState<Set<number>>(new Set());
  const [lastWrong, setLastWrong] = useState<number | null>(null);
  const [bestTimes, setBestTimes] = useState<Record<GridSize, number | null>>({
    3: null,
    4: null,
    5: null,
  });
  const [isNewRecord, setIsNewRecord] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    const saved = localStorage.getItem("schulte_best");
    if (saved) {
      try { setBestTimes(JSON.parse(saved)); } catch {}
    }
  }, []);

  useEffect(() => {
    if (gameState === "playing") {
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startTime);
      }, 50);
    }
    return () => clearInterval(timerRef.current);
  }, [gameState, startTime]);

  const startGame = useCallback(() => {
    setGrid(generateGrid(gridSize));
    setNextNumber(1);
    setErrors(0);
    setClickedCells(new Set());
    setLastWrong(null);
    setIsNewRecord(false);
    setStartTime(Date.now());
    setElapsed(0);
    setGameState("playing");
  }, [gridSize]);

  const handleCellClick = useCallback(async (num: number, index: number) => {
    if (gameState !== "playing") return;

    if (num === nextNumber) {
      const newClicked = new Set(clickedCells);
      newClicked.add(index);
      setClickedCells(newClicked);
      setLastWrong(null);

      if (num === gridSize * gridSize) {
        clearInterval(timerRef.current);
        const finalTime = Date.now() - startTime;
        setElapsed(finalTime);
        setGameState("done");

        // Save best time
        const timeSeconds = finalTime / 1000;
        const currentBest = bestTimes[gridSize];
        const newRecord = !currentBest || timeSeconds < currentBest;
        setIsNewRecord(newRecord);
        if (newRecord) {
          const newBest = { ...bestTimes, [gridSize]: timeSeconds };
          setBestTimes(newBest);
          localStorage.setItem("schulte_best", JSON.stringify(newBest));
          // Fire confetti for new record!
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ["#6750A4", "#D0BCFF", "#FFD700", "#4CAF50"],
          });
        }

        // Save session
        if (currentUser?.id) {
          await saveSession({
            userId: currentUser.id,
            sessionType: "schulte",
            date: new Date(),
            duration: Math.round(finalTime / 1000),
            result: { gridSize, timeMs: finalTime, errors },
            score: POINTS.schulte,
          });
        }
      } else {
        setNextNumber(num + 1);
      }
    } else {
      setErrors((e) => e + 1);
      setLastWrong(index);
      setTimeout(() => setLastWrong(null), 300);
    }
  }, [gameState, nextNumber, gridSize, clickedCells, startTime, errors, bestTimes, currentUser?.id, saveSession]);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const cs = Math.floor((ms % 1000) / 10);
    return `${s}.${cs.toString().padStart(2, "0")}`;
  };

  return (
    <AppShell>
      <div className="max-w-lg mx-auto px-4 pt-4 pb-24 min-h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-lg font-bold flex-1">Таблиці Шульте</h1>
          {gameState === "playing" && (
            <div className="flex items-center gap-1.5 text-sm font-mono bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full">
              <Timer size={14} />
              {formatTime(elapsed)}
            </div>
          )}
        </div>

        {gameState === "settings" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col"
          >
            <div className="card mb-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Settings2 size={18} />
                Розмір таблиці
              </h3>
              <div className="flex gap-3">
                {([3, 4, 5] as GridSize[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setGridSize(s)}
                    className={cn(
                      "flex-1 py-4 rounded-xl font-bold text-lg transition-all",
                      gridSize === s
                        ? "bg-primary text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                    )}
                  >
                    {s}×{s}
                  </button>
                ))}
              </div>
              <div className="mt-3 text-sm text-gray-500">
                {gridSize === 3 && "Початковий рівень (1-4 клас)"}
                {gridSize === 4 && "Середній рівень (5-8 клас)"}
                {gridSize === 5 && "Просунутий рівень (9-11 клас)"}
              </div>
            </div>

            {/* Best times */}
            <div className="card mb-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Trophy size={18} className="text-amber-500" />
                Найкращий час
              </h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                {([3, 4, 5] as GridSize[]).map((s) => (
                  <div key={s} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                    <div className="text-xs text-gray-500 mb-1">{s}×{s}</div>
                    <div className="font-bold text-lg">
                      {bestTimes[s] ? `${bestTimes[s]!.toFixed(1)}с` : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-auto">
              <button onClick={startGame} className="btn-primary w-full text-lg">
                Почати 🎯
              </button>
            </div>
          </motion.div>
        )}

        {gameState === "playing" && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="mb-4 text-center">
              <span className="text-sm text-gray-500">Знайди число</span>
              <div className="text-4xl font-bold text-primary dark:text-primary-light">
                {nextNumber}
              </div>
            </div>

            <div
              className="grid gap-1.5 w-full max-w-[360px] aspect-square"
              style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
            >
              {grid.map((num, i) => {
                const isClicked = clickedCells.has(i);
                const isWrong = lastWrong === i;
                return (
                  <motion.button
                    key={`${i}-${num}`}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => handleCellClick(num, i)}
                    disabled={isClicked}
                    className={cn(
                      "rounded-xl font-bold text-xl flex items-center justify-center transition-all duration-150",
                      gridSize === 5 ? "text-lg" : "text-xl",
                      isClicked
                        ? "bg-green-100 dark:bg-green-500/10 text-green-500"
                        : isWrong
                        ? "bg-red-100 dark:bg-red-500/10 text-red-500 animate-shake"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 active:bg-primary active:text-white"
                    )}
                  >
                    {isClicked ? "✓" : num}
                  </motion.button>
                );
              })}
            </div>

            {errors > 0 && (
              <div className="mt-3 text-sm text-red-500">
                Помилок: {errors}
              </div>
            )}
          </div>
        )}

        {gameState === "done" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center text-center"
          >
            <div className="text-6xl mb-4">{isNewRecord ? "🏆" : "🎉"}</div>
            <h2 className="text-2xl font-bold mb-2">
              {isNewRecord ? "Новий рекорд!" : "Чудово!"}
            </h2>
            <p className="text-gray-500 mb-6">Таблицю {gridSize}×{gridSize} пройдено</p>

            <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-8">
              <div className="card text-center">
                <div className="text-sm text-gray-500">Час</div>
                <div className="text-2xl font-bold">{formatTime(elapsed)}</div>
              </div>
              <div className="card text-center">
                <div className="text-sm text-gray-500">Помилки</div>
                <div className="text-2xl font-bold">{errors}</div>
              </div>
              <div className="card text-center">
                <div className="text-sm text-gray-500">Бали</div>
                <div className="text-2xl font-bold text-primary">+{POINTS.schulte}</div>
              </div>
              <div className="card text-center">
                <div className="text-sm text-gray-500">Рекорд</div>
                <div className="text-2xl font-bold text-amber-500">
                  {bestTimes[gridSize] ? `${bestTimes[gridSize]!.toFixed(1)}с` : "—"}
                </div>
              </div>
            </div>

            <div className="flex gap-3 w-full max-w-xs">
              <button
                onClick={startGame}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <RotateCcw size={18} />
                Ще раз
              </button>
              <button
                onClick={() => setGameState("settings")}
                className="btn-primary flex-1"
              >
                Готово
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </AppShell>
  );
}
