import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  let goals = await prisma.dailyGoal.findMany({
    where: { userId: session.user.id, date: today },
  });

  // Create default goals if none exist for today
  if (goals.length === 0) {
    const defaults = [
      { goalType: "sessions", target: 3 },
      { goalType: "minutes", target: 15 },
      { goalType: "texts", target: 2 },
    ];

    for (const d of defaults) {
      await prisma.dailyGoal.create({
        data: {
          userId: session.user.id,
          date: today,
          goalType: d.goalType,
          target: d.target,
          achieved: 0,
        },
      });
    }

    goals = await prisma.dailyGoal.findMany({
      where: { userId: session.user.id, date: today },
    });
  }

  return NextResponse.json(goals);
}
