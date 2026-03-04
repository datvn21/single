import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { create } from "zustand";

//  Types
export type Mood = string;

export const DEFAULT_MOODS: Mood[] = [
  "Peaceful",
  "Energetic",
  "Quiet",
  "Reflective",
  "Grateful",
  "Lonely",
];

export type WidgetId =
  | "quote"
  | "deck"
  | "weekly"
  | "stats"
  | "mood"
  | "memory";
export interface WidgetConfig {
  id: WidgetId;
  enabled: boolean;
}
export const DEFAULT_WIDGET_CONFIG: WidgetConfig[] = [
  { id: "quote", enabled: true },
  { id: "deck", enabled: true },
  { id: "weekly", enabled: true },
  { id: "stats", enabled: true },
  { id: "mood", enabled: true },
  { id: "memory", enabled: true },
];

export interface CheckIn {
  id: string; // unique key: "YYYY-MM-DD_<createdAt>"
  date: string; // YYYY-MM-DD
  mood: Mood;
  insight: string;
  photoUri?: string;
  audioUri?: string;
  createdAt: number; // ms timestamp
}

export interface AppData {
  startDate: string | null;
  checkIns: Record<string, CheckIn>;
  customMoods: string[];
  showQuotes: boolean;
  widgetConfig: WidgetConfig[];
}

//  Helpers
const STORAGE_KEY = "single_app_data";

export function localDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayStr(): string {
  return localDateStr();
}

function daysBetween(from: string, to: string): number {
  return Math.floor(
    (new Date(to).getTime() - new Date(from).getTime()) / 86400000,
  );
}

// Streak: count consecutive days (from today backwards) that have >= 1 entry
function calcStreak(checkIns: Record<string, CheckIn>): number {
  const dates = new Set(
    Object.values(checkIns)
      .filter((ci) => ci && typeof ci.date === "string")
      .map((ci) => ci.date),
  );
  let streak = 0;
  const cursor = new Date(todayStr());
  while (true) {
    const key = localDateStr(cursor);
    if (dates.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

async function persistStore(
  checkIns: Record<string, CheckIn>,
  startDate: string | null,
  customMoods: string[],
  showQuotes: boolean,
  widgetConfig: WidgetConfig[],
) {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        startDate,
        checkIns,
        customMoods,
        showQuotes,
        widgetConfig,
      }),
    );
  } catch {
    // non-fatal
  }
}

// Migrate old date-keyed data (no id field) to id-keyed
function migrateCheckIns(
  raw: Record<string, unknown>,
): Record<string, CheckIn> {
  const result: Record<string, CheckIn> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object") continue;
    const ci = value as Record<string, unknown>;
    if (typeof ci.id === "string" && ci.id) {
      // Already migrated
      result[ci.id] = ci as unknown as CheckIn;
    } else {
      // Old format: key was the date
      const date = typeof ci.date === "string" ? ci.date : key;
      const createdAt =
        typeof ci.createdAt === "number" ? ci.createdAt : Date.now();
      const id = `${date}_${createdAt}`;
      result[id] = { ...(ci as unknown as CheckIn), id, date };
    }
  }
  return result;
}

//  Zustand store
interface AppStore {
  loading: boolean;
  startDate: string | null;
  checkIns: Record<string, CheckIn>;
  customMoods: string[];
  showQuotes: boolean;
  widgetConfig: WidgetConfig[];

  initialize: () => Promise<void>;
  setStartDate: (date: string) => Promise<void>;
  setCustomMoods: (moods: string[]) => Promise<void>;
  setShowQuotes: (val: boolean) => Promise<void>;
  setWidgetConfig: (config: WidgetConfig[]) => Promise<void>;
  saveCheckIn: (
    checkIn: Omit<CheckIn, "id"> & { id?: string },
  ) => Promise<void>;
  deleteCheckIn: (id: string) => Promise<void>;
}

export const useAppStore = create<AppStore>((set, get) => ({
  loading: true,
  startDate: null,
  checkIns: {},
  customMoods: DEFAULT_MOODS,
  showQuotes: true,
  widgetConfig: DEFAULT_WIDGET_CONFIG,

  initialize: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<
          AppData & { checkIns: Record<string, unknown> }
        >;
        const checkIns = migrateCheckIns(
          parsed.checkIns && typeof parsed.checkIns === "object"
            ? (parsed.checkIns as Record<string, unknown>)
            : {},
        );
        const customMoods =
          Array.isArray(parsed.customMoods) && parsed.customMoods.length > 0
            ? (parsed.customMoods as string[])
            : DEFAULT_MOODS;
        const showQuotes =
          typeof parsed.showQuotes === "boolean" ? parsed.showQuotes : true;
        const rawConfig = (
          Array.isArray(parsed.widgetConfig)
            ? (parsed.widgetConfig as WidgetConfig[])
            : []
        ).filter((w) =>
          (DEFAULT_WIDGET_CONFIG as { id: string }[]).some(
            (d) => d.id === w.id,
          ),
        );
        const existingIds = new Set(rawConfig.map((w) => w.id));
        const widgetConfig: WidgetConfig[] =
          rawConfig.length > 0
            ? [
                ...rawConfig,
                ...DEFAULT_WIDGET_CONFIG.filter((d) => !existingIds.has(d.id)),
              ]
            : DEFAULT_WIDGET_CONFIG;
        set({
          startDate:
            typeof parsed.startDate === "string" ? parsed.startDate : null,
          checkIns,
          customMoods,
          showQuotes,
          widgetConfig,
        });
      }
    } catch {
      // first launch or parse error
    } finally {
      set({ loading: false });
    }
  },

  setStartDate: async (date) => {
    set({ startDate: date });
    await persistStore(
      get().checkIns,
      date,
      get().customMoods,
      get().showQuotes,
      get().widgetConfig,
    );
  },

  setCustomMoods: async (moods) => {
    set({ customMoods: moods });
    await persistStore(
      get().checkIns,
      get().startDate,
      moods,
      get().showQuotes,
      get().widgetConfig,
    );
  },

  setShowQuotes: async (val) => {
    set({ showQuotes: val });
    await persistStore(
      get().checkIns,
      get().startDate,
      get().customMoods,
      val,
      get().widgetConfig,
    );
  },

  setWidgetConfig: async (config) => {
    set({ widgetConfig: config });
    await persistStore(
      get().checkIns,
      get().startDate,
      get().customMoods,
      get().showQuotes,
      config,
    );
  },

  // Always generates a new unique id  never overwrites a different entry
  saveCheckIn: async (checkIn) => {
    const createdAt = checkIn.createdAt ?? Date.now();
    const id = checkIn.id ?? `${checkIn.date}_${createdAt}`;
    const entry: CheckIn = { ...checkIn, id, createdAt } as CheckIn;
    const next = { ...get().checkIns, [id]: entry };
    set({ checkIns: next });
    await persistStore(
      next,
      get().startDate,
      get().customMoods,
      get().showQuotes,
      get().widgetConfig,
    );
  },

  // Deletes by unique id  never touches other entries on the same day
  deleteCheckIn: async (id) => {
    const { [id]: _removed, ...rest } = get().checkIns;
    set({ checkIns: rest });
    await persistStore(
      rest,
      get().startDate,
      get().customMoods,
      get().showQuotes,
      get().widgetConfig,
    );
  },
}));

//  Public hook
export function useAppData() {
  const loading = useAppStore((s) => s.loading);
  const startDate = useAppStore((s) => s.startDate);
  const checkIns = useAppStore((s) => s.checkIns);
  const customMoods = useAppStore((s) => s.customMoods);
  const showQuotes = useAppStore((s) => s.showQuotes);
  const widgetConfig = useAppStore((s) => s.widgetConfig);
  const initialize = useAppStore((s) => s.initialize);
  const setStartDateAction = useAppStore((s) => s.setStartDate);
  const setCustomMoodsAction = useAppStore((s) => s.setCustomMoods);
  const setShowQuotesAction = useAppStore((s) => s.setShowQuotes);
  const setWidgetConfigAction = useAppStore((s) => s.setWidgetConfig);
  const saveCheckInAction = useAppStore((s) => s.saveCheckIn);
  const deleteCheckInAction = useAppStore((s) => s.deleteCheckIn);

  const today = todayStr();

  const checkInList: CheckIn[] = Object.values(checkIns)
    .filter((ci): ci is CheckIn => !!ci && typeof ci.date === "string")
    .sort((a, b) => b.createdAt - a.createdAt);

  // All entries for today, newest first
  const todayCheckIns = checkInList.filter((ci) => ci.date === today);
  // Latest today entry (or null)  kept for backward compat
  const todayCheckIn = todayCheckIns[0] ?? null;

  const daysSingle = startDate ? daysBetween(startDate, today) : 0;
  const streak = calcStreak(checkIns);

  return {
    loading,
    data: {
      startDate,
      checkIns,
      customMoods,
      showQuotes,
      widgetConfig,
    } as AppData,
    todayCheckIn,
    todayCheckIns,
    daysSingle,
    streak,
    checkInList,
    customMoods,
    showQuotes,
    widgetConfig,
    setStartDate: setStartDateAction,
    setCustomMoods: setCustomMoodsAction,
    setShowQuotes: setShowQuotesAction,
    setWidgetConfig: setWidgetConfigAction,
    saveCheckIn: saveCheckInAction,
    deleteCheckIn: deleteCheckInAction,
    reload: initialize,
  };
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  return React.createElement(React.Fragment, null, children);
}
