"use client";

import { useEffect, useRef } from "react";
import type { WordPosition } from "./PdfPageRenderer";

interface PdfReadTrackerProps {
  pageWidth: number;
  pageHeight: number;
  words: WordPosition[];
  currentWordIndex: number;
  isPlaying: boolean;
  wpm: number;
  onClickWord: (index: number) => void;
}

const SHADOW_COLOR = "rgba(0, 0, 0, 0.58)";

export default function PdfReadTracker({
  pageWidth,
  pageHeight,
  words,
  currentWordIndex,
  isPlaying,
  wpm,
  onClickWord,
}: PdfReadTrackerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number | null>(null);

  // Continuous pixel position — what's actually drawn right now
  // px = horizontal pixel position on the current line
  // lineY = top Y of the current line being drawn
  const animPxRef   = useRef(0); // pixels from left on current line
  const animLineRef = useRef(0); // canvas Y of current line top
  const animLineHRef = useRef(12); // height of current line

  // Playback state refs (avoid stale closures in rAF)
  const isPlayingRef    = useRef(isPlaying);
  const wpmRef          = useRef(wpm);
  const wordsRef        = useRef(words);
  const wordIdxRef      = useRef(currentWordIndex);
  const pageWidthRef    = useRef(pageWidth);
  const pageHeightRef   = useRef(pageHeight);

  useEffect(() => { isPlayingRef.current    = isPlaying; },       [isPlaying]);
  useEffect(() => { wpmRef.current          = wpm; },             [wpm]);
  useEffect(() => { wordsRef.current        = words; },           [words]);
  useEffect(() => { wordIdxRef.current      = currentWordIndex; }, [currentWordIndex]);
  useEffect(() => { pageWidthRef.current    = pageWidth; },       [pageWidth]);
  useEffect(() => { pageHeightRef.current   = pageHeight; },      [pageHeight]);

  // ── Main rAF loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pageWidth || !pageHeight) return;

    canvas.width  = pageWidth;
    canvas.height = pageHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // On mount / page change: snap to current word position instantly
    const snapWord = words[currentWordIndex];
    if (snapWord) {
      animLineRef.current  = snapWord.y;
      animLineHRef.current = snapWord.h || 12;
      animPxRef.current    = snapWord.x + snapWord.w;
    } else {
      animLineRef.current  = 0;
      animLineHRef.current = 12;
      animPxRef.current    = 0;
    }

    let lastTs = performance.now();

    function draw(ts: number) {
      if (!ctx) return;

      const dt = Math.min((ts - lastTs) / 1000, 0.05); // seconds, capped at 50ms
      lastTs = ts;

      const pw   = pageWidthRef.current;
      const ph   = pageHeightRef.current;
      const wds  = wordsRef.current;
      const playing = isPlayingRef.current;

      if (playing && wds.length > 0) {
        const totalW = wds.reduce((s, w) => s + w.w, 0);
        const avgWordW = totalW / wds.length || 40;
        const wordsPerLine = Math.max(1, pw / (avgWordW * 1.5)); // 1.5 accounts for spaces
        const linesPerSec  = wpmRef.current / 60 / wordsPerLine;
        const pxPerSec     = pw * linesPerSec;

        animPxRef.current += pxPerSec * dt;

        // Compute the right-most edge of the last word on the current line
        const curLineY = animLineRef.current;
        const lineWords = wds.filter(w => Math.abs(w.y - curLineY) <= 4);
        const lineEndPx = lineWords.length > 0
          ? Math.max(...lineWords.map(w => w.x + w.w))
          : pw;

        // If we've crossed past the end of the current line → advance to next line
        if (animPxRef.current >= lineEndPx) {
          const nextLineWord = wds.find(w => w.y > curLineY + 2);
          if (nextLineWord) {
            const overflow = animPxRef.current - lineEndPx;
            animLineRef.current  = nextLineWord.y;
            animLineHRef.current = nextLineWord.h || 12;
            animPxRef.current    = overflow; // carry over overflow into next line
          } else {
            // No more lines on page — clamp to last word end
            animPxRef.current = lineEndPx;
          }
        }
      }

      const lineY  = animLineRef.current;
      const lineH  = animLineHRef.current;
      // Clamp to right edge of last word on this line
      const lineWords = wordsRef.current.filter(w => Math.abs(w.y - lineY) <= 4);
      const lineEndPx = lineWords.length > 0
        ? Math.max(...lineWords.map(w => w.x + w.w))
        : pw;
      const curPx  = Math.min(animPxRef.current, lineEndPx);

      // Find next line Y to compute half the inter-line gap
      const nextLineWord = wordsRef.current.find(w => w.y > lineY + 2);
      const nextLineY = nextLineWord ? nextLineWord.y : lineY + lineH;
      const halfGap = Math.round((nextLineY - (lineY + lineH)) / 2);
      const shadowH = lineH + halfGap;

      ctx.clearRect(0, 0, pw, ph);

      ctx.fillStyle = SHADOW_COLOR;

      // Full dark block above current line — covers completely
      if (lineY > 0) {
        ctx.fillRect(0, 0, pw, lineY);
      }

      // Partial dark on current line + half the gap below it
      if (curPx > 0) {
        ctx.fillRect(0, lineY, curPx, shadowH);
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageWidth, pageHeight, words]);

  // ── Click → nearest word ──────────────────────────────────────────────────
  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!words.length) return;
    const rect   = e.currentTarget.getBoundingClientRect();
    const scaleX = pageWidth  / rect.width;
    const scaleY = pageHeight / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top)  * scaleY;

    let best = 0, bestDist = Infinity;
    for (let i = 0; i < words.length; i++) {
      const w = words[i]!;
      const d = Math.hypot(mx - (w.x + w.w / 2), my - (w.y + w.h / 2));
      if (d < bestDist) { bestDist = d; best = i; }
    }
    // Snap animation to clicked word
    const clicked = words[best]!;
    animLineRef.current  = clicked.y;
    animLineHRef.current = clicked.h || 12;
    // Clamp to right edge of last word on clicked line
    const cLineWords = words.filter(w => Math.abs(w.y - clicked.y) <= 4);
    const cLineEnd = cLineWords.length > 0 ? Math.max(...cLineWords.map(w => w.x + w.w)) : pageWidth;
    animPxRef.current = Math.min(clicked.x, cLineEnd);
    onClickWord(best);
  }

  if (!pageWidth || !pageHeight) return null;

  return (
    <canvas
      ref={canvasRef}
      width={pageWidth}
      height={pageHeight}
      onClick={handleClick}
      className="absolute inset-0 cursor-pointer"
      style={{ width: pageWidth, height: pageHeight }}
    />
  );
}
