import type { Metadata, Viewport } from "next";
import "./globals.css";
import ToastContainer from "@/components/shared/Toast";
import ServiceWorkerRegister from "@/components/shared/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Швидкочитач",
  description: "Застосунок для тренування швидкочитання",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Швидкочитач",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#6750A4",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
        <link rel="icon" type="image/svg+xml" href="/icons/icon-192.svg" />
      </head>
      <body className="min-h-screen">
        {children}
        <ToastContainer />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
