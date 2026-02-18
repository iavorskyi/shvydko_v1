import * as pdfjsLib from "pdfjs-dist";

// Use CDN-hosted worker to avoid webpack bundling issues
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export interface PdfOutlineItem {
  title: string;
  pageIndex: number; // 0-based page index
  level: number; // nesting depth (0 = top level)
}

export interface PdfParseResult {
  text: string;
  title: string;
  wordCount: number;
  pageCount: number;
  outline: PdfOutlineItem[];
  pageWordOffsets: number[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OutlineNode = {
  title: string;
  dest: string | unknown[] | null;
  items: OutlineNode[];
};

/**
 * Recursively flatten the PDF outline tree, resolving page indices for each entry.
 */
async function flattenOutline(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdf: any,
  nodes: OutlineNode[],
  level: number
): Promise<PdfOutlineItem[]> {
  const result: PdfOutlineItem[] = [];

  for (const node of nodes) {
    let pageIndex = 0;

    try {
      if (node.dest) {
        let dest = node.dest;
        // If dest is a string name, resolve it
        if (typeof dest === "string") {
          dest = await pdf.getDestination(dest);
        }
        if (Array.isArray(dest) && dest.length > 0) {
          const ref = dest[0];
          pageIndex = await pdf.getPageIndex(ref);
        }
      }
    } catch {
      // If we can't resolve the page, default to 0
      pageIndex = 0;
    }

    result.push({
      title: node.title || `Розділ ${result.length + 1}`,
      pageIndex,
      level,
    });

    // Recurse into children
    if (node.items && node.items.length > 0) {
      const children = await flattenOutline(pdf, node.items, level + 1);
      result.push(...children);
    }
  }

  return result;
}

export async function extractTextFromPdf(file: File): Promise<PdfParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";
  const pageWordOffsets: number[] = [];
  let cumulativeWordCount = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    // Record word offset for this page BEFORE adding its text
    pageWordOffsets.push(cumulativeWordCount);

    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => item.str as string)
      .join(" ");

    // Count words in this page's text
    const pageWords = pageText
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
    cumulativeWordCount += pageWords;

    fullText += pageText + "\n\n";
  }

  // Clean up whitespace but preserve paragraph breaks
  const cleanedText = fullText
    .replace(/[ \t]+/g, " ") // collapse spaces/tabs
    .replace(/\n{3,}/g, "\n\n") // max 2 newlines
    .trim();

  const wordCount = cleanedText
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  const title = file.name.replace(/\.pdf$/i, "");

  // Extract PDF outline (table of contents / bookmarks)
  let outline: PdfOutlineItem[] = [];
  try {
    const rawOutline = await pdf.getOutline();
    if (rawOutline && rawOutline.length > 0) {
      outline = await flattenOutline(pdf, rawOutline as OutlineNode[], 0);
    }
  } catch {
    // PDF has no outline — that's fine
  }

  return {
    text: cleanedText,
    title,
    wordCount,
    pageCount: pdf.numPages,
    outline,
    pageWordOffsets,
  };
}
