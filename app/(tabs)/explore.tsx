import { Ionicons } from "@expo/vector-icons";
import { AudioPlayer, createAudioPlayer } from "expo-audio";
import * as MediaLibrary from "expo-media-library";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader } from "@/components/app-header";
import { Palette } from "@/constants/theme";
import { CheckIn, localDateStr, useAppData } from "@/hooks/use-app-data";

type FilterKey = "all" | "audio" | "note" | "photo" | "today";

const FILTERS: { key: FilterKey; label: string; icon: string }[] = [
  { key: "all", label: "All", icon: "grid-outline" },
  { key: "audio", label: "Audio", icon: "mic-outline" },
  { key: "note", label: "Note", icon: "pencil-outline" },
  { key: "photo", label: "Photo", icon: "image-outline" },
  { key: "today", label: "Today", icon: "today-outline" },
];

const { width: SCREEN_W } = Dimensions.get("window");

const CARD_W = (SCREEN_W - 32 - 12) / 2;

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function groupByDay(
  checkIns: CheckIn[],
): { label: string; date: string; items: CheckIn[] }[] {
  const map: Record<string, CheckIn[]> = {};
  for (const ci of checkIns) {
    if (!ci?.date) continue;
    if (!map[ci.date]) map[ci.date] = [];
    map[ci.date].push(ci);
  }
  const todayStr = localDateStr();
  const yesterdayStr = localDateStr(new Date(Date.now() - 86400000));
  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => {
      let label: string;
      if (date === todayStr) {
        label = "Today";
      } else if (date === yesterdayStr) {
        label = "Yesterday";
      } else {
        const d = new Date(date + "T00:00:00");
        label = d.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        });
      }
      return {
        label,
        date,
        items: items.sort((a, b) => b.createdAt - a.createdAt),
      };
    });
}

function dayNumber(startDate: string | null, date: string) {
  if (!startDate) return null;
  const msPerDay = 86400000;
  const diff = Math.floor(
    (new Date(date).getTime() - new Date(startDate).getTime()) / msPerDay,
  );
  return diff >= 0 ? diff : null;
}

export default function HistoryScreen() {
  const router = useRouter();
  const { data, checkInList, daysSingle, streak, deleteCheckIn } = useAppData();
  const [selected, setSelected] = useState<CheckIn | null>(null);
  const [photoAspect, setPhotoAspect] = useState(4 / 3);
  const [showSaveOverlay, setShowSaveOverlay] = useState(false);
  const playerRef = useRef<AudioPlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  const today = localDateStr();

  useEffect(() => {
    setPhotoAspect(4 / 3);
    setShowSaveOverlay(false);
  }, [selected]);

  const saveImage = async (uri: string) => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission denied",
          "Allow photo library access to save images.",
        );
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      setShowSaveOverlay(false);
      Alert.alert("Saved", "Image saved to your photo library.");
    } catch {
      Alert.alert("Error", "Could not save image.");
    }
  };

  useEffect(() => {
    setIsPlaying(false);
    setAudioDuration(null);
    playerRef.current = null;
    if (!selected?.audioUri) return;

    const player = createAudioPlayer({ uri: selected.audioUri });
    playerRef.current = player;
    const sub = player.addListener("playbackStatusUpdate", (status) => {
      setIsPlaying(status.playing ?? false);
      if (status.duration) setAudioDuration(Math.round(status.duration));
    });

    return () => {
      sub.remove();
      player.remove();
      playerRef.current = null;
    };
  }, [selected]);

  const togglePlay = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pause();
    } else {
      playerRef.current.seekTo(0);
      playerRef.current.play();
    }
  };

  const filteredList = useMemo(() => {
    switch (activeFilter) {
      case "audio":
        return checkInList.filter((ci) => !!ci.audioUri);
      case "note":
        return checkInList.filter((ci) => !!ci.insight);
      case "photo":
        return checkInList.filter((ci) => !!ci.photoUri);
      case "today":
        return checkInList.filter((ci) => ci.date === today);
      default:
        return checkInList;
    }
  }, [checkInList, activeFilter, today]);

  const grouped = useMemo(() => groupByDay(filteredList), [filteredList]);

  const swipePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        !selected && g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,
      onPanResponderRelease: (_, g) => {
        if (g.dx > 50 || g.vx > 0.4) router.navigate("/(tabs)/");
      },
    }),
  ).current;

  return (
    <View style={styles.container} {...swipePan.panHandlers}>
      <StatusBar barStyle="light-content" backgroundColor={Palette.bgDark} />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <AppHeader />

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {data.startDate ? daysSingle : "—"}
            </Text>
            <Text style={styles.statLabel}>DAYS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{checkInList.length}</Text>
            <Text style={styles.statLabel}>PHOTOS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>STREAK</Text>
          </View>
        </View>

        {/* Filter badges */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterStrip}
          style={styles.filterBar}
        >
          {FILTERS.map((f) => {
            const active = activeFilter === f.key;
            return (
              <Pressable
                key={f.key}
                style={[styles.filterBadge, active && styles.filterBadgeActive]}
                onPress={() => setActiveFilter(f.key)}
              >
                <Ionicons
                  name={f.icon as any}
                  size={13}
                  color={active ? Palette.bgDark : Palette.secondary}
                />
                <Text
                  style={[
                    styles.filterBadgeText,
                    active && styles.filterBadgeTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {filteredList.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {activeFilter === "all" ? "No memories yet" : "Nothing here"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeFilter === "all"
                  ? "Start logging your daily moments"
                  : "No entries match this filter"}
              </Text>
              {activeFilter === "all" && (
                <Pressable
                  style={styles.emptyBtn}
                  onPress={() => router.push("/modal")}
                >
                  <Text style={styles.emptyBtnText}>
                    Add today&apos;s moment
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            grouped.map(({ label, date, items }) => (
              <View key={date} style={styles.monthSection}>
                <Text style={styles.monthLabel}>{label}</Text>
                <View style={styles.grid}>
                  {items.map((ci) => {
                    const dayNum = dayNumber(data.startDate, ci.date);
                    return (
                      <Pressable
                        key={ci.id}
                        style={styles.card}
                        onPress={() => setSelected(ci)}
                      >
                        {ci.photoUri ? (
                          <Image
                            source={{ uri: ci.photoUri }}
                            style={styles.cardImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.cardNoPhoto}>
                            <Text style={styles.cardNoPhotoMood}>
                              {ci.mood}
                            </Text>
                          </View>
                        )}
                        <View style={styles.cardOverlay} />
                        {dayNum !== null && (
                          <View style={styles.dayBadge}>
                            <Text style={styles.dayBadgeText}>
                              Day {dayNum}
                            </Text>
                          </View>
                        )}
                        <View style={styles.cardBottom}>
                          <Text style={styles.cardDate}>{ci.mood}</Text>
                          {ci.insight ? (
                            <Text style={styles.cardInsight} numberOfLines={1}>
                              {ci.insight}
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))
          )}
          <View style={{ height: 120 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Detail Modal */}
      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalBg}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (showSaveOverlay) {
                setShowSaveOverlay(false);
              } else {
                setSelected(null);
              }
            }}
          />
          <View style={styles.detailCard}>
            <Pressable
              style={styles.detailTrashBtn}
              onPress={() =>
                Alert.alert(
                  "Delete entry",
                  "Remove this check-in? This cannot be undone.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => {
                        deleteCheckIn(selected!.id);
                        setSelected(null);
                      },
                    },
                  ],
                )
              }
            >
              <Ionicons
                name="trash-outline"
                size={16}
                color="rgba(255,90,90,0.9)"
              />
            </Pressable>

            <Pressable
              style={styles.detailClose}
              onPress={() => setSelected(null)}
            >
              <Ionicons name="close" size={18} color={Palette.accent} />
            </Pressable>

            <View style={styles.detailPhotoWrap}>
              {selected?.photoUri ? (
                <Pressable
                  onLongPress={() => setShowSaveOverlay(true)}
                  delayLongPress={400}
                  style={{ position: "relative" }}
                >
                  <Image
                    source={{ uri: selected.photoUri }}
                    style={[styles.detailImage, { aspectRatio: photoAspect }]}
                    resizeMode="cover"
                    onLoad={(e) => {
                      const { width, height } = e.nativeEvent.source;
                      if (width && height) setPhotoAspect(width / height);
                    }}
                  />
                  {showSaveOverlay && (
                    <View style={styles.saveOverlay}>
                      <Pressable
                        style={styles.saveBtn}
                        onPress={() => saveImage(selected.photoUri!)}
                      >
                        <Ionicons
                          name="download-outline"
                          size={18}
                          color="#fff"
                        />
                        <Text style={styles.saveBtnText}>Save Image</Text>
                      </Pressable>
                      <Pressable
                        style={styles.saveCancelBtn}
                        onPress={() => setShowSaveOverlay(false)}
                      >
                        <Text style={styles.saveCancelText}>Cancel</Text>
                      </Pressable>
                    </View>
                  )}
                </Pressable>
              ) : (
                <View style={styles.detailNoPhoto}>
                  <Text style={styles.detailNoPhotoMood}>{selected?.mood}</Text>
                </View>
              )}
            </View>

            {selected && (
              <View style={styles.detailBody}>
                <View style={styles.detailMetaRow}>
                  <View style={styles.detailDateRow}>
                    <Text style={styles.detailDate}>
                      {formatDate(selected.date)}
                    </Text>
                    <Text style={styles.detailTime}>
                      {formatTime(selected.createdAt)}
                    </Text>
                  </View>
                  <View style={styles.moodPill}>
                    <Text style={styles.moodPillText}>{selected.mood}</Text>
                  </View>
                </View>
                {selected.insight ? (
                  <View style={styles.detailInsightBox}>
                    <ScrollView
                      style={{ maxHeight: 130 }}
                      nestedScrollEnabled={true}
                      showsVerticalScrollIndicator={true}
                      scrollEventThrottle={16}
                    >
                      <Text style={styles.detailInsightText}>
                        {selected.insight}
                      </Text>
                    </ScrollView>
                  </View>
                ) : null}

                {selected.audioUri ? (
                  <Pressable style={styles.audioPlayBtn} onPress={togglePlay}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <Ionicons
                        name={isPlaying ? "pause" : "play"}
                        size={18}
                        color={Palette.highlight}
                      />
                      <Text style={styles.audioPlayText}>
                        {isPlaying ? "Playing..." : "Play voice note"}
                      </Text>
                    </View>
                    {audioDuration !== null && (
                      <Text style={styles.audioPlayDuration}>
                        {`${Math.floor(audioDuration / 60)}:${String(audioDuration % 60).padStart(2, "0")}`}
                      </Text>
                    )}
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.bgDark },
  safe: { flex: 1 },
  statsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 28,
  },
  statItem: { alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "300", color: Palette.accent },
  statLabel: {
    fontSize: 9,
    letterSpacing: 2,
    color: Palette.secondary,
    fontWeight: "600",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: `${Palette.secondary}30`,
  },
  scroll: { paddingHorizontal: 16 },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 20, color: Palette.accent, fontWeight: "300" },
  emptySubtitle: { fontSize: 14, color: Palette.secondary, opacity: 0.7 },
  emptyBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: Palette.primary,
  },
  emptyBtnText: { color: Palette.accent, fontSize: 14, fontWeight: "600" },
  monthSection: { marginBottom: 24 },
  monthLabel: {
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 2,
    color: Palette.secondary,
    fontWeight: "600",
    marginBottom: 12,
    paddingHorizontal: 4,
  },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  filterBar: { flexShrink: 0 },
  filterStrip: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  filterBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: `${Palette.primary}40`,
    borderWidth: 1,
    borderColor: `${Palette.primary}80`,
  },
  filterBadgeActive: {
    backgroundColor: Palette.highlight,
    borderColor: Palette.highlight,
  },
  filterBadgeText: {
    color: Palette.secondary,
    fontSize: 12,
    fontWeight: "600",
  },
  filterBadgeTextActive: {
    color: Palette.bgDark,
  },
  card: {
    width: CARD_W,
    aspectRatio: 3 / 4,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: Palette.surfaceDark,
    borderWidth: 1,
    borderColor: `${Palette.primary}30`,
  },
  cardImage: { width: CARD_W, height: CARD_W * (4 / 3), opacity: 0.9 },
  cardNoPhoto: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  cardNoPhotoMood: {
    color: Palette.secondary,
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,31,32,0.1)",
  },
  dayBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: `${Palette.accent}20`,
    borderWidth: 1,
    borderColor: `${Palette.accent}30`,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  dayBadgeText: {
    color: Palette.accent,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  cardBottom: { position: "absolute", bottom: 10, left: 10, right: 10 },
  cardDate: { color: "#eee", fontSize: 11, fontWeight: "500", marginBottom: 2 },
  cardInsight: { color: "rgba(218,241,222,0.7)", fontSize: 10, lineHeight: 14 },
  // Detail Modal
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(5,31,32,0.85)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  detailCard: {
    backgroundColor: Palette.bgDark,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Palette.surfaceDark,
    overflow: "hidden",
  },
  detailClose: {
    position: "absolute",
    top: 24,
    right: 24,
    zIndex: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(5,31,32,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  detailTrashBtn: {
    position: "absolute",
    top: 24,
    left: 24,
    zIndex: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(60,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  detailPhotoWrap: {
    margin: 14,
    borderRadius: 18,
    overflow: "hidden",
  },
  detailImage: { width: "100%" },
  detailNoPhoto: {
    aspectRatio: 4 / 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.primary,
  },
  detailNoPhotoMood: { fontSize: 52 },
  saveOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(20,20,20,0.88)",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  saveCancelBtn: {
    paddingHorizontal: 22,
    paddingVertical: 8,
    backgroundColor: "rgba(20,20,20,0.65)",
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  saveCancelText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "500",
  },
  detailBody: {
    paddingHorizontal: 20,
    paddingBottom: 22,
    paddingTop: 4,
    gap: 12,
  },
  detailMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  detailDateRow: { gap: 2 },
  detailDate: {
    color: Palette.accent,
    fontSize: 17,
    fontWeight: "500",
  },
  detailTime: {
    color: Palette.secondary,
    fontSize: 12,
    fontWeight: "400",
  },
  moodPill: {
    backgroundColor: `${Palette.highlight}18`,
    borderWidth: 1,
    borderColor: `${Palette.highlight}40`,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  moodPillText: {
    color: Palette.highlight,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  detailInsightBox: {
    backgroundColor: `${Palette.accent}10`,
    borderWidth: 1,
    borderColor: `${Palette.accent}30`,
    padding: 14,
    borderRadius: 12,
  },
  detailInsightText: {
    color: `${Palette.accent}CC`,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "300",
  },
  audioPlayBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: `${Palette.highlight}12`,
    borderWidth: 1,
    borderColor: `${Palette.highlight}35`,
    alignSelf: "stretch",
    justifyContent: "space-between",
  },
  audioPlayText: {
    color: Palette.highlight,
    fontSize: 13,
    fontWeight: "600",
  },
  audioPlayDuration: {
    color: `${Palette.highlight}90`,
    fontSize: 12,
    fontWeight: "500",
  },
});
