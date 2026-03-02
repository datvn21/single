import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import SingleLogo from "@/assets/single_.svg";
import { Palette } from "@/constants/theme";

interface Props {
  /** Override right-side slot (default: settings icon) */
  right?: React.ReactNode;
}

export function AppHeader({ right }: Props) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <SingleLogo width={100} height={28} />
      {right !== undefined ? (
        right
      ) : (
        <Pressable
          onPress={() => router.push("/settings")}
          hitSlop={12}
          style={styles.iconBtn}
        >
          <Ionicons
            name="settings-outline"
            size={22}
            color={Palette.secondary}
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
