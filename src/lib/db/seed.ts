import { db } from "./index";
import type { Text, TestQuestion } from "@/types";

export async function seedDatabase() {
  const textCount = await db.texts.count();
  if (textCount > 0) return; // Already seeded

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
