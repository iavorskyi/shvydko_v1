"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RotateCcw, Settings2, Play, Pause } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/lib/stores/userStore";
import { useSessionStore } from "@/lib/stores/sessionStore";
import { POINTS } from "@/types";
import { cn } from "@/lib/utils/cn";
import AppShell from "@/components/layout/AppShell";

const WORD_BANKS: Record<string, string[]> = {
  "1-4": [
    "мама", "тато", "дім", "кіт", "пес", "сонце", "вода", "день", "ніч", "книга",
    "школа", "друг", "гра", "ліс", "море", "квітка", "птах", "дерево", "хліб", "молоко",
    "яблуко", "зірка", "місяць", "вікно", "двері", "стіл", "стілець", "ручка", "олівець", "зошит",
  ],
  "5-8": [
    "природа", "освіта", "подорож", "відкриття", "мистецтво", "наука", "космос", "планета",
    "океан", "гора", "пустеля", "ріка", "острів", "країна", "місто", "культура",
    "технологія", "розвиток", "дослідження", "археологія", "біологія", "фізика",
    "географія", "історія", "математика", "література", "музика", "живопис",
  ],
  "9-11": [
    "філософія", "цивілізація", "демократія", "суспільство", "інформація", "інтелект",
    "стратегія", "перспектива", "концепція", "альтернатива", "глобалізація", "еволюція",
    "парадигма", "ренесанс", "метафора", "революція", "інфраструктура", "конституція",
    "дипломатія", "економіка", "психологія", "антропологія", "лінгвістика",
  ],
};

type Mode = "central" | "random" | "group";

function getAgeGroup(schoolClass: number): string {
  if (schoolClass <= 4) return "1-4";
  if (schoolClass <= 8) return "5-8";
  return "9-11";
}

export default function PeripheralPage() {
  const router = useRouter();
  const { currentUser } = useUserStore();
  const { saveSession } = useSessionStore();

  const [mode, setMode] = useState<Mode>("central");
  const [speed, setSpeed] = useState(1.5);
  const [wordCount, setWordCount] = useState(15);
  const [gameState, setGameState] = useState<"settings" | "playing" | "paused" | "done">("settings");
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentWords, setCurrentWords] = useState<string[]>([]);
  const [displayWord, setDisplayWord] = useState<string | string[]>("");
  const [wordPosition, setWordPosition] = useState({ x: 50, y: 50 });
  const [showWord, setShowWord] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const getWords = useCallback(() => {
    const ageGroup = currentUser ? getAgeGroup(currentUser.schoolClass ?? 2) : "1-4";
    const bank = WORD_BANKS[ageGroup] || WORD_BANKS["1-4"];
    const shuffled = [...bank].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, wordCount);
  }, [currentUser, wordCount]);

  const showNextWord = useCallback((words: string[], index: number) => {
    if (index >= words.length) {
      setGameState("done");
      return;
    }

    if (mode === "group") {
      const group = words.slice(index, index + 3);
      setDisplayWord(group);
      setCurrentWordIndex(index + group.length);
    } else {
      setDisplayWord(words[index]);
      setCurrentWordIndex(index + 1);
    }

    if (mode === "random") {
      setWordPosition({
        x: 15 + Math.random() * 70,
        y: 20 + Math.random() * 60,
      });
    } else {
      setWordPosition({ x: 50, y: 50 });
    }

    setShowWord(true);

    timeoutRef.current = setTimeout(() => {
      setShowWord(false);
      timeoutRef.current = setTimeout(() => {
        const nextIdx = mode === "group" ? index + 3 : index + 1;
        showNextWord(words, nextIdx);
      }, 200);
    }, speed * 1000);
  }, [mode, speed]);

  const startGame = useCallback(() => {
    const words = getWords();
    setCurrentWords(words);
    setCurrentWordIndex(0);
    setStartTime(Date.now());
    setGameState("playing");
    showNextWord(words, 0);
  }, [getWords, showNextWord]);

  const handlePause = () => {
    if (gameState === "playing") {
      clearTimeout(timeoutRef.current);
      setGameState("paused");
    } else if (gameState === "paused") {
      setGameState("playing");
      showNextWord(currentWords, currentWordIndex);
    }
  };

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  useEffect(() => {
    if (gameState === "done" && currentUser?.id) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      saveSession({
        userId: currentUser.id,
        sessionType: "peripheral",
        date: new Date(),
        duration,
        result: { mode, wordsShown: currentWords.length, speed },
        score: POINTS.peripheral,
      });
    }
  }, [gameState]);

  const MODES: { value: Mode; label: string; desc: string }[] = [
    { value: "central", label: "Центральний", desc: "Слова в центрі екрану" },
    { value: "random", label: "Випадковий", desc: "Слова в різних місцях" },
    { value: "group", label: "Груповий", desc: "2-3 слова одночасно" },
  ];

  return (
    <AppShell>
      <div className="max-w-lg mx-auto px-4 pt-4 pb-24 min-h-screen flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-lg font-bold flex-1">Поле зору</h1>
          {(gameState === "playing" || gameState === "paused") && (
            <button onClick={handlePause} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
              {gameState === "paused" ? <Play size={20} /> : <Pause size={20} />}
            </button>
          )}
        </div>

        {gameState === "settings" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col">
            <div className="card mb-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Settings2 size={18} />
                Режим
              </h3>
              <div className="space-y-2">
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMode(m.value)}
                    className={cn(
                      "w-full p-3 rounded-xl text-left transition-all",
                      mode === m.value
                        ? "bg-primary text-white"
                        : "bg-gray-100 dark:bg-gray-800"
                    )}
                  >
                    <div className="font-semibold text-sm">{m.label}</div>
                    <div className={cn("text-xs mt-0.5", mode === m.value ? "text-white/70" : "text-gray-500")}>
                      {m.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="card mb-4">
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>Швидкість</span>
                  <span className="font-semibold">{speed} сек</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={3}
                  step={0.5}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Кількість слів</span>
                  <span className="font-semibold">{wordCount}</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={40}
                  step={5}
                  value={wordCount}
                  onChange={(e) => setWordCount(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>

            <div className="mt-auto">
              <button onClick={startGame} className="btn-primary w-full text-lg">
                Почати 👁️
              </button>
            </div>
          </motion.div>
        )}

        {(gameState === "playing" || gameState === "paused") && (
          <div className="flex-1 flex flex-col">
            {/* Progress */}
            <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mb-4 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${(currentWordIndex / currentWords.length) * 100}%` }}
              />
            </div>

            {/* Display area */}
            <div className="flex-1 relative bg-gray-50 dark:bg-gray-800/50 rounded-2xl overflow-hidden min-h-[400px]">
              {gameState === "paused" ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <Pause size={48} className="mx-auto mb-2" />
                    <p>Пауза</p>
                  </div>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  {showWord && (
                    <motion.div
                      key={currentWordIndex}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute font-bold text-3xl"
                      style={{
                        left: `${wordPosition.x}%`,
                        top: `${wordPosition.y}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      {Array.isArray(displayWord) ? (
                        <div className="flex flex-col items-center gap-2">
                          {displayWord.map((w, i) => (
                            <span key={i}>{w}</span>
                          ))}
                        </div>
                      ) : (
                        displayWord
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          </div>
        )}

        {gameState === "done" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center text-center"
          >
            <div className="text-6xl mb-4">👁️</div>
            <h2 className="text-2xl font-bold mb-2">Молодець!</h2>
            <p className="text-gray-500 mb-6">Вправу завершено</p>

            <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-8">
              <div className="card text-center">
                <div className="text-sm text-gray-500">Слів</div>
                <div className="text-2xl font-bold">{currentWords.length}</div>
              </div>
              <div className="card text-center">
                <div className="text-sm text-gray-500">Бали</div>
                <div className="text-2xl font-bold text-primary">+{POINTS.peripheral}</div>
              </div>
            </div>

            <div className="flex gap-3 w-full max-w-xs">
              <button onClick={startGame} className="btn-secondary flex-1 flex items-center justify-center gap-2">
                <RotateCcw size={18} />
                Ще раз
              </button>
              <button onClick={() => setGameState("settings")} className="btn-primary flex-1">
                Готово
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </AppShell>
  );
}
