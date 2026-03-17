import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const NOTIF_KEY = "single_notification_settings";

export interface NotificationSettings {
  enabled: boolean;
  hour: number; // 0-23
  minute: number; // 0-59
  mode: "manual" | "smart";
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  hour: 21,
  minute: 0,
  mode: "manual",
};

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function loadNotificationSettings(): Promise<NotificationSettings> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

export async function saveNotificationSettings(
  settings: NotificationSettings,
): Promise<void> {
  await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(settings));
}

function roundToNearestFive(minute: number): number {
  return Math.max(0, Math.min(55, Math.round(minute / 5) * 5));
}

export function computeSmartReminderTime(
  createdAtList: number[],
  fallbackHour = DEFAULT_SETTINGS.hour,
  fallbackMinute = DEFAULT_SETTINGS.minute,
): { hour: number; minute: number } {
  if (!Array.isArray(createdAtList) || createdAtList.length === 0) {
    return { hour: fallbackHour, minute: fallbackMinute };
  }

  const recent = [...createdAtList]
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => b - a)
    .slice(0, 30);

  if (recent.length === 0) {
    return { hour: fallbackHour, minute: fallbackMinute };
  }

  const hourScore = new Map<number, number>();
  for (let i = 0; i < recent.length; i += 1) {
    const d = new Date(recent[i]);
    const h = d.getHours();
    const weight = recent.length - i;
    hourScore.set(h, (hourScore.get(h) ?? 0) + weight);
  }

  const bestHour = [...hourScore.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const hour = typeof bestHour === "number" ? bestHour : fallbackHour;

  const minuteSamples = recent
    .map((ts) => new Date(ts))
    .filter((d) => d.getHours() === hour)
    .map((d) => d.getMinutes());

  const minuteAvg =
    minuteSamples.length > 0
      ? Math.round(minuteSamples.reduce((sum, m) => sum + m, 0) / minuteSamples.length)
      : fallbackMinute;

  return { hour, minute: roundToNearestFive(minuteAvg) };
}

async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleDailyNotification(
  hour: number,
  minute: number,
): Promise<boolean> {
  const granted = await requestPermissions();
  if (!granted) return false;

  // Cancel previous Single? notifications
  await cancelDailyNotification();

  await Notifications.scheduleNotificationAsync({
    identifier: "single_daily_checkin",
    content: {
      title: "How are you feeling?",
      body: "Take a moment to check in with yourself today 🌿",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  return true;
}

export async function cancelDailyNotification(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync("single_daily_checkin");
}

/** Call once at app startup to re-schedule if still enabled */
export async function initNotifications(): Promise<void> {
  const settings = await loadNotificationSettings();
  if (settings.enabled) {
    await scheduleDailyNotification(settings.hour, settings.minute);
  }
}
