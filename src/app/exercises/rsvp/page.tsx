"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Play, Pause, RotateCcw, Settings2, ChevronDown, ChevronUp } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import confetti from "canvas-confetti";
import { useUserStore } from "@/lib/stores/userStore";
import { useSessionStore } from "@/lib/stores/sessionStore";
import { db } from "@/lib/db";
import { POINTS } from "@/types";
import type { Text } from "@/types";
import { cn } from "@/lib/utils/cn";
import AppShell from "@/components/layout/AppShell";

function parseText(text: string): string[] {
  return text
    .replace(/\n+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

// ORP (Optimal Recognition Point) - the fixation point where the eye
// naturally focuses when reading a word. Research suggests ~35% into the word.
// We calculate based on actual letter positions, skipping leading punctuation.
function getOrpIndex(word: string): number {
  // Find the positions of actual letters (skip punctuation)
  const letterPattern = /[a-zA-Zа-яА-ЯіІїЇєЄґҐ''ʼ]/;
  let firstLetterIdx = 0;
  let lastLetterIdx = word.length - 1;

  while (firstLetterIdx < word.length && !letterPattern.test(word[firstLetterIdx])) {
    firstLetterIdx++;
  }
  while (lastLetterIdx > firstLetterIdx && !letterPattern.test(word[lastLetterIdx])) {
    lastLetterIdx--;
  }

  const letterSpan = lastLetterIdx - firstLetterIdx + 1;
  if (letterSpan <= 1) return firstLetterIdx;
  if (letterSpan <= 3) return firstLetterIdx + 1;

  // ORP at approximately 35% of the word length
  const orpOffset = Math.floor(letterSpan * 0.35);
  return firstLetterIdx + orpOffset;
}

export default function RsvpPageWrapper() {
  return (
    <Suspense>
      <RsvpPage />
    </Suspense>
  );
}

function RsvpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser } = useUserStore();
  const { saveSession } = useSessionStore();

  const [texts, setTexts] = useState<Text[]>([]);
  const [selectedText, setSelectedText] = useState<Text | null>(null);
  const [showTextPicker, setShowTextPicker] = useState(false);

  const [wpm, setWpm] = useState(200);
  const [wordsPerFlash, setWordsPerFlash] = useState(1);
  const [gameState, setGameState] = useState<"settings" | "playing" | "paused" | "done">("settings");

  const [words, setWords] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayWord, setDisplayWord] = useState("");
  const [startTime, setStartTime] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    const textIdParam = searchParams.get("textId");
    db.texts.toArray().then((t) => {
      setTexts(t);
      if (t.length > 0) {
        // If textId query parameter exists, select that text
        if (textIdParam) {
          const targetText = t.find((tx) => tx.id === Number(textIdParam));
          setSelectedText(targetText || t[0]);
        } else {
          setSelectedText(t[0]);
        }
      }
    });
  }, [searchParams]);

  const start = useCallback(() => {
    if (!selectedText) return;
    const w = parseText(selectedText.content);
    setWords(w);
    setCurrentIndex(0);
    setStartTime(Date.now());
    setGameState("playing");
  }, [selectedText]);

  useEffect(() => {
    if (gameState !== "playing" || words.length === 0) return;

    const msPerWord = 60000 / wpm;
    const msPerFlash = msPerWord * wordsPerFlash;

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = prev + wordsPerFlash;
        if (next >= words.length) {
          clearInterval(intervalRef.current);
          setGameState("done");
          return prev;
        }
        const chunk = words.slice(next, next + wordsPerFlash).join(" ");
        setDisplayWord(chunk);
        return next;
      });
    }, msPerFlash);

    // Show first word immediately
    const first = words.slice(0, wordsPerFlash).join(" ");
    setDisplayWord(first);

    return () => clearInterval(intervalRef.current);
  }, [gameState, words, wpm, wordsPerFlash]);

  useEffect(() => {
    if (gameState === "done" && currentUser?.id && selectedText) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      saveSession({
        userId: currentUser.id,
        sessionType: "rsvp",
        date: new Date(),
        duration,
        result: { textId: selectedText.id, wordsRead: words.length, wpm },
        score: POINTS.rsvp,
        speed: wpm,
      });
      // Celebration confetti
      confetti({
        particleCount: 60,
        spread: 55,
        origin: { y: 0.7 },
        colors: ["#6750A4", "#D0BCFF", "#4CAF50"],
      });
    }
  }, [gameState]);

  const handlePause = () => {
    if (gameState === "playing") {
      clearInterval(intervalRef.current);
      setGameState("paused");
    } else if (gameState === "paused") {
      setGameState("playing");
    }
  };

  const handleSpeedChange = (delta: number) => {
    setWpm((prev) => Math.max(30, Math.min(1000, prev + delta)));
  };

  const progress = words.length > 0 ? currentIndex / words.length : 0;
  const orpIdx = getOrpIndex(displayWord);

  return (
    <AppShell>
      <div className="max-w-lg mx-auto px-4 pt-4 pb-24 min-h-screen flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-lg font-bold flex-1">RSVP Читання</h1>
        </div>

        {gameState === "settings" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col">
            {/* Text picker */}
            <div className="card mb-4">
              <h3 className="font-semibold mb-2">Текст</h3>
              {selectedText ? (
                <button
                  onClick={() => setShowTextPicker(!showTextPicker)}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-left flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-sm">{selectedText.title}</div>
                    <div className="text-xs text-gray-500">{selectedText.wordCount} слів</div>
                  </div>
                  {showTextPicker ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              ) : (
                <p className="text-sm text-gray-500">Бібліотека порожня. Додайте тексти в розділі Бібліотека.</p>
              )}

              {showTextPicker && (
                <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                  {texts.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedText(t);
                        setShowTextPicker(false);
                      }}
                      className={cn(
                        "w-full p-2 rounded-lg text-left text-sm transition-all",
                        selectedText?.id === t.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-gray-100 dark:hover:bg-gray-700"
                      )}
                    >
                      {t.title} ({t.wordCount} слів)
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Speed */}
            <div className="card mb-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Settings2 size={18} />
                Налаштування
              </h3>
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>Швидкість</span>
                  <span className="font-bold text-primary">{wpm} слів/хв</span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={1000}
                  step={10}
                  value={wpm}
                  onChange={(e) => setWpm(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>30</span>
                  <span>1000</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Слів за раз</span>
                  <span className="font-semibold">{wordsPerFlash}</span>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => setWordsPerFlash(n)}
                      className={cn(
                        "flex-1 py-2 rounded-xl font-semibold text-sm",
                        wordsPerFlash === n
                          ? "bg-primary text-white"
                          : "bg-gray-100 dark:bg-gray-800"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-auto">
              <button onClick={start} disabled={!selectedText} className="btn-primary w-full text-lg disabled:opacity-50">
                Почати читання ⚡
              </button>
            </div>
          </motion.div>
        )}

        {(gameState === "playing" || gameState === "paused") && (
          <div className="flex-1 flex flex-col">
            <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mb-2 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-150"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mb-4">
              <span>{currentIndex}/{words.length} слів</span>
              <span>{wpm} сл/хв</span>
            </div>

            <div
              className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-2xl min-h-[300px] cursor-pointer"
              onClick={handlePause}
            >
              {gameState === "paused" ? (
                <div className="text-center text-gray-400">
                  <Play size={48} className="mx-auto mb-2" />
                  <p>Натисніть для продовження</p>
                </div>
              ) : (
                <div className="text-center px-4">
                  <div className="text-3xl sm:text-4xl font-bold leading-relaxed tracking-wide">
                    {displayWord.split("").map((char, i) => (
                      <span
                        key={i}
                        className={i === orpIdx ? "text-red-500" : ""}
                      >
                        {char}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Speed controls */}
            <div className="flex items-center justify-center gap-4 mt-4">
              <button
                onClick={() => handleSpeedChange(wpm <= 100 ? -10 : -50)}
                className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold"
              >
                −
              </button>
              <span className="font-bold text-lg w-24 text-center">{wpm} сл/хв</span>
              <button
                onClick={() => handleSpeedChange(wpm < 100 ? 10 : 50)}
                className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold"
              >
                +
              </button>
            </div>
          </div>
        )}

        {gameState === "done" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center text-center"
          >
            <div className="text-6xl mb-4">⚡</div>
            <h2 className="text-2xl font-bold mb-2">Текст прочитано!</h2>
            <p className="text-gray-500 mb-6">{selectedText?.title}</p>

            <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-8">
              <div className="card text-center">
                <div className="text-sm text-gray-500">Слів</div>
                <div className="text-2xl font-bold">{words.length}</div>
              </div>
              <div className="card text-center">
                <div className="text-sm text-gray-500">Швидкість</div>
                <div className="text-2xl font-bold">{wpm} сл/хв</div>
              </div>
              <div className="card text-center">
                <div className="text-sm text-gray-500">Бали</div>
                <div className="text-2xl font-bold text-primary">+{POINTS.rsvp}</div>
              </div>
              <div className="card text-center">
                <div className="text-sm text-gray-500">Час</div>
                <div className="text-2xl font-bold">
                  {Math.round((Date.now() - startTime) / 1000)}с
                </div>
              </div>
            </div>

            {selectedText?.id && (
              <button
                onClick={() => router.push(`/test/${selectedText.id}`)}
                className="btn-primary w-full max-w-xs mb-3"
              >
                Пройти тест на розуміння 📝
              </button>
            )}

            <div className="flex gap-3 w-full max-w-xs">
              <button onClick={start} className="btn-secondary flex-1 flex items-center justify-center gap-2">
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
