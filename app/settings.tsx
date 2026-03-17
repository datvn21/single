import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Palette } from "@/constants/theme";
import {
  WidgetConfig,
  WidgetId,
  localDateStr,
  useAppData,
} from "@/hooks/use-app-data";
import {
  NotificationSettings,
  cancelDailyNotification,
  computeSmartReminderTime,
  loadNotificationSettings,
  saveNotificationSettings,
  scheduleDailyNotification,
} from "@/hooks/use-notifications";
import {
  clearDriveSession,
  connectGoogleDrive,
  downloadBackupFromDrive,
  driveErrorMessage,
  isDriveConnected,
  isGoogleDriveConfigured,
  uploadBackupToDrive,
} from "@/hooks/use-drive-backup";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

const WIDGET_LABELS: Record<WidgetId, { label: string; sub: string }> = {
  quote: {
    label: "Daily reflection",
    sub: "Motivational quote on home screen",
  },
  deck: { label: "Memory cards", sub: "Swipeable deck of recent check-ins" },
  weekly: { label: "Weekly recap", sub: "7-day check-in streak dots" },
  stats: {
    label: "Streak & media",
    sub: "Current streak and photo/audio count",
  },
  mood: { label: "Mood breakdown", sub: "Bar chart of your mood history" },
  memory: { label: "Random memory", sub: "Rediscover a past check-in" },
};

export default function SettingsScreen() {
  const router = useRouter();
  const {
    data,
    setStartDate,
    customMoods,
    setCustomMoods,
    widgetConfig,
    setWidgetConfig,
    replaceAllData,
    checkInList,
  } = useAppData();

  const [newMood, setNewMood] = useState("");
  const [localWidgets, setLocalWidgets] =
    useState<WidgetConfig[]>(widgetConfig);
  const [backupJson, setBackupJson] = useState("");
  const [driveConfigured] = useState(isGoogleDriveConfigured());
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveBusy, setDriveBusy] = useState(false);

  // Notification settings
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifHour, setNotifHour] = useState(21);
  const [notifMinute, setNotifMinute] = useState(0);
  const [notifMode, setNotifMode] = useState<"manual" | "smart">("manual");

  useEffect(() => {
    loadNotificationSettings().then((s) => {
      setNotifEnabled(s.enabled);
      setNotifHour(s.hour);
      setNotifMinute(s.minute);
      setNotifMode(s.mode ?? "manual");
    });
    isDriveConnected().then(setDriveConnected);
  }, []);

  const handleNotifToggle = async (val: boolean) => {
    setNotifEnabled(val);

    const createdAtList = checkInList.map((ci) => ci.createdAt);
    const smart =
      notifMode === "smart"
        ? computeSmartReminderTime(createdAtList, notifHour, notifMinute)
        : { hour: notifHour, minute: notifMinute };

    const nextHour = smart.hour;
    const nextMinute = smart.minute;
    if (notifMode === "smart") {
      setNotifHour(nextHour);
      setNotifMinute(nextMinute);
    }

    const settings: NotificationSettings = {
      enabled: val,
      hour: nextHour,
      minute: nextMinute,
      mode: notifMode,
    };
    await saveNotificationSettings(settings);
    if (val) {
      const ok = await scheduleDailyNotification(nextHour, nextMinute);
      if (!ok) {
        setNotifEnabled(false);
        await saveNotificationSettings({ ...settings, enabled: false });
        Alert.alert(
          "Permission denied",
          "Please allow notifications in your device settings.",
        );
      }
    } else {
      await cancelDailyNotification();
    }
  };

  const handleNotifTimeChange = async (
    field: "hour" | "minute",
    value: number,
  ) => {
    if (notifMode === "smart") return;
    const newHour = field === "hour" ? value : notifHour;
    const newMinute = field === "minute" ? value : notifMinute;
    if (field === "hour") setNotifHour(value);
    else setNotifMinute(value);
    const settings: NotificationSettings = {
      enabled: notifEnabled,
      hour: newHour,
      minute: newMinute,
      mode: notifMode,
    };
    await saveNotificationSettings(settings);
    if (notifEnabled) {
      await scheduleDailyNotification(newHour, newMinute);
    }
  };

  const handleNotifModeToggle = async (val: boolean) => {
    const mode: "manual" | "smart" = val ? "smart" : "manual";
    setNotifMode(mode);

    const createdAtList = checkInList.map((ci) => ci.createdAt);
    const smart = computeSmartReminderTime(createdAtList, notifHour, notifMinute);
    const nextHour = mode === "smart" ? smart.hour : notifHour;
    const nextMinute = mode === "smart" ? smart.minute : notifMinute;

    if (mode === "smart") {
      setNotifHour(nextHour);
      setNotifMinute(nextMinute);
    }

    const settings: NotificationSettings = {
      enabled: notifEnabled,
      hour: nextHour,
      minute: nextMinute,
      mode,
    };
    await saveNotificationSettings(settings);

    if (notifEnabled) {
      await scheduleDailyNotification(nextHour, nextMinute);
    }
  };

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [day, setDay] = useState(now.getDate());

  useEffect(() => {
    if (data.startDate) {
      const d = new Date(data.startDate + "T00:00:00");
      setYear(d.getFullYear());
      setMonth(d.getMonth() + 1);
      setDay(d.getDate());
    }
  }, [data.startDate]);

  // Clamp day when month/year changes
  const maxDay = daysInMonth(year, month);
  const safeDay = Math.min(day, maxDay);

  const handleSave = async () => {
    const dateStr = `${year}-${pad(month)}-${pad(safeDay)}`;
    const today = localDateStr();
    if (dateStr > today) {
      Alert.alert("Invalid date", "Start date cannot be in the future.");
      return;
    }
    await setStartDate(dateStr);
    router.back();
  };

  const handleReset = () => {
    Alert.alert(
      "Reset all data?",
      "This will permanently delete all your check-ins and settings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.clear();
            await replaceAllData({
              startDate: null,
              checkIns: {},
              customMoods: [],
              showQuotes: true,
              widgetConfig: [],
            });
            router.back();
          },
        },
      ],
    );
  };

  const handleDriveConnect = async () => {
    if (!driveConfigured) {
      Alert.alert(
        "Google Drive not configured",
        "Set expo.extra.googleDrive client IDs in app.json first.",
      );
      return;
    }
    setDriveBusy(true);
    try {
      await connectGoogleDrive();
      setDriveConnected(true);
      Alert.alert("Connected", "Google Drive has been linked.");
    } catch (e) {
      Alert.alert("Connect failed", driveErrorMessage(e));
    } finally {
      setDriveBusy(false);
    }
  };

  const handleDriveDisconnect = async () => {
    setDriveBusy(true);
    try {
      await clearDriveSession();
      setDriveConnected(false);
      Alert.alert("Disconnected", "Google Drive connection was removed.");
    } finally {
      setDriveBusy(false);
    }
  };

  const handleDriveBackup = async () => {
    if (!driveConnected) {
      Alert.alert("Not connected", "Connect Google Drive first.");
      return;
    }
    setDriveBusy(true);
    try {
      await uploadBackupToDrive(data);
      Alert.alert("Backup complete", "Your data was uploaded to Google Drive.");
    } catch (e) {
      Alert.alert("Backup failed", driveErrorMessage(e));
    } finally {
      setDriveBusy(false);
    }
  };

  const handleDriveRestore = async () => {
    if (!driveConnected) {
      Alert.alert("Not connected", "Connect Google Drive first.");
      return;
    }
    // Confirmation dialog before overwriting local data
    Alert.alert(
      "Restore from Drive?",
      "This will overwrite all your current data with the backup from Google Drive. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "destructive",
          onPress: async () => {
            setDriveBusy(true);
            try {
              const payload = await downloadBackupFromDrive();
              const imported = payload.data as {
                startDate?: string | null;
                checkIns?: Record<string, unknown>;
                customMoods?: string[];
                showQuotes?: boolean;
                widgetConfig?: WidgetConfig[];
              };

              await replaceAllData({
                startDate:
                  typeof imported.startDate === "string" ? imported.startDate : null,
                checkIns: (imported.checkIns as any) ?? {},
                customMoods: Array.isArray(imported.customMoods)
                  ? imported.customMoods
                  : [],
                showQuotes:
                  typeof imported.showQuotes === "boolean" ? imported.showQuotes : true,
                widgetConfig: Array.isArray(imported.widgetConfig)
                  ? imported.widgetConfig
                  : [],
              });

              Alert.alert("Restore complete", "Data restored from Google Drive.");
            } catch (e) {
              Alert.alert("Restore failed", driveErrorMessage(e));
            } finally {
              setDriveBusy(false);
            }
          },
        },
      ],
    );
  };

  const handleExportBackup = async () => {
    try {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        data,
      };
      await Share.share({
        message: JSON.stringify(payload, null, 2),
      });
    } catch {
      Alert.alert("Export failed", "Could not export your backup.");
    }
  };

  const handleImportBackup = async () => {
    try {
      const raw = backupJson.trim();
      if (!raw) {
        Alert.alert("Missing JSON", "Paste backup JSON first.");
        return;
      }
      const parsed = JSON.parse(raw) as {
        data?: unknown;
        startDate?: unknown;
        checkIns?: unknown;
        customMoods?: unknown;
        showQuotes?: unknown;
        widgetConfig?: unknown;
      };
      const imported = (parsed.data ?? parsed) as {
        startDate?: string | null;
        checkIns?: Record<string, unknown>;
        customMoods?: string[];
        showQuotes?: boolean;
        widgetConfig?: WidgetConfig[];
      };

      if (!imported || typeof imported !== "object" || !imported.checkIns) {
        Alert.alert("Invalid backup", "JSON does not match backup format.");
        return;
      }

      await replaceAllData({
        startDate:
          typeof imported.startDate === "string" ? imported.startDate : null,
        checkIns: (imported.checkIns as any) ?? {},
        customMoods: Array.isArray(imported.customMoods)
          ? imported.customMoods
          : [],
        showQuotes:
          typeof imported.showQuotes === "boolean" ? imported.showQuotes : true,
        widgetConfig: Array.isArray(imported.widgetConfig)
          ? imported.widgetConfig
          : [],
      });

      setBackupJson("");
      Alert.alert("Imported", "Backup has been restored.");
    } catch {
      Alert.alert("Import failed", "Backup JSON is invalid.");
    }
  };

  function StepControl({
    label,
    value,
    display,
    onInc,
    onDec,
  }: {
    label: string;
    value: number;
    display: string;
    onInc: () => void;
    onDec: () => void;
  }) {
    return (
      <View style={styles.stepControl}>
        <Text style={styles.stepLabel}>{label}</Text>
        <Pressable
          style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.6 }]}
          onPress={onInc}
          hitSlop={8}
        >
          <Ionicons name="chevron-up" size={20} color={Palette.secondary} />
        </Pressable>
        <Text style={styles.stepValue}>{display}</Text>
        <Pressable
          style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.6 }]}
          onPress={onDec}
          hitSlop={8}
        >
          <Ionicons name="chevron-down" size={20} color={Palette.secondary} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Palette.bgDark} />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={22} color={Palette.secondary} />
          </Pressable>
          <Text style={styles.headerTitle}>SETTINGS</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Start Date Picker */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>When did you become single?</Text>

            <View style={styles.datePickerRow}>
              <StepControl
                label="MONTH"
                value={month}
                display={MONTHS[month - 1]}
                onInc={() => setMonth((m) => (m === 12 ? 1 : m + 1))}
                onDec={() => setMonth((m) => (m === 1 ? 12 : m - 1))}
              />
              <StepControl
                label="DAY"
                value={safeDay}
                display={String(safeDay)}
                onInc={() => setDay((d) => (d >= maxDay ? 1 : d + 1))}
                onDec={() => setDay((d) => (d <= 1 ? maxDay : d - 1))}
              />
              <StepControl
                label="YEAR"
                value={year}
                display={String(year)}
                onInc={() => setYear((y) => Math.min(y + 1, now.getFullYear()))}
                onDec={() => setYear((y) => y - 1)}
              />
            </View>

            <Text style={styles.datePreview}>
              {MONTHS[month - 1]} {safeDay}, {year}
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                pressed && { opacity: 0.85 },
              ]}
              onPress={handleSave}
            >
              <Text style={styles.saveBtnText}>Save Date</Text>
              <Ionicons name="arrow-forward" size={18} color={Palette.bgDark} />
            </Pressable>
          </View>
          {/* Notification reminder */}
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.cardTitle}>Daily reminder</Text>
                <Text style={styles.cardSubtitle}>
                  Get a nudge to check in each day
                </Text>
              </View>
              <Switch
                value={notifEnabled}
                onValueChange={handleNotifToggle}
                trackColor={{
                  false: Palette.surfaceDark,
                  true: Palette.highlight,
                }}
                thumbColor={Palette.accent}
              />
            </View>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.cardTitleSmall}>Smart time</Text>
                <Text style={styles.cardSubtitle}>
                  Learn your check-in habit and auto-adjust reminder
                </Text>
              </View>
              <Switch
                value={notifMode === "smart"}
                onValueChange={handleNotifModeToggle}
                trackColor={{
                  false: Palette.surfaceDark,
                  true: Palette.highlight,
                }}
                thumbColor={Palette.accent}
              />
            </View>

            {notifEnabled && (
              <View>
              <View style={styles.notifTimeRow}>
                <View style={styles.notifTimeBlock}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.notifStepBtn,
                      notifMode === "smart" && styles.notifStepBtnDisabled,
                      pressed && { opacity: 0.6 },
                    ]}
                    hitSlop={8}
                    onPress={() =>
                      handleNotifTimeChange(
                        "hour",
                        notifHour === 23 ? 0 : notifHour + 1,
                      )
                    }
                    disabled={notifMode === "smart"}
                  >
                    <Ionicons
                      name="chevron-up"
                      size={18}
                      color={Palette.secondary}
                    />
                  </Pressable>
                  <Text style={styles.notifTimeValue}>
                    {String(notifHour).padStart(2, "0")}
                  </Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.notifStepBtn,
                      notifMode === "smart" && styles.notifStepBtnDisabled,
                      pressed && { opacity: 0.6 },
                    ]}
                    hitSlop={8}
                    onPress={() =>
                      handleNotifTimeChange(
                        "hour",
                        notifHour === 0 ? 23 : notifHour - 1,
                      )
                    }
                    disabled={notifMode === "smart"}
                  >
                    <Ionicons
                      name="chevron-down"
                      size={18}
                      color={Palette.secondary}
                    />
                  </Pressable>
                </View>
                <Text style={styles.notifTimeSep}>:</Text>
                <View style={styles.notifTimeBlock}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.notifStepBtn,
                      notifMode === "smart" && styles.notifStepBtnDisabled,
                      pressed && { opacity: 0.6 },
                    ]}
                    hitSlop={8}
                    onPress={() =>
                      handleNotifTimeChange(
                        "minute",
                        notifMinute >= 55 ? 0 : notifMinute + 5,
                      )
                    }
                    disabled={notifMode === "smart"}
                  >
                    <Ionicons
                      name="chevron-up"
                      size={18}
                      color={Palette.secondary}
                    />
                  </Pressable>
                  <Text style={styles.notifTimeValue}>
                    {String(notifMinute).padStart(2, "0")}
                  </Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.notifStepBtn,
                      notifMode === "smart" && styles.notifStepBtnDisabled,
                      pressed && { opacity: 0.6 },
                    ]}
                    hitSlop={8}
                    onPress={() =>
                      handleNotifTimeChange(
                        "minute",
                        notifMinute === 0 ? 55 : notifMinute - 5,
                      )
                    }
                    disabled={notifMode === "smart"}
                  >
                    <Ionicons
                      name="chevron-down"
                      size={18}
                      color={Palette.secondary}
                    />
                  </Pressable>
                </View>
              </View>
              {notifMode === "smart" ? (
                <Text style={styles.smartHint}>
                  Smart mode updates this time from your recent check-ins.
                </Text>
              ) : null}
              </View>
            )}
          </View>

          {/* Widget management */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Widgets</Text>
            <Text style={styles.cardSubtitle}>
              Toggle and reorder home screen widgets
            </Text>
            {localWidgets.map((wc, idx) => {
              const info = WIDGET_LABELS[wc.id];
              return (
                <View
                  key={wc.id}
                  style={[styles.widgetRow, idx === 0 && { borderTopWidth: 0 }]}
                >
                  <View style={styles.widgetRowLeft}>
                    <Text style={styles.widgetRowLabel}>{info.label}</Text>
                    <Text style={styles.widgetRowSub}>{info.sub}</Text>
                  </View>
                  <View style={styles.widgetRowRight}>
                    <Switch
                      value={wc.enabled}
                      onValueChange={(val) => {
                        const next = localWidgets.map((w) =>
                          w.id === wc.id ? { ...w, enabled: val } : w,
                        );
                        setLocalWidgets(next);
                        setWidgetConfig(next);
                      }}
                      trackColor={{
                        false: Palette.surfaceDark,
                        true: Palette.highlight,
                      }}
                      thumbColor={Palette.accent}
                    />
                    <View style={styles.reorderBtns}>
                      <Pressable
                        style={[
                          styles.reorderBtn,
                          idx === 0 && { opacity: 0.25 },
                        ]}
                        hitSlop={6}
                        onPress={() => {
                          if (idx === 0) return;
                          const next = [...localWidgets];
                          [next[idx - 1], next[idx]] = [
                            next[idx],
                            next[idx - 1],
                          ];
                          setLocalWidgets(next);
                          setWidgetConfig(next);
                        }}
                      >
                        <Ionicons
                          name="chevron-up"
                          size={15}
                          color={Palette.secondary}
                        />
                      </Pressable>
                      <Pressable
                        style={[
                          styles.reorderBtn,
                          idx === localWidgets.length - 1 && { opacity: 0.25 },
                        ]}
                        hitSlop={6}
                        onPress={() => {
                          if (idx === localWidgets.length - 1) return;
                          const next = [...localWidgets];
                          [next[idx], next[idx + 1]] = [
                            next[idx + 1],
                            next[idx],
                          ];
                          setLocalWidgets(next);
                          setWidgetConfig(next);
                        }}
                      >
                        <Ionicons
                          name="chevron-down"
                          size={15}
                          color={Palette.secondary}
                        />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Moods */}
          <View style={styles.card}>
            <View style={styles.moodCardHeader}>
              <Text style={styles.cardTitle}>Your moods</Text>
              <View style={styles.moodCountBadge}>
                <Text style={styles.moodCountText}>{customMoods.length}/6</Text>
              </View>
            </View>

            <View style={styles.moodPillsRow}>
              {customMoods.map((m) => (
                <View key={m} style={styles.moodPill}>
                  <Text style={styles.moodPillText}>{m}</Text>
                  <Pressable
                    hitSlop={6}
                    onPress={() =>
                      setCustomMoods(customMoods.filter((x) => x !== m))
                    }
                  >
                    <Ionicons
                      name="close"
                      size={14}
                      color={`${Palette.secondary}99`}
                    />
                  </Pressable>
                </View>
              ))}
            </View>

            {customMoods.length < 6 && (
              <View style={styles.moodInputRow}>
                <TextInput
                  style={styles.moodInput}
                  placeholder="New mood…"
                  placeholderTextColor={`${Palette.secondary}50`}
                  value={newMood}
                  onChangeText={setNewMood}
                  maxLength={20}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    const trimmed = newMood.trim();
                    if (!trimmed) return;
                    if (
                      customMoods.some(
                        (m) => m.toLowerCase() === trimmed.toLowerCase(),
                      )
                    ) {
                      Alert.alert("Duplicate", "That mood already exists.");
                      return;
                    }
                    setCustomMoods([...customMoods, trimmed]);
                    setNewMood("");
                  }}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.moodAddBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => {
                    const trimmed = newMood.trim();
                    if (!trimmed) return;
                    if (
                      customMoods.some(
                        (m) => m.toLowerCase() === trimmed.toLowerCase(),
                      )
                    ) {
                      Alert.alert("Duplicate", "That mood already exists.");
                      return;
                    }
                    setCustomMoods([...customMoods, trimmed]);
                    setNewMood("");
                  }}
                >
                  <Ionicons name="add" size={20} color={Palette.bgDark} />
                </Pressable>
              </View>
            )}

            {customMoods.length === 0 && (
              <Text style={styles.moodEmptyHint}>
                Add at least one mood to check in.
              </Text>
            )}
          </View>

          {/* Google Drive */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Google Drive cloud</Text>
            <Text style={styles.cardSubtitle}>
              {driveConfigured
                ? driveConnected
                  ? "Connected. You can backup/restore via Drive appData folder."
                  : "Connect Google Drive to enable cloud backup."
                : "Add Google OAuth client IDs in app.json to enable Drive."}
            </Text>

            <View style={styles.driveRow}>
              {!driveConnected ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.backupBtn,
                    pressed && { opacity: 0.8 },
                    driveBusy && { opacity: 0.5 },
                  ]}
                  onPress={handleDriveConnect}
                  disabled={driveBusy}
                >
                  <Ionicons name="logo-google" size={16} color={Palette.bgDark} />
                  <Text style={styles.backupBtnText}>Connect Google</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.importBtn,
                    pressed && { opacity: 0.8 },
                    driveBusy && { opacity: 0.5 },
                  ]}
                  onPress={handleDriveDisconnect}
                  disabled={driveBusy}
                >
                  <Ionicons name="log-out-outline" size={16} color={Palette.accent} />
                  <Text style={styles.importBtnText}>Disconnect</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.driveActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.driveActionBtn,
                  pressed && { opacity: 0.8 },
                  (!driveConnected || driveBusy) && { opacity: 0.45 },
                ]}
                onPress={handleDriveBackup}
                disabled={!driveConnected || driveBusy}
              >
                <Ionicons name="cloud-upload-outline" size={16} color={Palette.accent} />
                <Text style={styles.driveActionText}>Backup to Drive</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.driveActionBtn,
                  pressed && { opacity: 0.8 },
                  (!driveConnected || driveBusy) && { opacity: 0.45 },
                ]}
                onPress={handleDriveRestore}
                disabled={!driveConnected || driveBusy}
              >
                <Ionicons name="cloud-download-outline" size={16} color={Palette.accent} />
                <Text style={styles.driveActionText}>Restore from Drive</Text>
              </Pressable>
            </View>
          </View>

          {/* Backup */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Backup & restore</Text>
            <Text style={styles.cardSubtitle}>
              Export your data as JSON or paste JSON to restore.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.backupBtn,
                pressed && { opacity: 0.8 },
              ]}
              onPress={handleExportBackup}
            >
              <Ionicons name="download-outline" size={16} color={Palette.bgDark} />
              <Text style={styles.backupBtnText}>Export backup JSON</Text>
            </Pressable>

            <TextInput
              style={styles.backupInput}
              placeholder="Paste backup JSON here..."
              placeholderTextColor={`${Palette.secondary}66`}
              value={backupJson}
              onChangeText={setBackupJson}
              multiline
              textAlignVertical="top"
            />

            <Pressable
              style={({ pressed }) => [
                styles.importBtn,
                pressed && { opacity: 0.8 },
              ]}
              onPress={handleImportBackup}
            >
              <Ionicons name="cloud-upload-outline" size={16} color={Palette.accent} />
              <Text style={styles.importBtnText}>Import backup</Text>
            </Pressable>
          </View>

          {/* About */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Single?</Text>
            <Text style={styles.cardSubtitle}>
              Delete app if u a not single.
            </Text>
          </View>

          {/* Reset */}
          <Pressable
            style={({ pressed }) => [
              styles.resetBtn,
              pressed && { opacity: 0.7 },
            ]}
            onPress={handleReset}
          >
            <Ionicons name="trash-outline" size={18} color="#e05c5c" />
            <Text style={styles.resetBtnText}>Reset all data</Text>
          </Pressable>

          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.bgDark },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.surfaceDark,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 11,
    letterSpacing: 3,
    color: `${Palette.accent}90`,
    fontWeight: "700",
  },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  card: {
    backgroundColor: Palette.surfaceDark,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: 8,
  },
  cardTitle: { fontSize: 17, fontWeight: "600", color: Palette.accent },
  cardTitleSmall: { fontSize: 14, fontWeight: "600", color: Palette.accent },
  cardSubtitle: {
    fontSize: 13,
    color: Palette.secondary,
    lineHeight: 20,
    opacity: 0.8,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  widgetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  widgetRowLeft: { flex: 1, gap: 2, marginRight: 12 },
  widgetRowLabel: { fontSize: 14, color: Palette.accent, fontWeight: "500" },
  widgetRowSub: { fontSize: 11, color: Palette.secondary, opacity: 0.75 },
  widgetRowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  reorderBtns: { flexDirection: "column" },
  reorderBtn: {
    width: 24,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  datePickerRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 16,
    marginBottom: 8,
  },
  stepControl: { alignItems: "center", gap: 6, flex: 1 },
  stepLabel: {
    fontSize: 9,
    letterSpacing: 2,
    color: `${Palette.secondary}70`,
    fontWeight: "700",
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${Palette.primary}40`,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: {
    fontSize: 20,
    fontWeight: "300",
    color: Palette.accent,
    minWidth: 44,
    textAlign: "center",
  },
  datePreview: {
    textAlign: "center",
    fontSize: 14,
    color: Palette.secondary,
    opacity: 0.8,
    fontStyle: "italic",
    marginBottom: 8,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 999,
    backgroundColor: "#fff",
    marginTop: 4,
  },
  saveBtnText: { fontSize: 15, fontWeight: "700", color: Palette.bgDark },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e05c5c30",
    backgroundColor: "#e05c5c10",
  },
  resetBtnText: { color: "#e05c5c", fontSize: 14, fontWeight: "500" },
  moodCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  moodCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: `${Palette.primary}60`,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  moodCountText: { fontSize: 11, color: Palette.secondary, fontWeight: "600" },
  moodPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  moodPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: `${Palette.primary}50`,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  moodPillText: { fontSize: 13, color: Palette.accent, fontWeight: "500" },
  moodInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  moodInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: `${Palette.primary}30`,
    borderWidth: 1,
    borderColor: Palette.border,
    color: Palette.accent,
    fontSize: 14,
  },
  moodAddBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Palette.highlight,
    alignItems: "center",
    justifyContent: "center",
  },
  moodEmptyHint: {
    fontSize: 12,
    color: `${Palette.secondary}70`,
    marginTop: 4,
  },
  notifTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  notifTimeBlock: {
    alignItems: "center",
    gap: 4,
  },
  notifStepBtn: {
    width: 40,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${Palette.primary}40`,
    alignItems: "center",
    justifyContent: "center",
  },
  notifStepBtnDisabled: {
    opacity: 0.35,
  },
  notifTimeValue: {
    fontSize: 34,
    fontWeight: "200",
    color: Palette.accent,
    minWidth: 52,
    textAlign: "center",
    letterSpacing: 2,
  },
  notifTimeSep: {
    fontSize: 30,
    fontWeight: "200",
    color: `${Palette.secondary}60`,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  smartHint: {
    marginTop: 8,
    fontSize: 12,
    color: `${Palette.secondary}88`,
  },
  backupBtn: {
    marginTop: 8,
    height: 42,
    borderRadius: 12,
    backgroundColor: Palette.highlight,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  backupBtnText: {
    color: Palette.bgDark,
    fontSize: 13,
    fontWeight: "700",
  },
  backupInput: {
    marginTop: 10,
    minHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: `${Palette.bgDark}AA`,
    color: Palette.accent,
    padding: 12,
    fontSize: 12,
    lineHeight: 18,
  },
  importBtn: {
    marginTop: 10,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${Palette.accent}35`,
    backgroundColor: `${Palette.accent}12`,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  importBtnText: {
    color: Palette.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  driveRow: {
    marginTop: 10,
  },
  driveActions: {
    marginTop: 10,
    flexDirection: "row",
    gap: 10,
  },
  driveActionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${Palette.accent}35`,
    backgroundColor: `${Palette.accent}12`,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  driveActionText: {
    color: Palette.accent,
    fontSize: 12,
    fontWeight: "700",
  },
});
