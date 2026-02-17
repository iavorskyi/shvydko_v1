"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, X, ChevronRight } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import confetti from "canvas-confetti";
import { useUserStore } from "@/lib/stores/userStore";
import { useSessionStore } from "@/lib/stores/sessionStore";
import { db } from "@/lib/db";
import { POINTS } from "@/types";
import type { TestQuestion, Text } from "@/types";
import { cn } from "@/lib/utils/cn";
import AppShell from "@/components/layout/AppShell";

// Fisher-Yates shuffle
function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function TestPage() {
  const router = useRouter();
  const params = useParams();
  const textId = Number(params.textId);
  const { currentUser } = useUserStore();
  const { saveSession } = useSessionStore();

  const [text, setText] = useState<Text | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [shuffledOptions, setShuffledOptions] = useState<string[][]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [results, setResults] = useState<{ correct: boolean; timeSpent: number }[]>([]);
  const [gameState, setGameState] = useState<"loading" | "playing" | "done">("loading");
  const [questionStart, setQuestionStart] = useState(0);
  const [startTime, setStartTime] = useState(0);

  useEffect(() => {
    async function load() {
      const t = await db.texts.get(textId);
      const q = await db.testQuestions.where("textId").equals(textId).toArray();
      if (t) setText(t);
      if (q.length > 0) {
        setQuestions(q);
        // Shuffle options for each question so correct answer isn't always first
        setShuffledOptions(q.map((question) => shuffleArray(question.options)));
        setGameState("playing");
        setQuestionStart(Date.now());
        setStartTime(Date.now());
      }
    }
    if (textId) load();
  }, [textId]);

  const handleAnswer = (answer: string) => {
    if (isAnswered) return;
    setSelectedAnswer(answer);
    setIsAnswered(true);

    const question = questions[currentQ];
    const correct = answer === question.correctAnswer;
    const timeSpent = Math.round((Date.now() - questionStart) / 1000);

    setResults((prev) => [...prev, { correct, timeSpent }]);

    // Save to DB
    if (currentUser?.id) {
      db.testResults.add({
        sessionId: 0, // Will be updated
        questionId: question.id!,
        userAnswer: answer,
        isCorrect: correct,
        timeSpent,
      });
    }
  };

  const handleNext = async () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setQuestionStart(Date.now());
    } else {
      setGameState("done");

      // Save session
      if (currentUser?.id) {
        const correctCount = results.filter((r) => r.correct).length + (selectedAnswer === questions[currentQ].correctAnswer ? 1 : 0);
        const comprehension = Math.round(((correctCount) / questions.length) * 100);
        const duration = Math.round((Date.now() - startTime) / 1000);
        const score = comprehension === 100 ? POINTS.test_perfect : Math.round(POINTS.test_perfect * (comprehension / 100));

        await saveSession({
          userId: currentUser.id,
          sessionType: "test",
          date: new Date(),
          duration,
          result: { textId, correctCount, totalQuestions: questions.length },
          score,
          comprehension,
        });

        // Confetti for good results
        if (comprehension >= 80) {
          confetti({
            particleCount: comprehension === 100 ? 150 : 80,
            spread: 70,
            origin: { y: 0.6 },
            colors: ["#6750A4", "#D0BCFF", "#FFD700", "#4CAF50"],
          });
        }
      }
    }
  };

  if (gameState === "loading") {
    return (
      <AppShell>
        <div className="max-w-lg mx-auto px-4 pt-6 flex items-center justify-center min-h-screen">
          <div className="text-center text-gray-400">
            {questions.length === 0 && text ? (
              <>
                <p className="font-medium">Тестів для цього тексту поки немає</p>
                <button onClick={() => router.back()} className="btn-primary mt-4">
                  Назад
                </button>
              </>
            ) : (
              <div className="w-8 h-8 border-2 border-gray-300 border-t-primary rounded-full animate-spin mx-auto" />
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  if (gameState === "done") {
    const allResults = results;
    const correctCount = allResults.filter((r) => r.correct).length;
    const comprehension = Math.round((correctCount / questions.length) * 100);

    return (
      <AppShell>
        <div className="max-w-lg mx-auto px-4 pt-6 pb-24 min-h-screen flex flex-col items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center w-full"
          >
            <div className="text-6xl mb-4">
              {comprehension >= 80 ? "🎉" : comprehension >= 50 ? "👍" : "📚"}
            </div>
            <h2 className="text-2xl font-bold mb-2">
              {comprehension >= 80 ? "Відмінно!" : comprehension >= 50 ? "Непогано!" : "Спробуй ще!"}
            </h2>
            <p className="text-gray-500 mb-6">{text?.title}</p>

            <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto mb-8">
              <div className="card text-center">
                <div className="text-sm text-gray-500">Правильно</div>
                <div className="text-2xl font-bold text-green-500">
                  {correctCount}/{questions.length}
                </div>
              </div>
              <div className="card text-center">
                <div className="text-sm text-gray-500">Розуміння</div>
                <div className={cn(
                  "text-2xl font-bold",
                  comprehension >= 80 ? "text-green-500" : comprehension >= 50 ? "text-amber-500" : "text-red-500"
                )}>
                  {comprehension}%
                </div>
              </div>
            </div>

            <div className="flex gap-3 max-w-xs mx-auto">
              <button onClick={() => router.push("/library")} className="btn-secondary flex-1">
                Бібліотека
              </button>
              <button onClick={() => router.push("/home")} className="btn-primary flex-1">
                Головна
              </button>
            </div>
          </motion.div>
        </div>
      </AppShell>
    );
  }

  const question = questions[currentQ];

  return (
    <AppShell>
      <div className="max-w-lg mx-auto px-4 pt-4 pb-24 min-h-screen flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-lg font-bold flex-1">Тест на розуміння</h1>
          <span className="text-sm text-gray-500">
            {currentQ + 1}/{questions.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${((currentQ + (isAnswered ? 1 : 0)) / questions.length) * 100}%` }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentQ}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col"
          >
            <h2 className="text-lg font-semibold mb-6">{question.question}</h2>

            <div className="space-y-3">
              {(shuffledOptions[currentQ] || question.options).map((option, i) => {
                const isSelected = selectedAnswer === option;
                const isCorrect = option === question.correctAnswer;
                let optionClass = "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700";

                if (isAnswered) {
                  if (isCorrect) {
                    optionClass = "bg-green-50 dark:bg-green-500/10 border-green-500 text-green-700 dark:text-green-400";
                  } else if (isSelected && !isCorrect) {
                    optionClass = "bg-red-50 dark:bg-red-500/10 border-red-500 text-red-700 dark:text-red-400";
                  }
                } else if (isSelected) {
                  optionClass = "bg-primary/5 border-primary text-primary";
                }

                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(option)}
                    disabled={isAnswered}
                    className={cn(
                      "w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3",
                      optionClass
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                      isAnswered && isCorrect
                        ? "bg-green-500 text-white"
                        : isAnswered && isSelected && !isCorrect
                        ? "bg-red-500 text-white"
                        : "bg-gray-200 dark:bg-gray-600"
                    )}>
                      {isAnswered && isCorrect ? <Check size={16} /> :
                       isAnswered && isSelected && !isCorrect ? <X size={16} /> :
                       String.fromCharCode(65 + i)}
                    </div>
                    <span className="text-sm">{option}</span>
                  </button>
                );
              })}
            </div>

            {/* Explanation */}
            {isAnswered && question.explanation && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-sm text-blue-800 dark:text-blue-300"
              >
                💡 {question.explanation}
              </motion.div>
            )}

            {/* Next button */}
            {isAnswered && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-auto pt-4"
              >
                <button onClick={handleNext} className="btn-primary w-full flex items-center justify-center gap-2">
                  {currentQ < questions.length - 1 ? "Далі" : "Результати"}
                  <ChevronRight size={18} />
                </button>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
