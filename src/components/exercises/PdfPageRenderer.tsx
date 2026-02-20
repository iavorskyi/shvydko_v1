"use client";

import { useEffect, useRef, useCallback } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

export interface WordPosition {
  x: number;      // canvas pixel X of word left edge
  y: number;      // canvas pixel Y of word top edge
  w: number;      // canvas pixel width of word
  h: number;      // canvas pixel height (line height)
  word: string;
}

interface PdfPageRendererProps {
  pdfDoc: PDFDocumentProxy;
  pageNum: number;
  scale: number;
  onDimensionsReady: (width: number, height: number) => void;
  onWordsReady: (words: WordPosition[]) => void;
}

export default function PdfPageRenderer({
  pdfDoc,
  pageNum,
  scale,
  onDimensionsReady,
  onWordsReady,
}: PdfPageRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  const renderPage = useCallback(async () => {
    if (!canvasRef.current) return;

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    onDimensionsReady(viewport.width, viewport.height);

    const renderTask = page.render({ canvasContext: ctx, viewport });
    renderTaskRef.current = renderTask;

    try {
      await renderTask.promise;
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "RenderingCancelledException") {
        console.error("PDF render error:", err);
      }
      return;
    }

    // ── Extract per-word positions from text content ──────────────────────
    const textContent = await page.getTextContent();

    const words: WordPosition[] = [];

    for (const item of textContent.items) {
      if (!("str" in item) || !("transform" in item)) continue;
      const ti = item as {
        str: string;
        transform: number[];
        width: number;
        height: number;
      };

      const str = ti.str;
      if (!str.trim()) continue;

      // PDF coordinate system: origin bottom-left, Y grows up
      // transform = [scaleX, skewY, skewX, scaleY, translateX, translateY]
      const pdfX = ti.transform[4];
      const pdfY = ti.transform[5];
      const itemW = ti.width;
      const itemH = Math.abs(ti.height) || Math.abs(ti.transform[3]);

      // Convert to canvas coords (origin top-left, Y grows down)
      const canvasX = pdfX * scale;
      const canvasY = viewport.height - (pdfY + itemH) * scale;
      const canvasW = itemW * scale;
      const canvasH = itemH * scale;

      // Split item into individual words, distribute X evenly
      const parts = str.split(/(\s+)/).filter(Boolean);
      const textParts = parts.filter((p) => p.trim().length > 0);
      const spaceParts = parts.filter((p) => /^\s+$/.test(p));

      // Estimate avg char width to split X proportionally
      const totalChars = textParts.reduce((s, w) => s + w.length, 0);
      const charW = totalChars > 0 ? canvasW / totalChars : canvasW;

      let curX = canvasX;
      let spaceIdx = 0;

      for (const w of textParts) {
        const wWidth = w.length * charW;
        words.push({
          x: curX,
          y: canvasY,
          w: wWidth,
          h: canvasH,
          word: w,
        });
        curX += wWidth;
        // Add space width if available
        if (spaceIdx < spaceParts.length) {
          const spaceW = (spaceParts[spaceIdx]?.length ?? 1) * charW;
          curX += spaceW;
          spaceIdx++;
        }
      }
    }

    // Sort top-to-bottom, left-to-right
    words.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);

    onWordsReady(words);
  }, [pdfDoc, pageNum, scale, onDimensionsReady, onWordsReady]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  return (
    <canvas
      ref={canvasRef}
      className="block shadow-lg"
      style={{ maxWidth: "100%" }}
    />
  );
}
