"use client";

import { useState, useEffect, useCallback, useRef, Suspense, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  RotateCcw,
  Settings2,
  ChevronDown,
  ChevronUp,
  FileUp,
  BookOpen,
  Loader2,
  List,
  FileText,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import confetti from "canvas-confetti";
import { useUserStore } from "@/lib/stores/userStore";
import { useSessionStore } from "@/lib/stores/sessionStore";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { useReadingProgressStore } from "@/lib/stores/readingProgressStore";
import { db } from "@/lib/db";
import { api } from "@/lib/services/api";
import { POINTS } from "@/types";
import type { Text } from "@/types";
import { cn } from "@/lib/utils/cn";
import AppShell from "@/components/layout/AppShell";
import TableOfContents, { type TOCItem } from "@/components/exercises/TableOfContents";

// ─── Helpers ───────────────────────────────────────────

function parseTextIntoParagraphs(text: string): string[][] {
  return text
    .split(/\n\s*\n/)
    .filter((p) => p.trim().length > 0)
    .map((p) =>
      p
        .replace(/\n/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 0)
    );
}

function flattenParagraphs(paragraphs: string[][]): string[] {
  return paragraphs.flat();
}

/**
 * Detect if a paragraph looks like a chapter/section title:
 * - Short (< 80 chars)
 * - Doesn't end with . , ; (narrative punctuation)
 * - Often starts with a number, "Розділ", "Глава", "Частина", or is ALL CAPS
 */
function isChapterTitle(para: string): boolean {
  const trimmed = para.replace(/\n/g, " ").trim();
  if (trimmed.length > 80) return false;
  if (trimmed.length < 2) return false;

  // Ends with narrative punctuation — probably not a title
  if (/[.,;]$/.test(trimmed)) return false;

  // Explicit chapter markers
  if (/^(розділ|глава|частина|chapter|part|section)\s/i.test(trimmed)) return true;

  // Numbered title: "1. Something" or "I. Something" or "1 Something"
  if (/^\d+[\.\)]\s/.test(trimmed)) return true;
  if (/^[IVXLC]+[\.\)]\s/.test(trimmed)) return true;

  // ALL CAPS title (at least 3 words)
  const words = trimmed.split(/\s+/);
  if (words.length >= 2 && words.length <= 12 && trimmed === trimmed.toUpperCase()) return true;

  // Short line that doesn't end with sentence punctuation — likely a heading
  if (trimmed.length < 50 && !/[.!?]$/.test(trimmed) && words.length <= 10) return true;

  return false;
}

/**
 * Clean up a raw section title.
 */
function cleanSectionTitle(raw: string, maxLen = 50): string {
  let t = raw.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  if (t.length > maxLen) {
    const cut = t.lastIndexOf(" ", maxLen);
    t = t.substring(0, cut > 10 ? cut : maxLen);
  }
  t = t.replace(/[,;:\-–—]+$/, "").trim();
  return t;
}

/**
 * Build TOC items from the text's PDF outline, page structure, or content-based detection.
 */
function buildTocItems(text: Text): TOCItem[] {
  // Priority 1: PDF has real outline (bookmarks/TOC)
  if (text.outline && text.outline.length > 0 && text.pageWordOffsets) {
    return text.outline.map((entry) => ({
      title: entry.title.trim(),
      wordStart: text.pageWordOffsets![entry.pageIndex] || 0,
      level: entry.level,
    }));
  }

  // Priority 2: For any PDF text — detect chapters from content structure
  if (text.source === "pdf") {
    const paragraphs = text.content
      .split(/\n\s*\n/)
      .filter((p) => p.trim().length > 0);
    if (paragraphs.length <= 1) {
      // Single paragraph — use page offsets if available
      if (text.pageWordOffsets && text.pageWordOffsets.length > 1) {
        return buildPageBasedToc(text.pageWordOffsets);
      }
      return [];
    }

    // Try to detect chapter titles from paragraph structure
    const detectedChapters: TOCItem[] = [];
    let wordOffset = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i];
      const paraText = para.replace(/\n/g, " ").trim();

      if (isChapterTitle(paraText)) {
        detectedChapters.push({
          title: cleanSectionTitle(paraText),
          wordStart: wordOffset,
          level: 0,
        });
      }

      wordOffset += paraText.split(/\s+/).filter((w) => w.length > 0).length;
    }

    // If we found meaningful chapters (at least 2), use them
    if (detectedChapters.length >= 2) {
      return detectedChapters;
    }

    // Fallback: use page-based TOC if available
    if (text.pageWordOffsets && text.pageWordOffsets.length > 1) {
      return buildPageBasedToc(text.pageWordOffsets);
    }

    // Last fallback: chunk paragraphs into sections
    return buildParagraphBasedToc(paragraphs);
  }
  return [];
}

function buildPageBasedToc(pageWordOffsets: number[]): TOCItem[] {
  const totalPages = pageWordOffsets.length;
  if (totalPages <= 8) {
    return pageWordOffsets.map((offset, i) => ({
      title: `Сторінка ${i + 1}`,
      wordStart: offset,
      level: 0,
    }));
  }
  const chunkSize = Math.ceil(totalPages / Math.min(8, Math.ceil(totalPages / 5)));
  const items: TOCItem[] = [];
  for (let i = 0; i < totalPages; i += chunkSize) {
    const end = Math.min(i + chunkSize, totalPages);
    items.push({
      title: end - i === 1 ? `Сторінка ${i + 1}` : `Сторінки ${i + 1}–${end}`,
      wordStart: pageWordOffsets[i],
      level: 0,
    });
  }
  return items;
}

function buildParagraphBasedToc(paragraphs: string[]): TOCItem[] {
  const targetSections = Math.min(Math.max(3, Math.ceil(paragraphs.length / 4)), 8);
  const parasPerSection = Math.ceil(paragraphs.length / targetSections);
  const items: TOCItem[] = [];
  let wordOffset = 0;

  for (let i = 0; i < paragraphs.length; i += parasPerSection) {
    const sectionParas = paragraphs.slice(i, i + parasPerSection);
    const sectionIdx = items.length + 1;
    const rawText = sectionParas[0].replace(/\n/g, " ").trim();
    const sentenceEnd = rawText.search(/[.!?]\s/);
    let title: string;
    if (sentenceEnd > 5 && sentenceEnd < 60) {
      title = rawText.substring(0, sentenceEnd + 1);
    } else {
      title = cleanSectionTitle(rawText);
    }

    items.push({
      title: title || `Частина ${sectionIdx}`,
      wordStart: wordOffset,
      level: 0,
    });

    for (const para of sectionParas) {
      wordOffset += para
        .replace(/\n/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 0).length;
    }
  }

  return items;
}

// ─── Wrapper ───────────────────────────────────────────

export default function LongReadPageWrapper() {
  return (
    <Suspense>
      <LongReadPage />
    </Suspense>
  );
}

// ─── Main Component ────────────────────────────────────

function LongReadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser } = useUserStore();
  const { saveSession } = useSessionStore();
  const { settings } = useSettingsStore();
  const { loadProgress, saveProgress, clearProgress } = useReadingProgressStore();

  // ── State ──
  const [texts, setTexts] = useState<Text[]>([]);
  const [selectedText, setSelectedText] = useState<Text | null>(null);
  const [showTextPicker, setShowTextPicker] = useState(false);
  const [textPickerTab, setTextPickerTab] = useState<"short" | "pdf">("short");

  const [wpm, setWpm] = useState(200);
  const [fontSize, setFontSize] = useState(settings?.fontSize ?? 18);
  const [gameState, setGameState] = useState<"settings" | "playing" | "paused" | "done">("settings");

  const [paragraphs, setParagraphs] = useState<string[][]>([]);
  const [totalWords, setTotalWords] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [resumedElapsed, setResumedElapsed] = useState(0);
  const [resumedFromIndex, setResumedFromIndex] = useState<number | null>(null);
  const [savedProgressMap, setSavedProgressMap] = useState<Map<number, boolean>>(new Map());
  const [startFromWordIndex, setStartFromWordIndex] = useState<number | null>(null);

  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");

  // TOC state
  const [showTOC, setShowTOC] = useState(false);
  const [tocItems, setTocItems] = useState<TOCItem[]>([]);
  const [wasPlayingBeforeTOC, setWasPlayingBeforeTOC] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const progressSaveRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const currentWordRef = useRef<HTMLSpanElement>(null);
  const readingContainerRef = useRef<HTMLDivElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // ── Derived data ──
  const shortTexts = useMemo(() => texts.filter((t) => t.source !== "pdf"), [texts]);
  const pdfTexts = useMemo(() => texts.filter((t) => t.source === "pdf"), [texts]);

  // ── Load texts ──
  useEffect(() => {
    const textIdParam = searchParams.get("textId");
    db.texts.toArray().then((t) => {
      setTexts(t);
      if (t.length > 0) {
        if (textIdParam) {
          const target = t.find((tx) => tx.id === Number(textIdParam));
          if (target) {
            setSelectedText(target);
            setTextPickerTab(target.source === "pdf" ? "pdf" : "short");
          } else {
            setSelectedText(t[0]);
          }
        } else {
          setSelectedText(t[0]);
        }
      }
    });
  }, [searchParams]);

  // ── Check saved progress for all texts ──
  useEffect(() => {
    if (!currentUser?.id) return;
    const checkProgress = async () => {
      const map = new Map<number, boolean>();
      for (const text of texts) {
        if (!text.id) continue;
        const p = await db.readingProgress
          .where("[userId+textId]")
          .equals([currentUser.id, text.id])
          .first();
        if (p && !p.completed) {
          map.set(text.id, true);
        }
      }
      setSavedProgressMap(map);
    };
    if (texts.length > 0) checkProgress();
  }, [texts, currentUser?.id]);

  // ── PDF Upload ──
  const handlePdfUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setPdfLoading(true);
      setPdfError("");

      try {
        const { extractTextFromPdf } = await import("@/lib/utils/pdfParser");
        const result = await extractTextFromPdf(file);

        if (result.wordCount < 10) {
          setPdfError("Не вдалося витягти достатньо тексту з PDF");
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
        setSelectedText(newText);
        setTextPickerTab("pdf");

        if (api.isOnline()) {
          try {
            await api.post("/texts/upload", {
              title: result.title,
              content: result.text,
              wordCount: result.wordCount,
            });
          } catch {
            // Will exist locally
          }
        }
      } catch (err) {
        console.error("PDF parsing failed:", err);
        setPdfError("Помилка читання PDF файлу");
      } finally {
        setPdfLoading(false);
        if (pdfInputRef.current) pdfInputRef.current.value = "";
      }
    },
    []
  );

  // ── Start reading ──
  const start = useCallback(
    async (fromResume = false, overrideStartIdx?: number) => {
      if (!selectedText) return;
      const p = parseTextIntoParagraphs(selectedText.content);
      setParagraphs(p);
      const words = flattenParagraphs(p);
      setTotalWords(words.length);

      const toc = buildTocItems(selectedText);
      setTocItems(toc);

      let startIdx = overrideStartIdx ?? 0;
      let elapsed = 0;

      if (fromResume && currentUser?.id && selectedText.id) {
        const saved = await loadProgress(currentUser.id, selectedText.id);
        if (saved) {
          startIdx = saved.currentWordIndex;
          elapsed = saved.elapsedSeconds;
          setWpm(saved.wpm);
          setFontSize(saved.fontSize);
          setResumedFromIndex(startIdx);
        }
      }

      setCurrentWordIndex(startIdx);
      setResumedElapsed(elapsed * 1000);
      setStartTime(Date.now());
      setStartFromWordIndex(null);
      setGameState("playing");
    },
    [selectedText, currentUser?.id, loadProgress]
  );

  // ── Word advancement timer ──
  useEffect(() => {
    if (gameState !== "playing") return;

    const msPerWord = 60000 / wpm;
    intervalRef.current = setInterval(() => {
      setCurrentWordIndex((prev) => {
        const next = prev + 1;
        if (next >= totalWords) {
          clearInterval(intervalRef.current);
          setGameState("done");
          return prev;
        }
        return next;
      });
    }, msPerWord);

    return () => clearInterval(intervalRef.current);
  }, [gameState, wpm, totalWords]);

  // ── Auto-scroll to current word ──
  useEffect(() => {
    if (currentWordRef.current && readingContainerRef.current) {
      const container = readingContainerRef.current;
      const word = currentWordRef.current;
      const containerRect = container.getBoundingClientRect();
      const wordRect = word.getBoundingClientRect();

      if (
        wordRect.top < containerRect.top + 40 ||
        wordRect.bottom > containerRect.bottom - 40
      ) {
        word.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentWordIndex]);

  // ── Auto-save progress every 30s ──
  useEffect(() => {
    if (gameState === "playing" && currentUser?.id && selectedText?.id) {
      progressSaveRef.current = setInterval(() => {
        saveProgressToDb();
      }, 30000);
    }
    return () => clearInterval(progressSaveRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, currentUser?.id, selectedText?.id]);

  const saveProgressToDb = useCallback(() => {
    if (!currentUser?.id || !selectedText?.id) return;
    const elapsed = Math.round((Date.now() - startTime + resumedElapsed) / 1000);
    saveProgress({
      userId: currentUser.id,
      textId: selectedText.id,
      currentWordIndex,
      totalWords,
      wpm,
      fontSize,
      elapsedSeconds: elapsed,
      completed: false,
      updatedAt: new Date(),
    });
  }, [currentUser?.id, selectedText?.id, currentWordIndex, totalWords, wpm, fontSize, startTime, resumedElapsed, saveProgress]);

  // ── On completion ──
  useEffect(() => {
    if (gameState === "done" && currentUser?.id && selectedText) {
      const duration = Math.round((Date.now() - startTime + resumedElapsed) / 1000);
      saveSession({
        userId: currentUser.id,
        sessionType: "longread",
        date: new Date(),
        duration,
        result: {
          textId: selectedText.id,
          wordsRead: totalWords,
          wpm,
          completed: true,
          resumedFrom: resumedFromIndex ?? undefined,
        },
        score: POINTS.longread,
        speed: wpm,
      });
      if (selectedText.id) {
        clearProgress(currentUser.id, selectedText.id);
      }
      confetti({
        particleCount: 60,
        spread: 55,
        origin: { y: 0.7 },
        colors: ["#6750A4", "#D0BCFF", "#0D9488"],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  // ── Pause / Resume ──
  const handlePause = () => {
    if (gameState === "playing") {
      clearInterval(intervalRef.current);
      clearInterval(progressSaveRef.current);
      saveProgressToDb();
      setGameState("paused");
    } else if (gameState === "paused") {
      setGameState("playing");
    }
  };

  // ── Stop (save & return) ──
  const handleStop = () => {
    clearInterval(intervalRef.current);
    clearInterval(progressSaveRef.current);
    saveProgressToDb();
    setGameState("settings");
  };

  // ── Speed adjustment ──
  const handleSpeedChange = (delta: number) => {
    setWpm((prev) => Math.max(60, Math.min(1000, prev + delta)));
  };

  // ── TOC handlers ──
  const handleOpenTOC = () => {
    const wasPlaying = gameState === "playing";
    setWasPlayingBeforeTOC(wasPlaying);
    if (wasPlaying) {
      clearInterval(intervalRef.current);
      clearInterval(progressSaveRef.current);
      setGameState("paused");
    }
    setShowTOC(true);
  };

  const handleTocSelect = (wordIndex: number) => {
    setShowTOC(false);
    if (gameState === "settings") {
      // In settings — remember chosen chapter, start from it
      setStartFromWordIndex(wordIndex);
    } else {
      // During reading — jump to position
      setCurrentWordIndex(wordIndex);
      if (wasPlayingBeforeTOC) {
        setGameState("playing");
      }
    }
  };

  const handleTocClose = () => {
    setShowTOC(false);
    if (gameState !== "settings" && wasPlayingBeforeTOC) {
      setGameState("playing");
    }
  };

  // ── Computed values ──
  const progress = totalWords > 0 ? currentWordIndex / totalWords : 0;
  const duration = startTime
    ? Math.round((Date.now() - startTime + resumedElapsed) / 1000)
    : 0;
  const hasResume = selectedText?.id ? savedProgressMap.has(selectedText.id) : false;

  const settingsTocItems = useMemo(() => {
    if (!selectedText) return [];
    return buildTocItems(selectedText);
  }, [selectedText]);

  const paragraphOffsets = useMemo(() => {
    const offsets: number[] = [];
    let sum = 0;
    for (const p of paragraphs) {
      offsets.push(sum);
      sum += p.length;
    }
    return offsets;
  }, [paragraphs]);

  // Find the title of the selected start chapter
  const startChapterTitle = useMemo(() => {
    if (startFromWordIndex === null || settingsTocItems.length === 0) return null;
    const item = settingsTocItems.reduce((best, it) =>
      startFromWordIndex >= it.wordStart ? it : best
    , settingsTocItems[0]);
    return item.title;
  }, [startFromWordIndex, settingsTocItems]);

  // ─── RENDER ──────────────────────────────────────────

  return (
    <AppShell>
      <div className="max-w-lg mx-auto px-4 pt-4 pb-24 min-h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => {
              if (gameState === "playing" || gameState === "paused") {
                handleStop();
              } else {
                router.back();
              }
            }}
            className="p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-lg font-bold flex-1">Довге читання</h1>
          {(gameState === "playing" || gameState === "paused") && (
            <div className="flex items-center gap-1">
              {tocItems.length > 0 && (
                <button
                  onClick={handleOpenTOC}
                  className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
                  title="Зміст"
                >
                  <List size={20} />
                </button>
              )}
              <button
                onClick={handlePause}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {gameState === "paused" ? <Play size={20} /> : <Pause size={20} />}
              </button>
            </div>
          )}
        </div>

        {/* ── SETTINGS SCREEN ── */}
        {gameState === "settings" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col">
            {/* Text picker */}
            <div className="card mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Текст</h3>
                <button
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={pdfLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-500/20 transition-all"
                >
                  {pdfLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <FileUp size={14} />
                  )}
                  {pdfLoading ? "Обробка..." : "PDF"}
                </button>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handlePdfUpload}
                />
              </div>

              {pdfError && (
                <p className="text-xs text-red-500 mb-2">{pdfError}</p>
              )}

              {selectedText ? (
                <button
                  onClick={() => setShowTextPicker(!showTextPicker)}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-left flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm flex items-center gap-2">
                      {selectedText.source === "pdf" && (
                        <FileText size={14} className="shrink-0 text-teal-500" />
                      )}
                      <span className="truncate">{selectedText.title}</span>
                      {selectedText.id && savedProgressMap.has(selectedText.id) && (
                        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400">
                          Є прогрес
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{selectedText.wordCount} слів</div>
                  </div>
                  {showTextPicker ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              ) : (
                <p className="text-sm text-gray-500">
                  Бібліотека порожня. Завантажте PDF або додайте тексти.
                </p>
              )}

              {showTextPicker && (
                <div className="mt-2">
                  {/* Tab switcher inside picker */}
                  <div className="flex gap-1 mb-2">
                    <button
                      onClick={() => setTextPickerTab("short")}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                        textPickerTab === "short"
                          ? "bg-primary/10 text-primary"
                          : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      )}
                    >
                      <BookOpen size={12} />
                      Короткі ({shortTexts.length})
                    </button>
                    <button
                      onClick={() => setTextPickerTab("pdf")}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                        textPickerTab === "pdf"
                          ? "bg-teal-500/10 text-teal-600 dark:text-teal-400"
                          : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      )}
                    >
                      <FileText size={12} />
                      PDF ({pdfTexts.length})
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {(textPickerTab === "short" ? shortTexts : pdfTexts).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setSelectedText(t);
                          setShowTextPicker(false);
                          setStartFromWordIndex(null);
                        }}
                        className={cn(
                          "w-full p-2 rounded-lg text-left text-sm transition-all flex items-center gap-2",
                          selectedText?.id === t.id
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-gray-100 dark:hover:bg-gray-700"
                        )}
                      >
                        <span className="flex-1 truncate">
                          {t.title} ({t.wordCount} слів)
                        </span>
                        {t.id && savedProgressMap.has(t.id) && (
                          <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-600">
                            ▶
                          </span>
                        )}
                      </button>
                    ))}
                    {(textPickerTab === "short" ? shortTexts : pdfTexts).length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-3">
                        {textPickerTab === "pdf" ? "Немає PDF файлів" : "Немає текстів"}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* TOC section selector (for PDFs with chapters) */}
            {settingsTocItems.length > 0 && (
              <button
                onClick={() => setShowTOC(true)}
                className="card mb-4 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-500/10 flex items-center justify-center">
                  <List size={20} className="text-teal-600 dark:text-teal-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">
                    {startFromWordIndex !== null ? "Початок з розділу" : "Зміст"}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {startFromWordIndex !== null && startChapterTitle
                      ? startChapterTitle
                      : `${settingsTocItems.length} ${settingsTocItems.length === 1 ? "розділ" : settingsTocItems.length < 5 ? "розділи" : "розділів"} · ~${Math.max(1, Math.round((selectedText?.wordCount || 0) / 200))} хв`}
                  </div>
                </div>
                <ChevronDown size={18} className="text-gray-400 shrink-0" />
              </button>
            )}

            {/* Settings */}
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
                  min={60}
                  max={1000}
                  step={10}
                  value={wpm}
                  onChange={(e) => setWpm(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>60</span>
                  <span>1000</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Розмір шрифту</span>
                  <span className="font-bold">{fontSize}px</span>
                </div>
                <input
                  type="range"
                  min={14}
                  max={28}
                  step={2}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>14</span>
                  <span>28</span>
                </div>
              </div>
            </div>

            {/* Start buttons */}
            <div className="mt-auto space-y-2">
              {hasResume && startFromWordIndex === null && (
                <button
                  onClick={() => start(true)}
                  disabled={!selectedText}
                  className="btn-secondary w-full text-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Play size={20} />
                  Продовжити читання
                </button>
              )}
              <button
                onClick={() => start(false, startFromWordIndex ?? undefined)}
                disabled={!selectedText}
                className="btn-primary w-full text-lg disabled:opacity-50"
              >
                {startFromWordIndex !== null
                  ? "Читати з обраного розділу 📖"
                  : hasResume
                  ? "Почати спочатку"
                  : "Почати читання 📖"}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── READING SCREEN ── */}
        {(gameState === "playing" || gameState === "paused") && (
          <div className="flex-1 flex flex-col">
            <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mb-2 overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full transition-all duration-150"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mb-3">
              <span>
                {currentWordIndex}/{totalWords} слів
              </span>
              <span>{wpm} сл/хв</span>
            </div>

            <div
              ref={readingContainerRef}
              className="flex-1 overflow-y-auto rounded-2xl bg-gray-50 dark:bg-gray-800/50 p-4 min-h-[300px] max-h-[55vh]"
              style={{ fontSize: `${fontSize}px`, lineHeight: "1.8" }}
            >
              {gameState === "paused" && !showTOC ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Play size={48} className="mb-3" />
                  <p className="text-base font-medium">Пауза</p>
                  <p className="text-sm mt-1">Натисніть ▶ для продовження</p>
                </div>
              ) : (
                paragraphs.map((paragraph, pIdx) => (
                  <p key={pIdx} className="mb-4">
                    {paragraph.map((word, wIdx) => {
                      const globalIdx = paragraphOffsets[pIdx] + wIdx;
                      const isHighlighted = globalIdx === currentWordIndex;
                      const isRead = globalIdx < currentWordIndex;
                      return (
                        <span
                          key={wIdx}
                          ref={isHighlighted ? currentWordRef : undefined}
                          className={cn(
                            "transition-colors duration-100",
                            isHighlighted &&
                              "bg-teal-500/20 text-teal-700 dark:text-teal-300 font-semibold rounded px-0.5",
                            isRead && "text-gray-400 dark:text-gray-500",
                            !isRead &&
                              !isHighlighted &&
                              "text-gray-800 dark:text-gray-200"
                          )}
                        >
                          {word}{" "}
                        </span>
                      );
                    })}
                  </p>
                ))
              )}
            </div>

            <div className="flex items-center justify-between mt-3 gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleSpeedChange(wpm <= 150 ? -10 : -50)}
                  className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold text-sm"
                >
                  −
                </button>
                <span className="font-bold text-xs w-16 text-center">{wpm}</span>
                <button
                  onClick={() => handleSpeedChange(wpm < 150 ? 10 : 50)}
                  className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold text-sm"
                >
                  +
                </button>
              </div>

              <button
                onClick={handlePause}
                className="w-12 h-12 rounded-full bg-teal-500 text-white flex items-center justify-center shadow-lg"
              >
                {gameState === "paused" ? <Play size={22} /> : <Pause size={22} />}
              </button>

              <button
                onClick={handleStop}
                className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/10 text-red-500 flex items-center justify-center"
              >
                <Square size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── DONE SCREEN ── */}
        {gameState === "done" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center text-center"
          >
            <div className="text-6xl mb-4">📖</div>
            <h2 className="text-2xl font-bold mb-2">Текст прочитано!</h2>
            <p className="text-gray-500 mb-6">{selectedText?.title}</p>

            <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-8">
              <div className="card text-center">
                <div className="text-sm text-gray-500">Слів</div>
                <div className="text-2xl font-bold">{totalWords}</div>
              </div>
              <div className="card text-center">
                <div className="text-sm text-gray-500">Швидкість</div>
                <div className="text-2xl font-bold">{wpm} сл/хв</div>
              </div>
              <div className="card text-center">
                <div className="text-sm text-gray-500">Бали</div>
                <div className="text-2xl font-bold text-teal-600">+{POINTS.longread}</div>
              </div>
              <div className="card text-center">
                <div className="text-sm text-gray-500">Час</div>
                <div className="text-2xl font-bold">
                  {Math.round(duration / 60) > 0
                    ? `${Math.round(duration / 60)} хв`
                    : `${duration}с`}
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
              <button
                onClick={() => start(false)}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
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

      {/* ── TOC Overlay ── */}
      {showTOC && (
        <TableOfContents
          items={gameState === "settings" ? settingsTocItems : tocItems}
          currentWordIndex={gameState === "settings" ? (startFromWordIndex ?? 0) : currentWordIndex}
          totalWords={selectedText?.wordCount || totalWords}
          onSelectItem={handleTocSelect}
          onClose={handleTocClose}
        />
      )}
    </AppShell>
  );
}
