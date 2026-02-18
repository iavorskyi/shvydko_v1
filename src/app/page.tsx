"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;

    if (session?.user) {
      router.replace("/home");
    } else {
      router.replace("/auth/login");
    }
  }, [session, status, router]);

  // Brief splash while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-primary">
      <div className="text-center text-white">
        <div className="text-6xl mb-4">📖</div>
        <h1 className="text-2xl font-bold">Швидкочитач</h1>
      </div>
    </div>
  );
}
