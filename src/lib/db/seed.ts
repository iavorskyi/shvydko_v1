import { db } from "./index";
import { api } from "@/lib/services/api";
import type { Text, TestQuestion, PdfOutlineItem } from "@/types";

export async function seedDatabase() {
  const textCount = await db.texts.count();
  if (textCount > 0) return; // Already seeded

  // Try to load from server first
  if (api.isOnline()) {
    try {
      const serverTexts = await api.get<Text[]>("/texts");
      if (serverTexts.length > 0) {
        for (const text of serverTexts) {
          await db.texts.add({
            ...text,
            builtinKey: text.title,
            source: "builtin",
            isFavorite: 0,
            createdAt: new Date(),
          } as Text);
        }
        console.log(`Seeded ${serverTexts.length} texts from server`);
        return;
      }
    } catch {
      // Fall back to local seeding
    }
  }

  // Local fallback: seed from bundled content
  try {
    const { BUILTIN_TEXTS, BUILTIN_QUESTIONS } = await import("@/lib/content/texts");

    // Add all texts
    const textIdMap = new Map<string, number>();

    for (const builtinText of BUILTIN_TEXTS) {
      const id = await db.texts.add({
        title: builtinText.title,
        content: builtinText.content,
        difficulty: builtinText.difficulty,
        ageGroup: builtinText.ageGroup,
        category: builtinText.category,
        wordCount: builtinText.wordCount,
        source: "builtin",
        isFavorite: 0,
        builtinKey: builtinText.title,
        createdAt: new Date(),
      } as Text);
      textIdMap.set(builtinText.title, id);
    }

    // Add all questions
    for (const q of BUILTIN_QUESTIONS) {
      const textId = textIdMap.get(q.textTitle);
      if (textId) {
        await db.testQuestions.add({
          textId,
          question: q.question,
          questionType: q.questionType,
          correctAnswer: q.correctAnswer,
          options: q.options,
          explanation: q.explanation,
        } as TestQuestion);
      }
    }

    console.log(`Seeded ${BUILTIN_TEXTS.length} texts and ${BUILTIN_QUESTIONS.length} questions`);
  } catch (error) {
    console.error("Failed to seed database:", error);
  }
}

interface ServerPdfText {
  id: string;
  title: string;
  content: string;
  difficulty: number;
  ageGroup: string;
  category: string;
  wordCount: number;
  source: string;
  outline: PdfOutlineItem[] | null;
  pageWordOffsets: number[] | null;
  createdAt: string;
}

export async function restoreUserPdfTexts() {
  if (!api.isOnline()) return;

  try {
    const serverPdfs = await api.get<ServerPdfText[]>("/texts?source=pdf");
    if (!serverPdfs || serverPdfs.length === 0) return;

    let restored = 0;
    for (const serverText of serverPdfs) {
      // Check if already exists locally by serverId
      const existing = await db.texts
        .where("serverId")
        .equals(serverText.id)
        .first();
      if (existing) continue;

      await db.texts.add({
        serverId: serverText.id,
        title: serverText.title,
        content: serverText.content,
        difficulty: serverText.difficulty,
        ageGroup: serverText.ageGroup as "1-4" | "5-8" | "9-11",
        category: serverText.category,
        wordCount: serverText.wordCount,
        source: "pdf",
        isFavorite: 0,
        createdAt: new Date(serverText.createdAt),
        outline: serverText.outline ?? undefined,
        pageWordOffsets: serverText.pageWordOffsets ?? undefined,
        pendingSync: false,
      } as Text);
      restored++;
    }

    if (restored > 0) {
      console.log(`Restored ${restored} PDF texts from server`);
    }
  } catch (error) {
    console.warn("Failed to restore PDF texts:", error);
  }
}
