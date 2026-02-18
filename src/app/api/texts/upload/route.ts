import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const uploadSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(10),
  wordCount: z.number().min(1),
  outline: z
    .array(
      z.object({
        title: z.string(),
        pageIndex: z.number(),
        level: z.number(),
      })
    )
    .optional(),
  pageWordOffsets: z.array(z.number()).optional(),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = uploadSchema.parse(body);

    const text = await prisma.text.create({
      data: {
        title: data.title,
        content: data.content,
        difficulty: 3,
        ageGroup: "5-8",
        category: "завантажені",
        wordCount: data.wordCount,
        source: "pdf",
        userId: session.user.id,
        outline: data.outline ?? undefined,
        pageWordOffsets: data.pageWordOffsets ?? undefined,
      },
    });

    return NextResponse.json(text, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Text upload error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const textId = searchParams.get("id");

    if (!textId) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    // Only allow deleting own PDF texts
    const text = await prisma.text.findFirst({
      where: { id: textId, userId: session.user.id, source: "pdf" },
    });

    if (!text) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.text.delete({ where: { id: textId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Text delete error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
