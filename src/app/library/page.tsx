"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Search, Filter, Heart, BookOpen, FileUp, Star, Loader2, List, FileText, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/lib/stores/userStore";
import { useReadingProgressStore } from "@/lib/stores/readingProgressStore";
import { db } from "@/lib/db";
import { api } from "@/lib/services/api";
import type { Text, ReadingProgress } from "@/types";
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

export default function LibraryPage() {
  const router = useRouter();
  const { currentUser } = useUserStore();
  const { getProgressForLibrary } = useReadingProgressStore();
  const [texts, setTexts] = useState<Text[]>([]);
  const [activeTab, setActiveTab] = useState<"library" | "pdf">("library");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [ageGroup, setAgeGroup] = useState("all");
  const [showFavorites, setShowFavorites] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [progressMap, setProgressMap] = useState<Map<number, ReadingProgress>>(new Map());
  const [pdfLoading, setPdfLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const loadTexts = useCallback(async () => {
    const all = await db.texts.toArray();
    setTexts(all);
  }, []);

  useEffect(() => {
    loadTexts();
  }, [loadTexts]);

  // Load reading progress
  useEffect(() => {
    if (currentUser?.id) {
      getProgressForLibrary(currentUser.id).then(setProgressMap);
    }
  }, [currentUser?.id, getProgressForLibrary]);

  // PDF upload handler
  const handlePdfUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setPdfLoading(true);
      try {
        const { extractTextFromPdf } = await import("@/lib/utils/pdfParser");
        const result = await extractTextFromPdf(file);
        if (result.wordCount < 10) {
          setPdfLoading(false);
          return;
        }
        const localId = await db.texts.add({
          title: result.title,
          content: result.text,
          difficulty: 3,
          ageGroup: "5-8",
          category: "завантажені",
          wordCount: result.wordCount,
          source: "pdf",
          isFavorite: 0,
          createdAt: new Date(),
          outline: result.outline.length > 0 ? result.outline : undefined,
          pageWordOffsets: result.pageWordOffsets,
        } as Text);
        const newText: Text = {
          id: localId,
          title: result.title,
          content: result.text,
          difficulty: 3,
          ageGroup: "5-8",
          category: "завантажені",
          wordCount: result.wordCount,
          source: "pdf",
          isFavorite: 0,
          createdAt: new Date(),
          outline: result.outline.length > 0 ? result.outline : undefined,
          pageWordOffsets: result.pageWordOffsets,
        };
        setTexts((prev) => [newText, ...prev]);
        // Switch to PDF tab after upload
        setActiveTab("pdf");
        if (api.isOnline()) {
          try {
            await api.post("/texts/upload", {
              title: result.title,
              content: result.text,
              wordCount: result.wordCount,
            });
          } catch { /* local only */ }
        }
      } catch (err) {
        console.error("PDF parsing failed:", err);
      } finally {
        setPdfLoading(false);
        if (pdfInputRef.current) pdfInputRef.current.value = "";
      }
    },
    []
  );

  // Split texts by type
  const builtinTexts = texts.filter((t) => t.source !== "pdf");
  const pdfTexts = texts.filter((t) => t.source === "pdf");

  // Filter built-in texts
  const filteredBuiltinTexts = builtinTexts.filter((t) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (category !== "all" && t.category !== category) return false;
    if (ageGroup !== "all" && t.ageGroup !== ageGroup) return false;
    if (showFavorites && !t.isFavorite) return false;
    return true;
  });

  // Filter PDF texts
  const filteredPdfTexts = pdfTexts.filter((t) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
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

  const handleDeletePdf = async (textId: number) => {
    await db.texts.delete(textId);
    // Also delete reading progress for this text
    try {
      await db.readingProgress.where("textId").equals(textId).delete();
    } catch { /* ok */ }
    setTexts((prev) => prev.filter((t) => t.id !== textId));
    setDeleteConfirmId(null);
  };

  const handleTextClick = (text: Text) => {
    router.push(`/exercises/longread?textId=${text.id}`);
  };

  const renderProgressBar = (text: Text) => {
    if (!text.id || !progressMap.has(text.id)) return null;
    const p = progressMap.get(text.id)!;
    const pct = Math.round((p.currentWordIndex / p.totalWords) * 100);
    return (
      <div className="flex items-center gap-1.5 mt-1.5">
        <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-500 rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[9px] text-teal-600 dark:text-teal-400 font-medium">
          {pct}%
        </span>
      </div>
    );
  };

  return (
    <AppShell>
      <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold mb-4">Бібліотека</h1>

        {/* Tab switcher */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab("library")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all",
              activeTab === "library"
                ? "bg-primary text-white shadow-md"
                : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
            )}
          >
            <BookOpen size={16} />
            Бібліотека
          </button>
          <button
            onClick={() => setActiveTab("pdf")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all",
              activeTab === "pdf"
                ? "bg-teal-500 text-white shadow-md"
                : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
            )}
          >
            <FileText size={16} />
            Мої PDF
            {pdfTexts.length > 0 && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full",
                activeTab === "pdf"
                  ? "bg-white/20"
                  : "bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400"
              )}>
                {pdfTexts.length}
              </span>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab === "library" ? "Пошук текстів..." : "Пошук PDF..."}
            className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:border-primary"
          />
          {activeTab === "library" && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg",
                showFilters ? "text-primary bg-primary/10" : "text-gray-400"
              )}
            >
              <Filter size={18} />
            </button>
          )}
        </div>

        {/* Filters (only for library tab) */}
        {activeTab === "library" && showFilters && (
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

        {/* Action bar */}
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
          {activeTab === "pdf" && (
            <button
              onClick={() => pdfInputRef.current?.click()}
              disabled={pdfLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 hover:bg-teal-100 transition-all"
            >
              {pdfLoading ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
              {pdfLoading ? "Обробка..." : "Завантажити PDF"}
            </button>
          )}
          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handlePdfUpload}
          />
          <span className="text-xs text-gray-400 ml-auto">
            {activeTab === "library" ? filteredBuiltinTexts.length : filteredPdfTexts.length} текстів
          </span>
        </div>

        {/* ── LIBRARY TAB ── */}
        {activeTab === "library" && (
          <div className="space-y-2">
            {filteredBuiltinTexts.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <BookOpen size={48} className="mx-auto mb-3 opacity-50" />
                <p className="font-medium">Текстів не знайдено</p>
                <p className="text-sm mt-1">Спробуйте змінити фільтри</p>
              </div>
            ) : (
              filteredBuiltinTexts.map((text, i) => (
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
                    {renderProgressBar(text)}
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
        )}

        {/* ── PDF TAB ── */}
        {activeTab === "pdf" && (
          <div className="space-y-2">
            {filteredPdfTexts.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FileText size={48} className="mx-auto mb-3 opacity-50" />
                <p className="font-medium">PDF файлів ще немає</p>
                <p className="text-sm mt-1">
                  Завантажте PDF файл, щоб почати читання
                </p>
                <button
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={pdfLoading}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 transition-all"
                >
                  {pdfLoading ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
                  {pdfLoading ? "Обробка..." : "Завантажити PDF"}
                </button>
              </div>
            ) : (
              filteredPdfTexts.map((text, i) => (
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
                      <span className="text-[10px] text-gray-400">
                        {text.wordCount} слів
                      </span>
                      {text.outline && text.outline.length > 0 ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center gap-1">
                          <List size={9} />
                          {text.outline.length} розділів
                        </span>
                      ) : text.pageWordOffsets && text.pageWordOffsets.length > 1 ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 flex items-center gap-1">
                          <List size={9} />
                          {text.pageWordOffsets.length} стор.
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center gap-1">
                          <List size={9} />
                          Навігація
                        </span>
                      )}
                    </div>
                    {renderProgressBar(text)}

                    {/* Delete confirmation inline */}
                    {text.id && deleteConfirmId === text.id && (
                      <div
                        className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-red-50 dark:bg-red-500/10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-xs text-red-600 dark:text-red-400 flex-1">Видалити?</span>
                        <button
                          onClick={() => handleDeletePdf(text.id!)}
                          className="px-3 py-1 rounded-lg bg-red-500 text-white text-xs font-medium"
                        >
                          Так
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-3 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 text-xs font-medium"
                        >
                          Ні
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1 mt-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(text);
                      }}
                      className="p-1.5"
                    >
                      <Heart
                        size={18}
                        className={text.isFavorite ? "text-red-500" : "text-gray-300"}
                        fill={text.isFavorite ? "currentColor" : "none"}
                      />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(text.id === deleteConfirmId ? null : text.id!);
                      }}
                      className="p-1.5"
                    >
                      <Trash2 size={16} className="text-gray-300 hover:text-red-400 transition-colors" />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
