// Register widget task handler BEFORE expo-router initializes
import { registerWidgetTaskHandler } from "react-native-android-widget";
import { widgetTaskHandler } from "./widget-task-handler";

registerWidgetTaskHandler(widgetTaskHandler);

// Re-export the default expo-router entry
require("expo-router/entry");
