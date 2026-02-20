"use client";

import { useRef, useCallback } from "react";

interface PdfScrollLineProps {
  currentPage: number; // 1-based
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function PdfScrollLine({
  currentPage,
  totalPages,
  onPageChange,
}: PdfScrollLineProps) {
  const barRef = useRef<HTMLDivElement>(null);

  const getPageFromX = useCallback(
    (clientX: number): number => {
      if (!barRef.current) return currentPage;
      const rect = barRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const page = Math.round(ratio * (totalPages - 1)) + 1;
      return Math.max(1, Math.min(totalPages, page));
    },
    [currentPage, totalPages]
  );

  function handleBarClick(e: React.MouseEvent<HTMLDivElement>) {
    onPageChange(getPageFromX(e.clientX));
  }

  function handleThumbPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    function onMove(ev: PointerEvent) {
      onPageChange(getPageFromX(ev.clientX));
    }
    function onUp() {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
    }
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  }

  const thumbPercent = totalPages <= 1 ? 0 : ((currentPage - 1) / (totalPages - 1)) * 100;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 select-none">
      <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 tabular-nums w-20">
        {currentPage} / {totalPages}
      </span>

      {/* Track */}
      <div
        ref={barRef}
        className="relative flex-1 h-6 flex items-center cursor-pointer"
        onClick={handleBarClick}
      >
        {/* Background rail */}
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700" />

        {/* Filled portion */}
        <div
          className="absolute left-0 h-1.5 rounded-full bg-teal-500"
          style={{ width: `${thumbPercent}%` }}
        />

        {/* Page tick marks */}
        {totalPages > 1 &&
          Array.from({ length: totalPages }, (_, i) => {
            const pct = (i / (totalPages - 1)) * 100;
            return (
              <div
                key={i}
                className="absolute w-px h-2.5 bg-gray-300 dark:bg-gray-600 rounded-full -translate-x-px"
                style={{ left: `${pct}%` }}
              />
            );
          })}

        {/* Draggable thumb */}
        <div
          className="absolute w-5 h-5 rounded-full bg-teal-500 shadow-md cursor-grab active:cursor-grabbing -translate-x-1/2 touch-none"
          style={{ left: `${thumbPercent}%` }}
          onPointerDown={handleThumbPointerDown}
        >
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">
            {currentPage}
          </div>
        </div>
      </div>
    </div>
  );
}
