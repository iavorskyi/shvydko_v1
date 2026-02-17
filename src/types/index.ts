export interface User {
  id?: number;
  name: string;
  age: number;
  schoolClass: number;
  avatarId: number;
  createdAt: Date;
  lastLogin: Date;
}

export interface TrainingSession {
  id?: number;
  userId: number;
  sessionType: "peripheral" | "schulte" | "rsvp" | "test";
  date: Date;
  duration: number;
  result: Record<string, unknown>;
  score: number;
  speed?: number;
  comprehension?: number;
}

export interface Text {
  id?: number;
  title: string;
  content: string;
  difficulty: number;
  ageGroup: "1-4" | "5-8" | "9-11";
  category: string;
  wordCount: number;
  source: "builtin" | "pdf";
  isFavorite: number;
  createdAt: Date;
}

export interface TestQuestion {
  id?: number;
  textId: number;
  question: string;
  questionType: "multiple_choice" | "yes_no" | "sequence";
  correctAnswer: string;
  options: string[];
  explanation: string;
}

export interface TestResult {
  id?: number;
  sessionId: number;
  questionId: number;
  userAnswer: string;
  isCorrect: boolean;
  timeSpent: number;
}

export interface Achievement {
  id?: number;
  userId: number;
  badgeType: string;
  earnedAt: Date;
}

export interface DailyGoal {
  id?: number;
  userId: number;
  date: string;
  goalType: "sessions" | "minutes" | "texts";
  target: number;
  achieved: number;
}

export interface UserSettings {
  userId: number;
  theme: "light" | "dark" | "auto";
  fontSize: number;
  reminderEnabled: boolean;
  reminderTime: string;
  soundEnabled: boolean;
  parentControlEnabled: boolean;
  parentPin: string;
}

export type AgeGroup = "1-4" | "5-8" | "9-11";
export type TextCategory = "казки" | "наука" | "класика" | "історія" | "природа";
export type ExerciseType = "peripheral" | "schulte" | "rsvp" | "test";

export interface SchulteResult {
  gridSize: number;
  timeMs: number;
  errors: number;
  colorMode: boolean;
}

export interface PeripheralResult {
  mode: "central" | "random" | "group" | "expanding";
  wordsShown: number;
  correctCount: number;
  speed: number;
}

export interface RsvpResult {
  textId: number;
  wordsRead: number;
  wpm: number;
  completed: boolean;
}

export const BADGES: Record<string, { name: string; description: string; icon: string }> = {
  first_session: { name: "Перші кроки", description: "Перша тренувальна сесія", icon: "🏆" },
  first_text: { name: "Перша книга", description: "Перший прочитаний текст", icon: "📚" },
  speed_300: { name: "Швидкий старт", description: "Швидкість 300 слів/хв", icon: "⚡" },
  streak_7: { name: "Серія 7 днів", description: "Тренування 7 днів поспіль", icon: "🔥" },
  texts_50: { name: "Книгочей", description: "Прочитано 50 текстів", icon: "📖" },
  accuracy_95: { name: "Снайпер", description: "95%+ розуміння в 20 тестах", icon: "🎯" },
  speed_600: { name: "Блискавка", description: "Швидкість 600 слів/хв", icon: "⚡" },
  speed_1000: { name: "Майстер читання", description: "Швидкість 1000 слів/хв", icon: "🥇" },
  level_100: { name: "Легенда", description: "Досягнуто 100 рівень", icon: "👑" },
  perfect_100: { name: "Перфекціоніст", description: "100 тестів зі 100% розумінням", icon: "🌟" },
  schulte_10: { name: "Майстер таблиць", description: "10 таблиць Шульте пройдено", icon: "🔢" },
  daily_streak_30: { name: "Залізна воля", description: "30 днів поспіль тренувань", icon: "💪" },
  schulte_fast: { name: "Блискавичний пошук", description: "Таблиця 5×5 за 30 секунд", icon: "🏃" },
  all_exercises: { name: "Універсал", description: "Пройдено всі типи вправ", icon: "🎓" },
  texts_100: { name: "Бібліотекар", description: "Прочитано 100 текстів", icon: "📚" },
};

export const LEVELS = [
  { name: "Початківець", minPoints: 0, maxPoints: 1000, range: "1-10" },
  { name: "Читач", minPoints: 1001, maxPoints: 5000, range: "11-25" },
  { name: "Майстер", minPoints: 5001, maxPoints: 15000, range: "26-50" },
  { name: "Чемпіон", minPoints: 15001, maxPoints: Infinity, range: "51-100" },
];

export const POINTS = {
  peripheral: 10,
  schulte: 15,
  rsvp: 20,
  test_perfect: 50,
  daily_goal: 30,
  streak_bonus: 5,
};
