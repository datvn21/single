import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Palette } from "@/constants/theme";
import { CheckIn, WidgetId, localDateStr } from "@/hooks/use-app-data";

// ── Count-up hook ─────────────────────────────────────────────────────────────

export function useCountUp(target: number, duration = 800): number {
  const [display, setDisplay] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (target === 0) {
      setDisplay(0);
      return;
    }
    const steps = Math.min(target, 40); // cap at 40 ticks to avoid being too slow
    const interval = Math.max(16, Math.floor(duration / steps));
    const step = Math.ceil(target / steps);
    let current = 0;
    setDisplay(0);
    timerRef.current = setInterval(() => {
      current = Math.min(current + step, target);
      setDisplay(current);
      if (current >= target) {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, interval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [target]);

  return display;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function calcBestStreak(list: CheckIn[]): number {
  const dates = Array.from(new Set(list.map((ci) => ci.date))).sort();
  if (dates.length === 0) return 0;
  let best = 1,
    cur = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = Math.round(
      (new Date(dates[i] + "T00:00:00").getTime() -
        new Date(dates[i - 1] + "T00:00:00").getTime()) /
        86400000,
    );
    if (diff === 1) {
      cur++;
      if (cur > best) best = cur;
    } else {
      cur = 1;
    }
  }
  return best;
}

function getWeekDays(): { date: string; label: string }[] {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return ["M", "T", "W", "T", "F", "S", "S"].map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { date: localDateStr(d), label };
  });
}

function getMoodCounts(list: CheckIn[]): { mood: string; count: number }[] {
  const map: Record<string, number> = {};
  for (const ci of list) map[ci.mood] = (map[ci.mood] || 0) + 1;
  return Object.entries(map)
    .map(([mood, count]) => ({ mood, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

// ── Styles ────────────────────────────────────────────────────────────────────

const w = StyleSheet.create({
  widgetRow: { flexDirection: "row", gap: 10 },
  weekWrap: {
    backgroundColor: `${Palette.primary}30`,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${Palette.primary}60`,
    padding: 14,
  },
  weekRow: { flexDirection: "row", justifyContent: "space-between" },
  weekCell: { alignItems: "center", gap: 5 },
  weekDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: `${Palette.primary}50`,
    borderWidth: 1,
    borderColor: `${Palette.primary}80`,
  },
  weekDotFilled: {
    backgroundColor: Palette.highlight,
    borderColor: Palette.highlight,
  },
  weekDotToday: { borderColor: Palette.highlight, borderWidth: 1.5 },
  weekDotFuture: { opacity: 0.3 },
  weekLabel: {
    fontSize: 9,
    color: Palette.secondary,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
  },
  weekLabelActive: { color: Palette.accent },
  miniCard: {
    backgroundColor: `${Palette.primary}30`,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${Palette.primary}60`,
    padding: 14,
    gap: 10,
  },
  miniCardHeader: { flexDirection: "row", alignItems: "center", gap: 5 },
  miniCardLabel: {
    fontSize: 9,
    color: Palette.secondary,
    fontWeight: "700" as const,
    letterSpacing: 1.5,
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  streakItem: { alignItems: "center" },
  streakNum: {
    fontSize: 22,
    fontWeight: "300" as const,
    color: Palette.accent,
  },
  streakSub: {
    fontSize: 9,
    color: Palette.secondary,
    letterSpacing: 1,
    marginTop: 2,
  },
  streakDivider: {
    width: 1,
    height: 28,
    backgroundColor: `${Palette.secondary}30`,
  },
  mediaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  mediaItem: { alignItems: "center" },
  mediaNum: { fontSize: 22, fontWeight: "300" as const, color: Palette.accent },
  mediaSub: {
    fontSize: 9,
    color: Palette.secondary,
    letterSpacing: 1,
    marginTop: 2,
  },
  card: {
    backgroundColor: `${Palette.primary}30`,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${Palette.primary}60`,
    padding: 14,
    gap: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 9,
    color: Palette.secondary,
    fontWeight: "700" as const,
    letterSpacing: 1.5,
  },
  moodRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  moodName: {
    width: 84,
    fontSize: 12,
    color: Palette.accent,
    fontWeight: "400" as const,
  },
  moodBarBg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: `${Palette.primary}60`,
    overflow: "hidden" as const,
  },
  moodBarFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.highlight,
  },
  moodCount: {
    width: 20,
    fontSize: 11,
    color: Palette.secondary,
    textAlign: "right" as const,
  },
  // ── Random Memory card ──
  memoryCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Palette.surfaceDark,
    backgroundColor: Palette.bgDark,
    overflow: "hidden" as const,
  },
  memoryHeaderRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
  memoryLabel: {
    fontSize: 9,
    color: Palette.secondary,
    fontWeight: "700" as const,
    letterSpacing: 2,
  },
  memoryRefreshBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${Palette.primary}40`,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 1,
    borderColor: `${Palette.primary}80`,
  },
  memoryPhotoWrap: {
    marginHorizontal: 14,
    borderRadius: 18,
    overflow: "hidden" as const,
  },
  memoryPhoto: {
    width: "100%" as const,
    aspectRatio: 4 / 3,
  },
  memoryNoPhoto: {
    aspectRatio: 4 / 3,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: Palette.primary,
  },
  memoryNoPhotoMood: {
    fontSize: 52,
  },
  memoryBody: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 14,
    gap: 12,
  },
  memoryMetaRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  memoryDate: {
    color: Palette.accent,
    fontSize: 17,
    fontWeight: "500" as const,
  },
  memoryDayText: {
    color: Palette.secondary,
    fontSize: 12,
    fontWeight: "400" as const,
  },
  memoryMoodPill: {
    backgroundColor: `${Palette.highlight}18`,
    borderWidth: 1,
    borderColor: `${Palette.highlight}40`,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  memoryMoodPillText: {
    color: Palette.highlight,
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  memoryInsightBox: {
    backgroundColor: `${Palette.accent}10`,
    borderWidth: 1,
    borderColor: `${Palette.accent}30`,
    padding: 14,
    borderRadius: 12,
  },
  memoryInsightText: {
    color: `${Palette.accent}CC`,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "300" as const,
  },
});

// ── Widget Components ─────────────────────────────────────────────────────────

function WeeklyRecap({ checkInList }: { checkInList: CheckIn[] }) {
  const week = getWeekDays();
  const datesWithEntry = new Set(checkInList.map((ci) => ci.date));
  const todayDate = localDateStr();
  return (
    <View style={w.weekWrap}>
      <View style={[w.cardHeader, { marginBottom: 12 }]}>
        <Ionicons
          name="calendar-clear-outline"
          size={13}
          color={Palette.highlight}
        />
        <Text style={w.cardTitle}>THIS WEEK</Text>
      </View>
      <View style={w.weekRow}>
        {week.map(({ date, label }, i) => {
          const has = datesWithEntry.has(date);
          const future = date > todayDate;
          const isToday = date === todayDate;
          return (
            <View key={i} style={w.weekCell}>
              <View
                style={[
                  w.weekDot,
                  has && w.weekDotFilled,
                  isToday && !has && w.weekDotToday,
                  future && w.weekDotFuture,
                ]}
              />
              <Text
                style={[w.weekLabel, (has || isToday) && w.weekLabelActive]}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function StreakCard({ streak, best }: { streak: number; best: number }) {
  const displayStreak = useCountUp(streak);
  const displayBest = useCountUp(best, 1000);

  // Flame pulse animation
  const flameScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (streak === 0) return;
    Animated.sequence([
      Animated.timing(flameScale, {
        toValue: 1.45,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(flameScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
  }, [streak]);

  return (
    <View style={[w.miniCard, { flex: 1 }]}>
      <View style={w.miniCardHeader}>
        <Animated.View style={{ transform: [{ scale: flameScale }] }}>
          <Ionicons name="flame-outline" size={13} color={Palette.highlight} />
        </Animated.View>
        <Text style={w.miniCardLabel}>STREAK</Text>
      </View>
      <View style={w.streakRow}>
        <View style={w.streakItem}>
          <Text style={w.streakNum}>{displayStreak}</Text>
          <Text style={w.streakSub}>current</Text>
        </View>
        <View style={w.streakDivider} />
        <View style={w.streakItem}>
          <Text style={w.streakNum}>{displayBest}</Text>
          <Text style={w.streakSub}>best</Text>
        </View>
      </View>
    </View>
  );
}

function MediaStatCard({ checkInList }: { checkInList: CheckIn[] }) {
  const audioCount = checkInList.filter((ci) => !!ci.audioUri).length;
  const noteCount = checkInList.filter((ci) => !!ci.insight).length;
  return (
    <View style={[w.miniCard, { flex: 1 }]}>
      <View style={w.miniCardHeader}>
        <Ionicons name="mic-outline" size={13} color={Palette.highlight} />
        <Text style={w.miniCardLabel}>MEDIA</Text>
      </View>
      <View style={w.mediaRow}>
        <View style={w.mediaItem}>
          <Text style={w.mediaNum}>{audioCount}</Text>
          <Text style={w.mediaSub}>voice</Text>
        </View>
        <View style={w.streakDivider} />
        <View style={w.mediaItem}>
          <Text style={w.mediaNum}>{noteCount}</Text>
          <Text style={w.mediaSub}>notes</Text>
        </View>
      </View>
    </View>
  );
}

function MoodBreakdown({ checkInList }: { checkInList: CheckIn[] }) {
  const counts = getMoodCounts(checkInList);
  if (counts.length === 0) return null;
  const max = counts[0].count;
  return (
    <View style={w.card}>
      <View style={w.cardHeader}>
        <Text style={w.cardTitle}>MOOD BREAKDOWN</Text>
      </View>
      <View style={{ gap: 9 }}>
        {counts.map(({ mood, count }) => (
          <View key={mood} style={w.moodRow}>
            <Text style={w.moodName} numberOfLines={1}>
              {mood}
            </Text>
            <View style={w.moodBarBg}>
              <View
                style={[w.moodBarFill, { width: `${(count / max) * 100}%` }]}
              />
            </View>
            <Text style={w.moodCount}>{count}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function RandomMemoryCard({
  ci,
  startDate,
  onSelect,
  onRefresh,
}: {
  ci: CheckIn;
  startDate: string | null;
  onSelect: (ci: CheckIn) => void;
  onRefresh: () => void;
}) {
  const dayNum = startDate
    ? Math.floor(
        (new Date(ci.date + "T00:00:00").getTime() -
          new Date(startDate + "T00:00:00").getTime()) /
          86400000,
      )
    : null;

  return (
    <Pressable style={w.memoryCard} onPress={() => onSelect(ci)}>
      {/* Header row — label + shuffle */}
      <View style={w.memoryHeaderRow}>
        <Text style={w.memoryLabel}>MEMORY</Text>
        <Pressable
          style={w.memoryRefreshBtn}
          onPress={(e) => {
            e.stopPropagation?.();
            onRefresh();
          }}
          hitSlop={10}
        >
          <Ionicons
            name="shuffle-outline"
            size={14}
            color={Palette.secondary}
          />
        </Pressable>
      </View>

      {/* Photo or mood placeholder */}
      <View style={w.memoryPhotoWrap}>
        {ci.photoUri ? (
          <Image
            source={{ uri: ci.photoUri }}
            style={w.memoryPhoto}
            resizeMode="cover"
          />
        ) : (
          <View style={w.memoryNoPhoto}>
            <Text style={w.memoryNoPhotoMood}>{ci.mood}</Text>
          </View>
        )}
      </View>

      {/* Body */}
      <View style={w.memoryBody}>
        <View style={w.memoryMetaRow}>
          <View style={{ gap: 2 }}>
            <Text style={w.memoryDate}>{formatDate(ci.date)}</Text>
            {dayNum !== null && dayNum >= 0 && (
              <Text style={w.memoryDayText}>Day {dayNum}</Text>
            )}
          </View>
          <View style={w.memoryMoodPill}>
            <Text style={w.memoryMoodPillText}>{ci.mood}</Text>
          </View>
        </View>
        {ci.insight ? (
          <View style={w.memoryInsightBox}>
            <Text style={w.memoryInsightText} numberOfLines={4}>
              {ci.insight}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// ── Single-widget export ──────────────────────────────────────────────────────

export function HomeWidget({
  widgetId,
  checkInList,
  streak,
  startDate,
  onSelectCheckIn,
}: {
  widgetId: WidgetId;
  checkInList: CheckIn[];
  streak: number;
  startDate: string | null;
  onSelectCheckIn?: (ci: CheckIn) => void;
}) {
  const bestStreak = useMemo(
    () => (widgetId === "stats" ? calcBestStreak(checkInList) : 0),
    [widgetId, checkInList],
  );
  const [memoryIdx, setMemoryIdx] = useState(0);
  const randomMemory =
    widgetId === "memory" && checkInList.length > 0
      ? checkInList[memoryIdx % checkInList.length]
      : null;
  const refreshMemory = () =>
    setMemoryIdx((i) => (i + 1) % Math.max(checkInList.length, 1));

  switch (widgetId) {
    case "weekly":
      return <WeeklyRecap checkInList={checkInList} />;
    case "stats":
      return (
        <View style={w.widgetRow}>
          <StreakCard streak={streak} best={bestStreak} />
          <MediaStatCard checkInList={checkInList} />
        </View>
      );
    case "mood":
      return <MoodBreakdown checkInList={checkInList} />;
    case "memory":
      return randomMemory ? (
        <RandomMemoryCard
          ci={randomMemory}
          startDate={startDate}
          onSelect={onSelectCheckIn ?? (() => {})}
          onRefresh={refreshMemory}
        />
      ) : null;
    default:
      return null;
  }
}
