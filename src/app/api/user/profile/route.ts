import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const profileSchema = z.object({
  name: z.string().min(1).max(30),
  age: z.number().min(6).max(18),
  schoolClass: z.number().min(1).max(11),
  avatarId: z.number().min(0).max(7),
  onboarded: z.boolean().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      age: true,
      schoolClass: true,
      avatarId: true,
      onboarded: true,
      createdAt: true,
      lastLogin: true,
    },
  });

  return NextResponse.json(user);
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = profileSchema.parse(body);

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: data.name,
        age: data.age,
        schoolClass: data.schoolClass,
        avatarId: data.avatarId,
        onboarded: data.onboarded ?? true,
      },
    });

    return NextResponse.json({
      id: user.id,
      name: user.name,
      age: user.age,
      schoolClass: user.schoolClass,
      avatarId: user.avatarId,
      onboarded: user.onboarded,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
