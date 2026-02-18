import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!isValid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
      }
      // Allow session updates from client
      if (trigger === "update" && session) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            onboarded: true,
            name: true,
            avatarId: true,
            schoolClass: true,
            age: true,
          },
        });
        if (dbUser) {
          token.onboarded = dbUser.onboarded;
          token.name = dbUser.name;
          token.avatarId = dbUser.avatarId;
          token.schoolClass = dbUser.schoolClass;
          token.age = dbUser.age;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;

        // Fetch fresh profile data
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            onboarded: true,
            name: true,
            avatarId: true,
            schoolClass: true,
            age: true,
          },
        });
        if (dbUser) {
          session.user.onboarded = dbUser.onboarded;
          session.user.name = dbUser.name;
          session.user.avatarId = dbUser.avatarId;
          session.user.schoolClass = dbUser.schoolClass;
          session.user.age = dbUser.age;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
    newUser: "/onboarding",
  },
};
