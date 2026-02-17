"use client";

import AppShell from "@/components/layout/AppShell";

export default function RootPage() {
  return (
    <AppShell>
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="text-center text-white">
          <div className="text-6xl mb-4">📖</div>
          <h1 className="text-2xl font-bold">Швидкочитач</h1>
        </div>
      </div>
    </AppShell>
  );
}
