import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source");

  // Return user's PDF texts with full metadata
  if (source === "pdf") {
    const pdfTexts = await prisma.text.findMany({
      where: {
        userId: session.user.id,
        source: "pdf",
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(pdfTexts);
  }

  // Default: return builtin texts only
  const texts = await prisma.text.findMany({
    where: { source: "builtin" },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      content: true,
      difficulty: true,
      ageGroup: true,
      category: true,
      wordCount: true,
      source: true,
      builtinKey: true,
    },
  });

  return NextResponse.json(texts);
}
