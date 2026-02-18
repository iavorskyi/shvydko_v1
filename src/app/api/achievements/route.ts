import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const achievements = await prisma.achievement.findMany({
    where: { userId: session.user.id },
    orderBy: { earnedAt: "desc" },
  });

  return NextResponse.json(achievements);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { badgeType } = await request.json();

    const achievement = await prisma.achievement.upsert({
      where: {
        userId_badgeType: {
          userId: session.user.id,
          badgeType,
        },
      },
      update: {},
      create: {
        userId: session.user.id,
        badgeType,
        earnedAt: new Date(),
      },
    });

    return NextResponse.json(achievement, { status: 201 });
  } catch (error) {
    console.error("Achievement save error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
