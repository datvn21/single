import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type { ImageWidgetSource } from "react-native-android-widget";

const WIDGET_DATA_KEY = "single_widget_data";

export interface WidgetCheckInData {
  mood: string;
  insight: string;
  date: string;
  streak: number;
  /** Must be http/https/data:image URI to work in widget */
  photoUri?: string;
}

/**
 * Save the latest check-in data for the home screen widget.
 */
export async function saveWidgetData(data: WidgetCheckInData): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(data));
  } catch {
    // Silently fail — widget data is non-critical
  }
}

/**
 * Load the latest check-in data for the widget.
 */
export async function loadWidgetData(): Promise<WidgetCheckInData | null> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_DATA_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WidgetCheckInData;
  } catch {
    return null;
  }
}

/**
 * Convert a file:// URI to a data URI that the widget can display.
 * Returns undefined if the URI is not a supported format.
 */
export function toWidgetImageSource(
  uri: string | undefined,
): ImageWidgetSource | undefined {
  if (!uri) return undefined;
  // Already supported formats
  if (uri.startsWith("http:") || uri.startsWith("https:") || uri.startsWith("data:image")) {
    return uri as ImageWidgetSource;
  }
  // file:// URIs are not directly supported by ImageWidget — skip for now
  return undefined;
}

/**
 * Request the Android widget to refresh its displayed data.
 */
export async function requestWidgetUpdate(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    const { requestWidgetUpdate: nativeUpdate } = await import(
      "react-native-android-widget"
    );
    const { SingleWidget, SingleWidgetEmpty } = await import(
      "@/components/single-widget"
    );

    const data = await loadWidgetData();

    await nativeUpdate({
      widgetName: "SingleWidget",
      renderWidget: () => {
        if (data) {
          return (
            <SingleWidget
              mood={data.mood}
              insight={data.insight}
              date={data.date}
              streak={data.streak}
              photoUri={toWidgetImageSource(data.photoUri)}
            />
          );
        }
        return <SingleWidgetEmpty />;
      },
    });
  } catch {
    // Widget might not be placed yet — ignore
  }
}
