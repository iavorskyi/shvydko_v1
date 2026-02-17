"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Search, Filter, Heart, BookOpen, FileUp, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import type { Text, AgeGroup, TextCategory } from "@/types";
import { cn } from "@/lib/utils/cn";
import AppShell from "@/components/layout/AppShell";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "all", label: "Всі" },
  { value: "казки", label: "Казки" },
  { value: "наука", label: "Наука" },
  { value: "класика", label: "Класика" },
  { value: "історія", label: "Історія" },
  { value: "природа", label: "Природа" },
];

const AGE_GROUPS: { value: string; label: string }[] = [
  { value: "all", label: "Всі" },
  { value: "1-4", label: "1-4 клас" },
  { value: "5-8", label: "5-8 клас" },
  { value: "9-11", label: "9-11 клас" },
];

const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Дуже легко",
  2: "Легко",
  3: "Середньо",
  4: "Складно",
  5: "Дуже складно",
};

export default function LibraryPage() {
  const router = useRouter();
  const [texts, setTexts] = useState<Text[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [ageGroup, setAgeGroup] = useState("all");
  const [showFavorites, setShowFavorites] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const loadTexts = useCallback(async () => {
    let query = db.texts.toCollection();
    const all = await query.toArray();
    setTexts(all);
  }, []);

  useEffect(() => {
    loadTexts();
  }, [loadTexts]);

  const filteredTexts = texts.filter((t) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (category !== "all" && t.category !== category) return false;
    if (ageGroup !== "all" && t.ageGroup !== ageGroup) return false;
    if (showFavorites && !t.isFavorite) return false;
    return true;
  });

  const toggleFavorite = async (text: Text) => {
    if (!text.id) return;
    const newFav = text.isFavorite ? 0 : 1;
    await db.texts.update(text.id, { isFavorite: newFav });
    setTexts((prev) =>
      prev.map((t) => (t.id === text.id ? { ...t, isFavorite: newFav } : t))
    );
  };

  const handleTextClick = (text: Text) => {
    router.push(`/exercises/rsvp?textId=${text.id}`);
  };

  return (
    <AppShell>
      <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold mb-4">Бібліотека</h1>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук текстів..."
            className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:border-primary"
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg",
              showFilters ? "text-primary bg-primary/10" : "text-gray-400"
            )}
          >
            <Filter size={18} />
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="mb-3 overflow-hidden"
          >
            <div className="card space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">Категорія</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setCategory(c.value)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium transition-all",
                        category === c.value
                          ? "bg-primary text-white"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">Вікова група</label>
                <div className="flex flex-wrap gap-1.5">
                  {AGE_GROUPS.map((a) => (
                    <button
                      key={a.value}
                      onClick={() => setAgeGroup(a.value)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium transition-all",
                        ageGroup === a.value
                          ? "bg-primary text-white"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                      )}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Favorites toggle */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setShowFavorites(!showFavorites)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              showFavorites
                ? "bg-red-50 dark:bg-red-500/10 text-red-500"
                : "bg-gray-100 dark:bg-gray-800 text-gray-500"
            )}
          >
            <Heart size={14} fill={showFavorites ? "currentColor" : "none"} />
            Улюблені
          </button>
          <span className="text-xs text-gray-400">
            {filteredTexts.length} текстів
          </span>
        </div>

        {/* Text list */}
        <div className="space-y-2">
          {filteredTexts.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <BookOpen size={48} className="mx-auto mb-3 opacity-50" />
              <p className="font-medium">Текстів не знайдено</p>
              <p className="text-sm mt-1">Спробуйте змінити фільтри</p>
            </div>
          ) : (
            filteredTexts.map((text, i) => (
              <motion.div
                key={text.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="card-interactive flex items-start gap-3"
                onClick={() => handleTextClick(text)}
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm line-clamp-1">{text.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {text.content.substring(0, 100)}...
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                      {text.ageGroup} клас
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                      {text.category}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {text.wordCount} слів
                    </span>
                    <div className="flex items-center gap-0.5 ml-auto">
                      {Array.from({ length: 5 }, (_, j) => (
                        <Star
                          key={j}
                          size={10}
                          className={j < text.difficulty ? "text-amber-400" : "text-gray-300"}
                          fill={j < text.difficulty ? "currentColor" : "none"}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(text);
                  }}
                  className="p-1.5 mt-1"
                >
                  <Heart
                    size={18}
                    className={text.isFavorite ? "text-red-500" : "text-gray-300"}
                    fill={text.isFavorite ? "currentColor" : "none"}
                  />
                </button>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
