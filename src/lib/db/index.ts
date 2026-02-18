import Dexie, { type Table } from "dexie";
import type {
  TrainingSession,
  Text,
  TestQuestion,
  TestResult,
  Achievement,
  DailyGoal,
  UserSettings,
  ReadingProgress,
} from "@/types";

export interface SyncQueueItem {
  id?: number;
  table: string;
  operation: "create" | "update";
  localId: number;
  data: Record<string, unknown>;
  createdAt: Date;
}

export class ShvydkoDatabase extends Dexie {
  trainingSessions!: Table<TrainingSession, number>;
  texts!: Table<Text, number>;
  testQuestions!: Table<TestQuestion, number>;
  testResults!: Table<TestResult, number>;
  achievements!: Table<Achievement, number>;
  dailyGoals!: Table<DailyGoal, number>;
  settings!: Table<UserSettings, string>;
  syncQueue!: Table<SyncQueueItem, number>;
  readingProgress!: Table<ReadingProgress, number>;

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

    this.version(2).stores({
      users: null, // Remove old users table
      trainingSessions: "++id, serverId, userId, sessionType, date, pendingSync",
      texts: "++id, serverId, title, ageGroup, category, source, isFavorite, builtinKey",
      testQuestions: "++id, serverId, textId",
      testResults: "++id, serverId, sessionId, questionId, pendingSync",
      achievements: "++id, serverId, userId, badgeType, pendingSync",
      dailyGoals: "++id, serverId, userId, date, pendingSync",
      settings: "userId",
      syncQueue: "++id, table, createdAt",
    });

    this.version(3).stores({
      trainingSessions: "++id, serverId, userId, sessionType, date, pendingSync",
      texts: "++id, serverId, title, ageGroup, category, source, isFavorite, builtinKey",
      testQuestions: "++id, serverId, textId",
      testResults: "++id, serverId, sessionId, questionId, pendingSync",
      achievements: "++id, serverId, userId, badgeType, pendingSync",
      dailyGoals: "++id, serverId, userId, date, pendingSync",
      settings: "userId",
      syncQueue: "++id, table, createdAt",
      readingProgress: "++id, userId, textId, [userId+textId]",
    });

    this.version(4).stores({
      trainingSessions: "++id, serverId, userId, sessionType, date, pendingSync",
      texts: "++id, serverId, title, ageGroup, category, source, isFavorite, builtinKey, pendingSync",
      testQuestions: "++id, serverId, textId",
      testResults: "++id, serverId, sessionId, questionId, pendingSync",
      achievements: "++id, serverId, userId, badgeType, pendingSync",
      dailyGoals: "++id, serverId, userId, date, pendingSync",
      settings: "userId",
      syncQueue: "++id, table, createdAt",
      readingProgress: "++id, userId, textId, [userId+textId]",
    });
  }
}

export const db = new ShvydkoDatabase();
