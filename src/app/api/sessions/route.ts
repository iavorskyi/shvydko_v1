import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const sessionSchema = z.object({
  sessionType: z.enum(["peripheral", "schulte", "rsvp", "test", "longread"]),
  date: z.string().transform((s) => new Date(s)),
  duration: z.number().min(0),
  result: z.record(z.string(), z.unknown()),
  score: z.number().min(0),
  speed: z.number().optional(),
  comprehension: z.number().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await prisma.trainingSession.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "desc" },
    take: 100,
  });

  return NextResponse.json(sessions);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = sessionSchema.parse(body);

    const trainingSession = await prisma.trainingSession.create({
      data: {
        userId: session.user.id,
        sessionType: data.sessionType,
        date: data.date,
        duration: data.duration,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result: data.result as any,
        score: data.score,
        speed: data.speed,
        comprehension: data.comprehension,
      },
    });

    // Update daily goals
    const today = new Date().toISOString().split("T")[0];

    // Upsert sessions goal
    await prisma.dailyGoal.upsert({
      where: {
        userId_date_goalType: {
          userId: session.user.id,
          date: today,
          goalType: "sessions",
        },
      },
      update: { achieved: { increment: 1 } },
      create: {
        userId: session.user.id,
        date: today,
        goalType: "sessions",
        target: 3,
        achieved: 1,
      },
    });

    // Update minutes goal
    const addedMinutes = Math.max(1, Math.round(data.duration / 60));
    await prisma.dailyGoal.upsert({
      where: {
        userId_date_goalType: {
          userId: session.user.id,
          date: today,
          goalType: "minutes",
        },
      },
      update: { achieved: { increment: addedMinutes } },
      create: {
        userId: session.user.id,
        date: today,
        goalType: "minutes",
        target: 15,
        achieved: addedMinutes,
      },
    });

    // Update texts goal for rsvp/test
    if (data.sessionType === "rsvp" || data.sessionType === "test" || data.sessionType === "longread") {
      await prisma.dailyGoal.upsert({
        where: {
          userId_date_goalType: {
            userId: session.user.id,
            date: today,
            goalType: "texts",
          },
        },
        update: { achieved: { increment: 1 } },
        create: {
          userId: session.user.id,
          date: today,
          goalType: "texts",
          target: 2,
          achieved: 1,
        },
      });
    }

    return NextResponse.json(trainingSession, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Session save error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
