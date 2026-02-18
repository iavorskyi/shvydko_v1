import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const testResultSchema = z.object({
  sessionId: z.string(),
  questionId: z.string(),
  userAnswer: z.string(),
  isCorrect: z.boolean(),
  timeSpent: z.number(),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = testResultSchema.parse(body);

    const result = await prisma.testResult.create({
      data: {
        sessionId: data.sessionId,
        questionId: data.questionId,
        userId: session.user.id,
        userAnswer: data.userAnswer,
        isCorrect: data.isCorrect,
        timeSpent: data.timeSpent,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Test result save error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
