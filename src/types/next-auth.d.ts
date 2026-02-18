import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      onboarded: boolean;
      avatarId: number | null;
      schoolClass: number | null;
      age: number | null;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    onboarded?: boolean;
    avatarId?: number | null;
    schoolClass?: number | null;
    age?: number | null;
  }
}
