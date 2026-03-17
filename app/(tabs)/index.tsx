import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader } from "@/components/app-header";
import { HomeWidget, useCountUp } from "@/components/home-widgets";
import { Palette } from "@/constants/theme";
import { CheckIn, localDateStr, useAppData } from "@/hooks/use-app-data";



const QUOTES = [
  {
    text: "The most important relationship you'll ever have is the one with yourself.",
    author: "Diane Von Furstenberg",
  },
  {
    text: "Being alone is not the same as being lonely. It's the space where you find yourself.",
    author: "",
  },
  { text: "You are enough. A thousand times enough.", author: "" },
  {
    text: "Solitude is not a punishment. It's a gift you give yourself.",
    author: "",
  },
  {
    text: "Learn to enjoy your own company. You are the one person you will never lose.",
    author: "",
  },
  {
    text: "The strongest person in the room is the one comfortable in their own silence.",
    author: "",
  },
  {
    text: "Your vibe is yours alone. Protect it, nurture it, celebrate it.",
    author: "",
  },
  {
    text: "Single is not a status. It is a word that describes a person strong enough to live and enjoy life without depending on others.",
    author: "",
  },
  {
    text: "Until you get comfortable with being alone, you'll never know if you're choosing someone out of love or loneliness.",
    author: "Mandy Hale",
  },
  {
    text: "The day you decide you are more interested in being aware of your thoughts than you are in the thoughts themselves — that is the day you will find your way out.",
    author: "",
  },
  {
    text: "You have to grow from the inside out. None can teach you, none can make you spiritual. There is no other teacher but your own soul.",
    author: "Swami Vivekananda",
  },
  {
    text: "Every morning is a new chance to write your own story.",
    author: "",
  },
  {
    text: "Happiness is not something you find with someone else. It's something you build inside yourself.",
    author: "",
  },
  {
    text: "Your own company is the only company you are guaranteed to keep forever.",
    author: "",
  },
  {
    text: "Do not rush. The universe is working on perfecting what's meant for you.",
    author: "",
  },
  { text: "I restore myself when I'm alone.", author: "Marilyn Monroe" },
  {
    text: "Knowing yourself is the beginning of all wisdom.",
    author: "Aristotle",
  },
  {
    text: "The soul that sees beauty may sometimes walk alone.",
    author: "Goethe",
  },
  {
    text: "You are a whole person on your own. Someone else is meant to complement that, not complete it.",
    author: "",
  },
  {
    text: "Take your time. Becoming who you are meant to be is a journey, not a deadline.",
    author: "",
  },
];

// Card layout constants are computed inside the component with useWindowDimensions
const CARD_SIDE_PAD = 20;
const CARD_GAP = 12;

type DeckItem = { type: "new" } | { type: "entry"; checkIn: CheckIn };

function formatStartDate(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDay(dateStr: string) {
  const today = localDateStr();
  const yesterday = localDateStr(new Date(Date.now() - 86400000));
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function HomeScreen() {
  const router = useRouter();
  const { data, todayCheckIns, daysSingle, streak, checkInList, widgetConfig } =
    useAppData();
  const enabledWidgets = widgetConfig.filter((w) => w.enabled);
  const deckPos = enabledWidgets.findIndex((w) => w.id === "deck");
  const hasBeforeDeck = deckPos > 0;
  const today = localDateStr();

  // Responsive card dimensions
  const { width: screenW } = useWindowDimensions();
  const cardW = screenW - CARD_SIDE_PAD * 2;
  const cardH = Math.round(cardW * (5 / 4));
  const snapInterval = cardW + CARD_GAP;

  // Count-up animation for streak (reuse shared hook)
  const displayStreak = useCountUp(streak, 700);


  // Deck: card 0 = latest today entry (with add FAB) or empty add card;
  // then remaining entries newest first, capped at 10 total entries
  const todayLatest = todayCheckIns[0] ?? null;
  const recentEntries = (checkInList ?? []).slice(0, 10);

  const deckData: DeckItem[] = todayLatest
    ? [
        { type: "entry", checkIn: todayLatest },
        ...recentEntries
          .filter((c) => c.id !== todayLatest.id)
          .slice(0, 9)
          .map((c): DeckItem => ({ type: "entry", checkIn: c })),
      ]
    : [
        { type: "new" },
        ...recentEntries.map((c): DeckItem => ({ type: "entry", checkIn: c })),
      ];

  const [activeIndex, setActiveIndex] = useState(0);
  const flatRef = useRef<FlatList<DeckItem>>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const swipePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        g.dx < -12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50 || g.vx < -0.4) router.navigate("/(tabs)/explore");
      },
    }),
  ).current;
  const heroOpacity = scrollY.interpolate({
    inputRange: [0, 70],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const heroTranslate = scrollY.interpolate({
    inputRange: [0, 70],
    outputRange: [0, -24],
    extrapolate: "clamp",
  });
  const compactOpacity = scrollY.interpolate({
    inputRange: [40, 80],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const dailyQuote = useMemo(() => {
    const today2 = new Date();
    const seed =
      today2.getFullYear() * 10000 +
      (today2.getMonth() + 1) * 100 +
      today2.getDate();
    return QUOTES[seed % QUOTES.length];
  }, []);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / snapInterval);
    setActiveIndex(idx);
  }, [snapInterval]);

  const handleCheckIn = useCallback(() => {
    router.push("/modal");
  }, [router]);

  const handleSettings = useCallback(() => {
    router.push("/settings");
  }, [router]);

  return (
    <View style={styles.container} {...swipePan.panHandlers}>
      <StatusBar barStyle="light-content" backgroundColor={Palette.bgDark} />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <AppHeader />

        <View style={styles.contentArea}>
          {/* Compact collapsed header — fades in on scroll */}
          {hasBeforeDeck && (
            <Animated.View
              style={[styles.compactHeader, { opacity: compactOpacity }]}
              pointerEvents="none"
            >
              <Text style={styles.compactDays}>
                {data.startDate ? daysSingle : "—"}
                <Text style={styles.compactDaysLabel}> days</Text>
              </Text>
              {streak > 0 && (
                <View style={styles.compactStreak}>
                  <Text style={styles.compactStreakText}>
                    🔥 {displayStreak}
                  </Text>
                </View>
              )}
            </Animated.View>
          )}

          <Animated.ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true },
            )}
          >
            {/* Day Counter */}
            <Animated.View
              style={[
                styles.counterBlock,
                hasBeforeDeck && {
                  opacity: heroOpacity,
                  transform: [{ translateY: heroTranslate }],
                },
              ]}
            >
              <Text style={styles.daysLabel}>SINGLE DAYS</Text>
              <Text style={styles.daysNumber}>
                {data.startDate ? daysSingle : "—"}
              </Text>
              {data.startDate && (
                <Text style={styles.sinceText}>
                  Since {formatStartDate(data.startDate)}
                </Text>
              )}
              {streak > 0 && (
                <View style={styles.streakBadge}>
                  <Text style={styles.streakFire}>🔥</Text>
                  <Text style={styles.streakText}>
                    {displayStreak} day streak
                  </Text>
                </View>
              )}
              {!data.startDate && (
                <Pressable onPress={handleSettings} style={styles.setDateBtn}>
                  <Text style={styles.setDateBtnText}>
                    Set your start date →
                  </Text>
                </Pressable>
              )}
            </Animated.View>

            {/* Widget loop — ordered & toggleable */}
            {enabledWidgets.map((wc, wIdx) => {
              const heroStyle =
                deckPos !== -1 && wIdx < deckPos
                  ? {
                      opacity: heroOpacity,
                      transform: [{ translateY: heroTranslate }],
                    }
                  : undefined;

              switch (wc.id) {
                case "quote":
                  return (
                    <Animated.View key="quote" style={heroStyle}>
                      <View style={styles.quoteCard}>
                        <Text style={styles.quoteBgMark}>{"\u201C"}</Text>
                        <Text style={styles.quoteLabel}>DAILY REFLECTION</Text>
                        <Text style={styles.quoteText}>{dailyQuote.text}</Text>
                        {dailyQuote.author ? (
                          <View style={styles.quoteAuthorRow}>
                            <View style={styles.quoteAuthorLine} />
                            <Text style={styles.quoteAuthor}>
                              {dailyQuote.author}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </Animated.View>
                  );

                case "deck":
                  return (
                    <View key="deck" style={[styles.deckWrapper, { height: cardH + 28 }]}>
                      <FlatList
                        ref={flatRef}
                        data={deckData}
                        keyExtractor={(item) =>
                          item.type === "new" ? "new" : item.checkIn.id
                        }
                        horizontal
                        pagingEnabled={false}
                        snapToInterval={snapInterval}
                        snapToAlignment="start"
                        decelerationRate="fast"
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.deckRow}
                        onScroll={onScroll}
                        scrollEventThrottle={16}
                        renderItem={({ item }) => {
                          if (item.type === "new") {
                            return (
                              <View style={[styles.deckCard, { width: cardW, height: cardH }]}>
                                <View style={styles.todayBadge}>
                                  <Text style={styles.todayBadgeText}>
                                    Today
                                  </Text>
                                </View>
                                <View style={styles.emptyCenter}>
                                  <Pressable
                                    style={({ pressed }) => [
                                      styles.addButton,
                                      pressed && {
                                        opacity: 0.8,
                                        transform: [{ scale: 0.95 }],
                                      },
                                    ]}
                                    onPress={handleCheckIn}
                                  >
                                    <Ionicons
                                      name="add"
                                      size={36}
                                      color={Palette.accent}
                                    />
                                  </Pressable>
                                  <Text style={styles.emptyHint}>
                                    Log today&#39;s moment
                                  </Text>
                                </View>
                              </View>
                            );
                          }
                          const ci = item.checkIn;
                          const isToday = ci.date === today;
                          return (
                            <Pressable
                              style={[styles.deckCard, { width: cardW, height: cardH }]}
                              onPress={() => router.push("/(tabs)/explore")}
                            >
                              {ci.photoUri ? (
                                <Image
                                  source={{ uri: ci.photoUri }}
                                  style={StyleSheet.absoluteFillObject}
                                  resizeMode="cover"
                                />
                              ) : null}
                              {ci.photoUri && (
                                <View style={styles.cardOverlay} />
                              )}
                              {isToday ? (
                                <View style={styles.todayBadge}>
                                  <Text style={styles.todayBadgeText}>
                                    Today
                                  </Text>
                                </View>
                              ) : (
                                <View style={styles.cardTop}>
                                  <Text style={styles.cardDateLabel}>
                                    {formatDay(ci.date)}
                                  </Text>
                                </View>
                              )}
                              <View style={styles.cardBottom}>
                                <View style={styles.moodPill}>
                                  <Text style={styles.moodPillText}>
                                    {ci.mood}
                                  </Text>
                                </View>
                                {ci.insight ? (
                                  <Text
                                    style={[
                                      styles.cardInsight,
                                      !ci.photoUri && styles.cardInsightDark,
                                    ]}
                                    numberOfLines={3}
                                  >
                                    {ci.insight}
                                  </Text>
                                ) : null}
                              </View>
                            </Pressable>
                          );
                        }}
                      />
                      {deckData.length > 1 && (
                        <View style={styles.dotsRow}>
                          {deckData.map((_, i) => (
                            <View
                              key={i}
                              style={[
                                styles.dot,
                                i === activeIndex && styles.dotActive,
                              ]}
                            />
                          ))}
                        </View>
                      )}
                    </View>
                  );

                default:
                  if (checkInList.length === 0) return null;
                  return (
                    <View key={wc.id} style={{ marginBottom: 10 }}>
                      <HomeWidget
                        widgetId={wc.id}
                        checkInList={checkInList}
                        streak={streak}
                        startDate={data.startDate}
                        onSelectCheckIn={() =>
                          router.navigate("/(tabs)/explore")
                        }
                      />
                    </View>
                  );
              }
            })}

            <View style={{ height: 120 }} />
          </Animated.ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.bgDark },
  safe: { flex: 1 },
  contentArea: { flex: 1, position: "relative" },
  scroll: { paddingHorizontal: 16 },
  counterBlock: { alignItems: "center", paddingVertical: 28 },
  daysLabel: {
    fontSize: 11,
    letterSpacing: 3,
    color: Palette.secondary,
    fontWeight: "600",
    marginBottom: 4,
  },
  daysNumber: {
    fontSize: 88,
    fontWeight: "200",
    color: Palette.accent,
    lineHeight: 96,
    letterSpacing: -2,
  },
  sinceText: {
    fontSize: 12,
    color: Palette.secondary,
    opacity: 0.7,
    marginTop: 4,
    fontStyle: "italic",
  },
  setDateBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Palette.primary,
  },
  setDateBtnText: { color: Palette.secondary, fontSize: 14 },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    backgroundColor: Palette.surfaceDark,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  streakFire: { fontSize: 14 },
  streakText: { color: Palette.accent, fontSize: 12, fontWeight: "500" },
  compactHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    backgroundColor: Palette.bgDark,
  },
  compactDays: {
    color: Palette.accent,
    fontSize: 22,
    fontWeight: "200",
  },
  compactDaysLabel: {
    color: Palette.secondary,
    fontSize: 13,
    fontWeight: "400",
  },
  compactStreak: {
    backgroundColor: Palette.surfaceDark,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  compactStreakText: { color: Palette.accent, fontSize: 13 },
  quoteCard: {
    backgroundColor: `${Palette.primary}35`,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    marginBottom: 20,
    overflow: "hidden",
  },
  quoteBgMark: {
    position: "absolute",
    top: -10,
    right: 12,
    fontSize: 96,
    lineHeight: 96,
    color: Palette.highlight,
    opacity: 0.07,
    fontWeight: "900",
  },
  quoteLabel: {
    fontSize: 9,
    letterSpacing: 2.5,
    color: Palette.highlight,
    fontWeight: "700",
    marginBottom: 10,
    opacity: 0.75,
  },
  quoteText: {
    color: Palette.accent,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "300",
    fontStyle: "italic",
  },
  quoteAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    gap: 10,
  },
  quoteAuthorLine: {
    width: 18,
    height: 1,
    backgroundColor: Palette.secondary,
    opacity: 0.4,
  },
  quoteAuthor: {
    color: Palette.secondary,
    fontSize: 12,
    fontWeight: "500",
    opacity: 0.8,
  },
  // ── Deck ──────────────────────────────────────────────────────────────────
  // Break out of parent ScrollView's paddingHorizontal so the FlatList
  // occupies the full screen width and snap math aligns correctly.
  deckWrapper: { marginBottom: 24, marginHorizontal: -16 },
  deckRow: {
    paddingHorizontal: CARD_SIDE_PAD,
    gap: CARD_GAP,
  },
  deckCard: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: Palette.surfaceDark,
    borderWidth: 1,
    borderColor: `${Palette.primary}40`,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,31,32,0.38)",
  },
  todayBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  todayBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  cardTop: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
  },
  cardDateLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  cardBottom: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  },
  moodPill: {
    alignSelf: "flex-start",
    backgroundColor: `${Palette.accent}25`,
    borderWidth: 1,
    borderColor: `${Palette.accent}40`,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  moodPillText: {
    color: Palette.accent,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  cardInsight: {
    color: "rgba(218,241,222,0.85)",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "300",
    fontStyle: "italic",
    backgroundColor: "rgba(218,241,222,0.07)",
    borderWidth: 1,
    borderColor: "rgba(218,241,222,0.15)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cardInsightDark: {
    color: Palette.accent,
    fontSize: 16,
    lineHeight: 24,
  },
  emptyCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 48, // push below today badge
  },
  addButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${Palette.primary}CC`,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: `${Palette.secondary}50`,
    shadowColor: Palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  emptyHint: {
    color: Palette.secondary,
    fontSize: 13,
    opacity: 0.7,
    letterSpacing: 0.5,
  },
  addFab: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Palette.highlight,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Palette.highlight,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 4,
  },
  deleteFab: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,60,60,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,60,60,0.25)",
    alignItems: "center",
    justifyContent: "center",
  } as const,
  deleteFabLeft: {
    position: "absolute",
    bottom: 16,
    left: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,60,60,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,60,60,0.25)",
    alignItems: "center",
    justifyContent: "center",
  } as const,
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: `${Palette.secondary}35`,
  },
  dotActive: {
    width: 16,
    backgroundColor: Palette.highlight,
  },
});
