export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/5 to-primary/10 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">📖</div>
          <h1 className="text-2xl font-bold text-primary">Швидкочитач</h1>
          <p className="text-sm text-gray-500 mt-1">Тренуй швидкочитання</p>
        </div>
        {children}
      </div>
    </div>
  );
}
