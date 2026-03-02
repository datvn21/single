import { Ionicons } from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs, useRouter } from "expo-router";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Palette } from "@/constants/theme";

// Maps route name → label shown in pill
const LABELS: Record<string, string> = {
  index: "Feed",
  explore: "Gallery",
};

function FloatingPillTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Only the real tabs (index, explore) — skip _checkin
  const visibleRoutes = state.routes.filter((r) => r.name !== "_checkin");

  return (
    <View style={[styles.outerWrap, { paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.pill}>
        {/* Left tab */}
        {visibleRoutes.map((route, i) => {
          const isActive = state.index === state.routes.indexOf(route);
          const label = LABELS[route.name] ?? route.name;

          // Insert center + button between the two tabs
          const isLast = i === visibleRoutes.length - 1;

          return (
            <React.Fragment key={route.key}>
              <TouchableOpacity
                style={styles.tabItem}
                activeOpacity={0.7}
                onPress={() => {
                  const event = navigation.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!event.defaultPrevented) {
                    navigation.navigate(route.name);
                  }
                }}
              >
                <Text
                  style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                >
                  {label}
                </Text>
                {isActive && <View style={styles.dot} />}
              </TouchableOpacity>

              {/* Center + button between the two tabs */}
              {!isLast && (
                <View style={styles.centerWrap}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.centerBtn,
                      pressed && { opacity: 0.8, transform: [{ scale: 0.92 }] },
                    ]}
                    onPress={() => router.push("/modal")}
                  >
                    <Ionicons name="add" size={28} color={Palette.bgDark} />
                  </Pressable>
                </View>
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingPillTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="_checkin" />
      <Tabs.Screen name="explore" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  outerWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    pointerEvents: "box-none",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.navBg,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 12,
  },
  tabItem: {
    width: 88,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: `${Palette.secondary}45`,
  },
  tabLabelActive: {
    color: Palette.secondary,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 10,
    backgroundColor: Palette.highlight,
    marginTop: 4,
  },
  centerWrap: {
    // push the button UP above the pill
    alignItems: "center",
    marginTop: -28,
    marginHorizontal: 4,
  },
  centerBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Palette.highlight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: Palette.bgDark,
    elevation: 8,
  },
});
