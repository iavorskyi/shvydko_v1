import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const uploadSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(10),
  wordCount: z.number().min(1),
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
