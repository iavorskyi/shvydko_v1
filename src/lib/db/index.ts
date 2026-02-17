import Dexie, { type Table } from "dexie";
import type {
  User,
  TrainingSession,
  Text,
  TestQuestion,
  TestResult,
  Achievement,
  DailyGoal,
  UserSettings,
} from "@/types";

export class ShvydkoDatabase extends Dexie {
  users!: Table<User, number>;
  trainingSessions!: Table<TrainingSession, number>;
  texts!: Table<Text, number>;
  testQuestions!: Table<TestQuestion, number>;
  testResults!: Table<TestResult, number>;
  achievements!: Table<Achievement, number>;
  dailyGoals!: Table<DailyGoal, number>;
  settings!: Table<UserSettings, number>;

  constructor() {
    super("ShvydkoDatabase");

    this.version(1).stores({
      users: "++id, name, schoolClass",
      trainingSessions: "++id, userId, sessionType, date",
      texts: "++id, title, ageGroup, category, source, isFavorite",
      testQuestions: "++id, textId",
      testResults: "++id, sessionId, questionId",
      achievements: "++id, userId, badgeType",
      dailyGoals: "++id, userId, date",
      settings: "userId",
    });
  }
}

export const db = new ShvydkoDatabase();
