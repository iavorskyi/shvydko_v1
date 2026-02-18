import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const progressSchema = z.object({
  textId: z.string(),
  currentWordIndex: z.number().min(0),
  totalWords: z.number().min(1),
  wpm: z.number().min(30).max(2000),
  fontSize: z.number().min(12).max(32).optional(),
  elapsedSeconds: z.number().min(0),
  completed: z.boolean(),
});

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const textId = searchParams.get("textId");

  if (textId) {
    const progress = await prisma.readingProgress.findUnique({
      where: {
        userId_textId: {
          userId: session.user.id,
          textId,
        },
      },
    });
    return NextResponse.json(progress);
  }

  // Return all reading progress for user
  const allProgress = await prisma.readingProgress.findMany({
    where: { userId: session.user.id, completed: false },
  });

  return NextResponse.json(allProgress);
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = progressSchema.parse(body);

    const progress = await prisma.readingProgress.upsert({
      where: {
        userId_textId: {
          userId: session.user.id,
          textId: data.textId,
        },
      },
      update: {
        currentWordIndex: data.currentWordIndex,
        totalWords: data.totalWords,
        wpm: data.wpm,
        fontSize: data.fontSize ?? 16,
        elapsedSeconds: data.elapsedSeconds,
        completed: data.completed,
      },
      create: {
        userId: session.user.id,
        textId: data.textId,
        currentWordIndex: data.currentWordIndex,
        totalWords: data.totalWords,
        wpm: data.wpm,
        fontSize: data.fontSize ?? 16,
        elapsedSeconds: data.elapsedSeconds,
        completed: data.completed,
      },
    });

    return NextResponse.json(progress);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Reading progress save error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const textId = searchParams.get("textId");

  if (!textId) {
    return NextResponse.json({ error: "textId required" }, { status: 400 });
  }

  await prisma.readingProgress.deleteMany({
    where: {
      userId: session.user.id,
      textId,
    },
  });

  return NextResponse.json({ ok: true });
}
