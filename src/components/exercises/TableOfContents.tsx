"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, BookOpen, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface TOCItem {
  title: string;
  wordStart: number;
  level: number;
}

interface TOCProps {
  items: TOCItem[];
  currentWordIndex: number;
  totalWords: number;
  onSelectItem: (wordIndex: number) => void;
  onClose: () => void;
  readOnly?: boolean;
}

export default function TableOfContents({
  items,
  currentWordIndex,
  totalWords,
  onSelectItem,
  onClose,
  readOnly = false,
}: TOCProps) {
  // Determine which section is currently active
  const activeIndex = items.reduce((activeIdx, item, idx) => {
    if (currentWordIndex >= item.wordStart) return idx;
    return activeIdx;
  }, 0);

  // Pre-calculate section word counts and progress
  const sectionInfo = useMemo(() => {
    return items.map((item, idx) => {
      const start = item.wordStart;
      const end = idx < items.length - 1 ? items[idx + 1].wordStart : totalWords;
      const wordCount = end - start;
      const readingTimeMin = Math.max(1, Math.round(wordCount / 200));

      let progress = 0;
      if (currentWordIndex >= end) progress = 100;
      else if (currentWordIndex > start) {
        progress = Math.round(((currentWordIndex - start) / (end - start)) * 100);
      }

      return { wordCount, readingTimeMin, progress };
    });
  }, [items, totalWords, currentWordIndex]);

  // Overall progress
  const overallProgress = totalWords > 0 ? Math.round((currentWordIndex / totalWords) * 100) : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 350 }}
          className="absolute bottom-0 left-0 right-0 max-h-[80vh] bg-white dark:bg-gray-900 rounded-t-3xl overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-500/10 flex items-center justify-center">
                <BookOpen size={16} className="text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h3 className="font-bold text-base leading-tight">Зміст</h3>
                <p className="text-[11px] text-gray-400">
                  {items.length} {items.length === 1 ? "розділ" : items.length < 5 ? "розділи" : "розділів"}
                  {!readOnly && ` · ${overallProgress}% прочитано`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X size={18} className="text-gray-400" />
            </button>
          </div>

          {/* Overall progress bar */}
          {!readOnly && (
            <div className="px-5 pb-3">
              <div className="h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 rounded-full transition-all duration-300"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-gray-100 dark:bg-gray-800" />

          {/* Section list */}
          <div className="overflow-y-auto max-h-[calc(80vh-120px)] py-2 px-3">
            {items.map((item, idx) => {
              const isActive = idx === activeIndex && !readOnly;
              const info = sectionInfo[idx];
              const isRead = info.progress === 100;
              const isUpcoming = info.progress === 0 && !isActive;

              return (
                <button
                  key={idx}
                  onClick={() => {
                    if (!readOnly) onSelectItem(item.wordStart);
                  }}
                  disabled={readOnly}
                  className={cn(
                    "w-full text-left rounded-xl px-3 py-3 mb-1 flex gap-3 transition-all",
                    !readOnly && "hover:bg-gray-50 dark:hover:bg-gray-800/50 active:scale-[0.99]",
                    isActive && "bg-teal-50 dark:bg-teal-500/10 ring-1 ring-teal-200 dark:ring-teal-800",
                  )}
                  style={{ paddingLeft: `${12 + item.level * 20}px` }}
                >
                  {/* Status icon */}
                  <div className="pt-0.5 shrink-0">
                    {isRead ? (
                      <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center">
                        <Check size={14} className="text-white" strokeWidth={3} />
                      </div>
                    ) : isActive ? (
                      <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center">
                        <span className="text-[11px] font-bold text-white">{idx + 1}</span>
                      </div>
                    ) : (
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center border-2",
                        isUpcoming
                          ? "border-gray-200 dark:border-gray-700"
                          : "border-teal-300 dark:border-teal-700"
                      )}>
                        <span className={cn(
                          "text-[11px] font-bold",
                          isUpcoming ? "text-gray-400 dark:text-gray-600" : "text-teal-600 dark:text-teal-400"
                        )}>
                          {idx + 1}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm leading-snug",
                        isActive
                          ? "font-semibold text-teal-800 dark:text-teal-200"
                          : isRead
                          ? "font-medium text-gray-400 dark:text-gray-500"
                          : "font-medium text-gray-700 dark:text-gray-300"
                      )}
                    >
                      {item.title}
                    </p>

                    {/* Meta info */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn(
                        "text-[11px]",
                        isActive ? "text-teal-600 dark:text-teal-400" : "text-gray-400 dark:text-gray-500"
                      )}>
                        {info.wordCount} слів · ~{info.readingTimeMin} хв
                      </span>

                      {/* Section progress (only when partially read) */}
                      {info.progress > 0 && info.progress < 100 && (
                        <div className="flex items-center gap-1 flex-1 max-w-[80px]">
                          <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-teal-500 rounded-full"
                              style={{ width: `${info.progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">
                            {info.progress}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bottom safe area */}
          <div className="h-6" />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
