import { db } from "./index";
import { api } from "@/lib/services/api";
import type { Text, TestQuestion } from "@/types";

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
