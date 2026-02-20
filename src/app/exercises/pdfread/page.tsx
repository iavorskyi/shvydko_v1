"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  Suspense,
} from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Play,
  Pause,
  FileUp,
  List,
  Settings2,
  Trash2,
  FileText,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/lib/stores/userStore";
import { useSessionStore } from "@/lib/stores/sessionStore";
import { db } from "@/lib/db";
import { extractTextFromPdf } from "@/lib/utils/pdfParser";
import { POINTS } from "@/types";
import type { PdfFile, PdfOutlineItem } from "@/types";
import { cn } from "@/lib/utils/cn";
import AppShell from "@/components/layout/AppShell";
import PdfPageRenderer, { type WordPosition } from "@/components/exercises/PdfPageRenderer";
import PdfReadTracker from "@/components/exercises/PdfReadTracker";
import PdfScrollLine from "@/components/exercises/PdfScrollLine";
import TableOfContents, { type TOCItem } from "@/components/exercises/TableOfContents";
import type { PDFDocumentProxy } from "pdfjs-dist";

// ─── Progress helpers ─────────────────────────────────────────────────────────

function progressKey(userId: string, pdfId: number) {
  return `pdfread_progress_${userId}_${pdfId}`;
}
interface SavedProgress { currentPage: number; wordIndex: number; wpm: number; zoom: number; }

function loadSavedProgress(userId: string, pdfId: number): SavedProgress | null {
  try { const r = localStorage.getItem(progressKey(userId, pdfId)); return r ? JSON.parse(r) : null; }
  catch { return null; }
}
function saveProgressToStorage(userId: string, pdfId: number, d: SavedProgress) {
  try { localStorage.setItem(progressKey(userId, pdfId), JSON.stringify(d)); } catch { /* */ }
}
function clearProgress(userId: string, pdfId: number) {
  try { localStorage.removeItem(progressKey(userId, pdfId)); } catch { /* */ }
}

// ─── TOC builder ──────────────────────────────────────────────────────────────

function buildTocFromOutline(outline: PdfOutlineItem[], offsets: number[]): TOCItem[] {
  return outline.map((item) => ({ title: item.title, wordStart: offsets[item.pageIndex] ?? 0, level: item.level }));
}

const ZOOM_OPTIONS = [
  { label: "75%",  value: 0.75 },
  { label: "100%", value: 1.0  },
  { label: "125%", value: 1.25 },
  { label: "150%", value: 1.5  },
];

// ─── Main component ───────────────────────────────────────────────────────────

function PdfReadContent() {
  const router = useRouter();
  const { currentUser } = useUserStore();
  const { saveSession } = useSessionStore();

  type Screen = "library" | "settings" | "reading";
  const [screen, setScreen] = useState<Screen>("library");

  // Library
  const [pdfFiles, setPdfFiles]     = useState<PdfFile[]>([]);
  const [loadingLib, setLoadingLib] = useState(true);
  const [uploading, setUploading]   = useState(false);
  const [uploadErr, setUploadErr]   = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings
  const [selectedPdf, setSelectedPdf] = useState<PdfFile | null>(null);
  const [wpm,  setWpm]  = useState(200);
  const [zoom, setZoom] = useState(1.0);

  // Reading UI state
  const [pdfDoc,       setPdfDoc]       = useState<PDFDocumentProxy | null>(null);
  const [loadingPdf,   setLoadingPdf]   = useState(false);
  const [currentPage,  setCurrentPage]  = useState(1);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [showTOC,      setShowTOC]      = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tocItems,     setTocItems]     = useState<TOCItem[]>([]);
  const [pageWordOffsets, setPageWordOffsets] = useState<number[]>([]);
  const [totalWords,   setTotalWords]   = useState(0);

  // Word-precise state — drives canvas redraw
  const [pageWords,       setPageWords]       = useState<WordPosition[]>([]);
  const [currentWordIdx,  setCurrentWordIdx]  = useState(0);
  const [pageDims,        setPageDims]        = useState({ w: 0, h: 0 });

  // Refs (used inside setInterval — avoid stale closures)
  const wpmRef          = useRef(200);
  const zoomRef         = useRef(1.0);
  const currentPageRef  = useRef(1);
  const wordIdxRef      = useRef(0);
  const pageWordsRef    = useRef<WordPosition[]>([]);
  const pageDimsRef     = useRef({ w: 0, h: 0 });
  const pdfDocRef       = useRef<PDFDocumentProxy | null>(null);
  const elapsedRef      = useRef(0);
  const sessionStartRef = useRef(new Date());
  const selectedPdfRef  = useRef<PdfFile | null>(null);
  const currentUserRef  = useRef(currentUser);
  const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const pageResumeRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef    = useRef(false);
  const pendingWordRef  = useRef(0); // restore word index when new page words arrive

  // Keep refs in sync
  useEffect(() => { currentUserRef.current = currentUser; },   [currentUser]);
  useEffect(() => { selectedPdfRef.current = selectedPdf; },   [selectedPdf]);
  useEffect(() => { pdfDocRef.current      = pdfDoc; },        [pdfDoc]);
  useEffect(() => { wpmRef.current         = wpm; },           [wpm]);
  useEffect(() => { zoomRef.current        = zoom; },          [zoom]);

  // ── Stable callbacks for PdfPageRenderer ──────────────────────────────────

  const handleDimensionsReady = useCallback((w: number, h: number) => {
    pageDimsRef.current = { w, h };
    setPageDims({ w, h });
  }, []);

  const handleWordsReady = useCallback((words: WordPosition[]) => {
    pageWordsRef.current = words;
    setPageWords(words);

    // Restore pending word index (resume or page-advance)
    const idx = Math.min(pendingWordRef.current, Math.max(0, words.length - 1));
    pendingWordRef.current = 0;
    wordIdxRef.current = idx;
    setCurrentWordIdx(idx);
  }, []);

  // ── Library ────────────────────────────────────────────────────────────────

  const loadLibrary = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoadingLib(true);
    try {
      const files = await db.pdfFiles.where("userId").equals(currentUser.id).reverse().sortBy("createdAt");
      setPdfFiles(files);
    } finally { setLoadingLib(false); }
  }, [currentUser?.id]);

  useEffect(() => { loadLibrary(); }, [loadLibrary]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.id) return;
    setUploadErr(null); setUploading(true);
    try {
      const parsed = await extractTextFromPdf(file);
      await db.pdfFiles.add({
        userId: currentUser.id, title: parsed.title, fileName: file.name, fileData: file,
        pageCount: parsed.pageCount, outline: parsed.outline,
        pageWordOffsets: parsed.pageWordOffsets, createdAt: new Date(),
      });
      await loadLibrary();
    } catch { setUploadErr("Не вдалося завантажити PDF. Спробуй інший файл."); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  }

  async function handleDeletePdf(pdf: PdfFile, e: React.MouseEvent) {
    e.stopPropagation();
    if (!pdf.id) return;
    await db.pdfFiles.delete(pdf.id);
    if (currentUser?.id) clearProgress(currentUser.id, pdf.id);
    await loadLibrary();
  }

  // ── Select PDF ─────────────────────────────────────────────────────────────

  function handleSelectPdf(pdf: PdfFile) {
    setSelectedPdf(pdf); selectedPdfRef.current = pdf;
    if (currentUser?.id && pdf.id) {
      const saved = loadSavedProgress(currentUser.id, pdf.id);
      if (saved) { setWpm(saved.wpm); wpmRef.current = saved.wpm; setZoom(saved.zoom); zoomRef.current = saved.zoom; }
      else        { setWpm(200); wpmRef.current = 200; setZoom(1.0); zoomRef.current = 1.0; }
    }
    setScreen("settings");
  }

  // ── Start reading ──────────────────────────────────────────────────────────

  async function handleStartReading() {
    if (!selectedPdf) return;
    stopInterval(); setLoadingPdf(true); setScreen("reading");
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
      const buf = await selectedPdf.fileData.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: buf }).promise;
      setPdfDoc(doc); pdfDocRef.current = doc;

      const offsets = selectedPdf.pageWordOffsets ?? [];
      setPageWordOffsets(offsets);
      setTotalWords(offsets.length ? (offsets[offsets.length - 1] ?? 0) + 100 : 0);
      setTocItems(selectedPdf.outline?.length && offsets.length
        ? buildTocFromOutline(selectedPdf.outline, offsets) : []);

      let startPage = 1, startIdx = 0;
      if (currentUser?.id && selectedPdf.id) {
        const saved = loadSavedProgress(currentUser.id, selectedPdf.id);
        if (saved) { startPage = saved.currentPage; startIdx = saved.wordIndex; }
      }
      pendingWordRef.current    = startIdx;
      wordIdxRef.current        = startIdx;
      currentPageRef.current    = startPage;
      elapsedRef.current        = 0;
      sessionStartRef.current   = new Date();
      setCurrentPage(startPage);
      setCurrentWordIdx(startIdx);
      setIsPlaying(false); isPlayingRef.current = false;
    } catch (err) { console.error(err); }
    finally { setLoadingPdf(false); }
  }

  // ── Interval: word-by-word ─────────────────────────────────────────────────

  function stopInterval() {
    if (intervalRef.current   !== null) { clearInterval(intervalRef.current);   intervalRef.current   = null; }
    if (pageResumeRef.current !== null) { clearTimeout(pageResumeRef.current);  pageResumeRef.current = null; }
  }

  // Pause visually (isPlaying → false) and resume after `ms` milliseconds
  function pauseThenResume(ms: number) {
    if (intervalRef.current !== null) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (pageResumeRef.current !== null) { clearTimeout(pageResumeRef.current); pageResumeRef.current = null; }
    isPlayingRef.current = false;
    setIsPlaying(false);
    pageResumeRef.current = setTimeout(() => {
      pageResumeRef.current = null;
      isPlayingRef.current = true;
      setIsPlaying(true);
      startInterval();
    }, ms);
  }

  function startInterval() {
    if (intervalRef.current !== null) { clearInterval(intervalRef.current); intervalRef.current = null; }
    let msAccum = 0;
    intervalRef.current = setInterval(() => {
      msAccum += 100;
      elapsedRef.current += 0.1;
      const msPerWord = 60000 / wpmRef.current;

      while (msAccum >= msPerWord) {
        msAccum -= msPerWord;
        const words = pageWordsRef.current;
        const doc   = pdfDocRef.current;
        if (!doc || !words.length) return;

        const nextIdx = wordIdxRef.current + 1;

        if (nextIdx >= words.length) {
          // End of page — flip page then pause 2s before resuming
          const nextPage = currentPageRef.current + 1;
          if (nextPage > doc.numPages) {
            stopInterval(); isPlayingRef.current = false; setIsPlaying(false);
            setCurrentWordIdx(words.length - 1);
            finishSession(); return;
          }
          currentPageRef.current = nextPage;
          wordIdxRef.current     = 0;
          pendingWordRef.current = 0;
          setCurrentPage(nextPage);
          setCurrentWordIdx(0);
          pauseThenResume(2000);
          return;
        }

        wordIdxRef.current = nextIdx;
        setCurrentWordIdx(nextIdx);
      }
    }, 100);
  }

  function togglePlay() {
    if (isPlayingRef.current) {
      stopInterval(); isPlayingRef.current = false; setIsPlaying(false);
    } else {
      isPlayingRef.current = true; setIsPlaying(true); startInterval();
    }
  }

  useEffect(() => () => stopInterval(), []);

  // ── Auto-save every 30s ────────────────────────────────────────────────────

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      const user = currentUserRef.current; const pdf = selectedPdfRef.current;
      if (!user?.id || !pdf?.id) return;
      saveProgressToStorage(user.id, pdf.id, {
        currentPage: currentPageRef.current, wordIndex: wordIdxRef.current,
        wpm: wpmRef.current, zoom: zoomRef.current,
      });
    }, 30_000);
    return () => clearInterval(id);
  }, [isPlaying]);

  // ── Finish ─────────────────────────────────────────────────────────────────

  async function finishSession() {
    const user = currentUserRef.current; const pdf = selectedPdfRef.current;
    if (!user?.id || !pdf?.id) return;
    clearProgress(user.id, pdf.id);
    await saveSession({
      userId: user.id, sessionType: "pdfread", date: sessionStartRef.current,
      duration: Math.round(elapsedRef.current),
      result: { pdfId: pdf.id, title: pdf.title, pageCount: pdf.pageCount, wpm: wpmRef.current },
      score: POINTS.longread, speed: wpmRef.current,
    });
  }

  // ── Click word to jump ─────────────────────────────────────────────────────

  function handleClickWord(index: number) {
    wordIdxRef.current = index;
    setCurrentWordIdx(index);
    // Pause for 2s so user can orient, then start/resume from clicked word
    pauseThenResume(2000);
  }

  // ── Page navigation ────────────────────────────────────────────────────────

  function handlePageChange(page: number) {
    currentPageRef.current = page; wordIdxRef.current = 0; pendingWordRef.current = 0;
    setCurrentPage(page); setCurrentWordIdx(0);
  }

  function handleTocSelect(wordIndex: number) {
    let page = 1;
    for (let i = 0; i < pageWordOffsets.length; i++) {
      if ((pageWordOffsets[i] ?? 0) <= wordIndex) page = i + 1; else break;
    }
    currentPageRef.current = page; wordIdxRef.current = 0; pendingWordRef.current = 0;
    setCurrentPage(page); setCurrentWordIdx(0); setShowTOC(false);
  }

  // ── WPM control ────────────────────────────────────────────────────────────

  function adjustWpm(delta: number) {
    setWpm((prev) => {
      const step = prev <= 150 ? 10 : 50;
      const next = Math.max(60, Math.min(600, prev + delta * step));
      wpmRef.current = next; return next;
    });
  }

  // ── Back ───────────────────────────────────────────────────────────────────

  function handleBack() {
    stopInterval(); isPlayingRef.current = false; setIsPlaying(false);
    const user = currentUserRef.current; const pdf = selectedPdfRef.current;
    if (user?.id && pdf?.id) {
      saveProgressToStorage(user.id, pdf.id, {
        currentPage: currentPageRef.current, wordIndex: wordIdxRef.current,
        wpm: wpmRef.current, zoom: zoomRef.current,
      });
    }
    setPdfDoc(null); pdfDocRef.current = null; setScreen("library");
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: LIBRARY
  // ════════════════════════════════════════════════════════════════════════════

  if (screen === "library") {
    return (
      <AppShell>
        <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-6">
            <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold">PDF Читання</h1>
              <p className="text-xs text-gray-500">Твої PDF файли</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-4">
            <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors font-medium disabled:opacity-50">
              {uploading ? <><Loader2 size={18} className="animate-spin" />Завантаження…</> : <><FileUp size={18} />Завантажити PDF</>}
            </button>
            {uploadErr && <p className="text-sm text-red-500 mt-2 text-center">{uploadErr}</p>}
          </motion.div>

          {loadingLib ? (
            <div className="flex justify-center py-12"><Loader2 size={32} className="animate-spin text-gray-400" /></div>
          ) : pdfFiles.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
              <FileText size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">Немає PDF файлів</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Завантаж перший PDF щоб почати читання</p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {pdfFiles.map((pdf, i) => {
                const saved = currentUser?.id && pdf.id ? loadSavedProgress(currentUser.id, pdf.id) : null;
                const pct = saved ? Math.round((saved.currentPage / pdf.pageCount) * 100) : 0;
                return (
                  <motion.button key={pdf.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }} onClick={() => handleSelectPdf(pdf)}
                    className="card-interactive w-full text-left">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                        <FileText size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm line-clamp-2">{pdf.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{pdf.pageCount} стор. · {pdf.fileName}</p>
                        {saved && (
                          <div className="mt-2">
                            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                              <span>Прогрес</span><span>{saved.currentPage} / {pdf.pageCount} стор.</span>
                            </div>
                            <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div className="h-full bg-orange-400 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                      <button onClick={(e) => handleDeletePdf(pdf, e)}
                        className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors shrink-0">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: SETTINGS
  // ════════════════════════════════════════════════════════════════════════════

  if (screen === "settings") {
    return (
      <AppShell>
        <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-6">
            <button onClick={() => setScreen("library")} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate">{selectedPdf?.title}</h1>
              <p className="text-xs text-gray-500">{selectedPdf?.pageCount} сторінок</p>
            </div>
          </motion.div>

          <div className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card">
              <h3 className="font-semibold text-sm mb-3">Швидкість читання</h3>
              <div className="flex items-center gap-3">
                <button onClick={() => adjustWpm(-1)} className="w-10 h-10 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800">
                  <ChevronDown size={18} />
                </button>
                <div className="flex-1 text-center">
                  <span className="text-2xl font-bold">{wpm}</span>
                  <span className="text-sm text-gray-500 ml-1">сл/хв</span>
                </div>
                <button onClick={() => adjustWpm(1)} className="w-10 h-10 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800">
                  <ChevronUp size={18} />
                </button>
              </div>
              <input type="range" min={60} max={600} step={10} value={wpm}
                onChange={(e) => { const v = Number(e.target.value); setWpm(v); wpmRef.current = v; }}
                className="w-full mt-3 accent-orange-500" />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1"><span>60</span><span>600 сл/хв</span></div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card">
              <h3 className="font-semibold text-sm mb-3">Масштаб</h3>
              <div className="grid grid-cols-4 gap-2">
                {ZOOM_OPTIONS.map((opt) => (
                  <button key={opt.value} onClick={() => { setZoom(opt.value); zoomRef.current = opt.value; }}
                    className={cn("py-2 rounded-xl text-sm font-medium border transition-colors",
                      zoom === opt.value ? "border-orange-500 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800")}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </motion.div>

            <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              onClick={handleStartReading}
              className="w-full py-4 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-base transition-colors flex items-center justify-center gap-2">
              <Play size={20} />Почати читання
            </motion.button>
          </div>
        </div>
      </AppShell>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: READING
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <button onClick={handleBack} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <p className="flex-1 font-semibold text-sm truncate min-w-0">{selectedPdf?.title}</p>
        <span className="text-xs text-gray-400 shrink-0">{currentPage}/{selectedPdf?.pageCount ?? "?"}</span>
        <button onClick={togglePlay}
          className={cn("p-1.5 rounded-lg transition-colors", isPlaying ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600" : "hover:bg-gray-100 dark:hover:bg-gray-700")}>
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button onClick={() => setShowSettings((s) => !s)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <Settings2 size={18} />
        </button>
        {tocItems.length > 0 && (
          <button onClick={() => setShowTOC(true)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <List size={18} />
          </button>
        )}
      </div>

      {/* Inline settings panel */}
      {showSettings && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-20 shrink-0">Швидкість:</span>
            <button onClick={() => adjustWpm(-1)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronDown size={16} /></button>
            <span className="text-sm font-bold w-16 text-center shrink-0">{wpm} сл/хв</span>
            <button onClick={() => adjustWpm(1)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronUp size={16} /></button>
            <input type="range" min={60} max={600} step={10} value={wpm}
              onChange={(e) => { const v = Number(e.target.value); setWpm(v); wpmRef.current = v; }}
              className="flex-1 accent-orange-500" />
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-gray-500 w-20 shrink-0">Масштаб:</span>
            <div className="flex gap-1">
              {ZOOM_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => { setZoom(opt.value); zoomRef.current = opt.value; }}
                  className={cn("px-2 py-1 rounded text-xs font-medium border transition-colors",
                    zoom === opt.value ? "border-orange-500 bg-orange-50 dark:bg-orange-900/30 text-orange-600" : "border-gray-200 dark:border-gray-600")}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* PDF viewport */}
      <div className="flex-1 overflow-auto flex justify-center items-start py-4 px-2">
        {loadingPdf ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 size={36} className="animate-spin text-orange-500" />
            <p className="text-sm text-gray-500">Завантаження PDF…</p>
          </div>
        ) : pdfDoc ? (
          <div className="relative inline-block">
            <PdfPageRenderer
              pdfDoc={pdfDoc}
              pageNum={currentPage}
              scale={zoom}
              onDimensionsReady={handleDimensionsReady}
              onWordsReady={handleWordsReady}
            />
            {/* Canvas tracker — only render when page dims are known */}
            {pageDims.w > 0 && pageDims.h > 0 && (
              <PdfReadTracker
                pageWidth={pageDims.w}
                pageHeight={pageDims.h}
                words={pageWords}
                currentWordIndex={currentWordIdx}
                isPlaying={isPlaying}
                wpm={wpm}
                onClickWord={handleClickWord}
              />
            )}
          </div>
        ) : null}
      </div>

      {/* Scroll line */}
      {pdfDoc && selectedPdf && (
        <PdfScrollLine
          currentPage={currentPage}
          totalPages={selectedPdf.pageCount}
          onPageChange={handlePageChange}
        />
      )}

      {/* TOC */}
      {showTOC && tocItems.length > 0 && (
        <TableOfContents
          items={tocItems}
          currentWordIndex={pageWordOffsets[currentPage - 1] ?? 0}
          totalWords={totalWords}
          onSelectItem={handleTocSelect}
          onClose={() => setShowTOC(false)}
        />
      )}
    </div>
  );
}

export default function PdfReadPage() {
  return <Suspense><PdfReadContent /></Suspense>;
}
