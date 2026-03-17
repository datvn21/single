import React from "react";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { SingleWidget, SingleWidgetEmpty } from "@/components/single-widget";
import { loadWidgetData, toWidgetImageSource } from "@/hooks/use-widget-data";

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;

  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED": {
      if (widgetInfo.widgetName !== "SingleWidget") return;

      const data = await loadWidgetData();

      if (data) {
        props.renderWidget(
          <SingleWidget
            mood={data.mood}
            insight={data.insight}
            date={data.date}
            streak={data.streak}
            photoUri={toWidgetImageSource(data.photoUri)}
          />,
        );
      } else {
        props.renderWidget(<SingleWidgetEmpty />);
      }
      break;
    }

    case "WIDGET_DELETED":
      break;

    case "WIDGET_CLICK":
      break;

    default:
      break;
  }
}
