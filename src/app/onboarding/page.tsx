"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, BookOpen, Eye, Zap, Trophy } from "lucide-react";
import { useUserStore } from "@/lib/stores/userStore";
import { cn } from "@/lib/utils/cn";

const SLIDES = [
  {
    icon: BookOpen,
    title: "Навчись читати швидше!",
    description: "Тренуй навички швидкочитання за допомогою цікавих вправ та текстів",
    color: "text-primary",
  },
  {
    icon: Eye,
    title: "Розширюй поле зору",
    description: "Спеціальні вправи для тренування периферійного зору та концентрації",
    color: "text-blue-500",
  },
  {
    icon: Zap,
    title: "Швидке читання RSVP",
    description: "Читай тексти на швидкості до 1000 слів за хвилину",
    color: "text-amber-500",
  },
  {
    icon: Trophy,
    title: "Відстежуй прогрес",
    description: "Заробляй бали, отримуй досягнення та ставай чемпіоном!",
    color: "text-green-500",
  },
];

const AVATARS = [
  { id: 0, emoji: "🦉", name: "Сова" },
  { id: 1, emoji: "🦊", name: "Лис" },
  { id: 2, emoji: "🐱", name: "Кіт" },
  { id: 3, emoji: "🐶", name: "Пес" },
  { id: 4, emoji: "🦁", name: "Лев" },
  { id: 5, emoji: "🐼", name: "Панда" },
  { id: 6, emoji: "🐰", name: "Заєць" },
  { id: 7, emoji: "🦋", name: "Метелик" },
];

const CLASSES = Array.from({ length: 11 }, (_, i) => i + 1);

export default function OnboardingPage() {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const { completeOnboarding } = useUserStore();

  const [step, setStep] = useState<"slides" | "profile">("slides");
  const [slideIndex, setSlideIndex] = useState(0);
  const [name, setName] = useState("");
  const [age, setAge] = useState<number>(8);
  const [schoolClass, setSchoolClass] = useState<number>(2);
  const [avatarId, setAvatarId] = useState<number>(0);
  const [isCreating, setIsCreating] = useState(false);

  const handleNext = () => {
    if (slideIndex < SLIDES.length - 1) {
      setSlideIndex(slideIndex + 1);
    } else {
      setStep("profile");
    }
  };

  const handleBack = () => {
    if (step === "profile") {
      setStep("slides");
      setSlideIndex(SLIDES.length - 1);
    } else if (slideIndex > 0) {
      setSlideIndex(slideIndex - 1);
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || isCreating) return;
    setIsCreating(true);
    try {
      await completeOnboarding({ name: name.trim(), age, schoolClass, avatarId });
      // Refresh NextAuth session so it picks up new profile data
      await updateSession();
      router.replace("/home");
    } catch {
      setIsCreating(false);
    }
  };

  if (step === "slides") {
    const slide = SLIDES[slideIndex];
    const Icon = slide.icon;
    return (
      <div className="min-h-screen flex flex-col bg-background dark:bg-background-dark">
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={slideIndex}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <div className={cn("w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 bg-gray-100 dark:bg-gray-800", slide.color)}>
                <Icon size={48} />
              </div>
              <h2 className="text-2xl font-bold mb-3">{slide.title}</h2>
              <p className="text-gray-600 dark:text-gray-400 text-lg">{slide.description}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="px-8 pb-12">
          <div className="flex justify-center gap-2 mb-8">
            {SLIDES.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  i === slideIndex
                    ? "w-6 bg-primary"
                    : "bg-gray-300 dark:bg-gray-600"
                )}
              />
            ))}
          </div>

          <div className="flex gap-3">
            {slideIndex > 0 && (
              <button
                onClick={handleBack}
                className="btn-secondary flex items-center gap-1"
              >
                <ChevronLeft size={18} />
                Назад
              </button>
            )}
            <button
              onClick={handleNext}
              className="btn-primary flex-1 flex items-center justify-center gap-1"
            >
              {slideIndex === SLIDES.length - 1 ? "Почати" : "Далі"}
              <ChevronRight size={18} />
            </button>
          </div>

          {slideIndex === 0 && (
            <button
              onClick={() => setStep("profile")}
              className="w-full text-center mt-4 text-gray-500 text-sm"
            >
              Пропустити
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background dark:bg-background-dark">
      <div className="p-6">
        <button onClick={handleBack} className="flex items-center gap-1 text-gray-500">
          <ChevronLeft size={20} />
          Назад
        </button>
      </div>

      <div className="flex-1 px-6 pb-8 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="text-center mb-2">
            <h2 className="text-2xl font-bold">Створи профіль</h2>
            <p className="text-gray-500 mt-1">Розкажи трохи про себе</p>
          </div>

          {/* Avatar */}
          <div>
            <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
              Обери аватар
            </label>
            <div className="grid grid-cols-4 gap-3">
              {AVATARS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAvatarId(a.id)}
                  className={cn(
                    "flex flex-col items-center p-3 rounded-2xl border-2 transition-all",
                    avatarId === a.id
                      ? "border-primary bg-primary/5 scale-105"
                      : "border-gray-200 dark:border-gray-700"
                  )}
                >
                  <span className="text-3xl">{a.emoji}</span>
                  <span className="text-[10px] mt-1 text-gray-500">{a.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Твоє ім&apos;я
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введи ім'я..."
              maxLength={30}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Age */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Вік: <span className="text-primary font-bold">{age} років</span>
            </label>
            <input
              type="range"
              min={6}
              max={18}
              value={age}
              onChange={(e) => {
                const newAge = Number(e.target.value);
                setAge(newAge);
                if (newAge <= 10) setSchoolClass(Math.max(1, newAge - 6));
                else if (newAge <= 14) setSchoolClass(newAge - 6);
                else setSchoolClass(Math.min(11, newAge - 5));
              }}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>6</span>
              <span>18</span>
            </div>
          </div>

          {/* Class */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Клас
            </label>
            <div className="flex flex-wrap gap-2">
              {CLASSES.map((c) => (
                <button
                  key={c}
                  onClick={() => setSchoolClass(c)}
                  className={cn(
                    "w-10 h-10 rounded-xl font-semibold transition-all text-sm",
                    schoolClass === c
                      ? "bg-primary text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Create button */}
          <button
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
            className="btn-primary w-full text-lg mt-4"
          >
            {isCreating ? "Створюємо..." : "Розпочати тренування! 🚀"}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
