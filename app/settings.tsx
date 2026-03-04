import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
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
  } = useAppData();

  const [newMood, setNewMood] = useState("");
  const [localWidgets, setLocalWidgets] =
    useState<WidgetConfig[]>(widgetConfig);

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
            router.back();
          },
        },
      ],
    );
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
});
