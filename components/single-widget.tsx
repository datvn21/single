'use no memo';

import React from 'react';
import {
  FlexWidget,
  TextWidget,
  OverlapWidget,
  ImageWidget,
} from 'react-native-android-widget';
import type { ImageWidgetSource } from 'react-native-android-widget';

interface SingleWidgetProps {
  mood?: string;
  insight?: string;
  date?: string;
  streak?: number;
  /** Must be http:, https:, or data:image URI */
  photoUri?: ImageWidgetSource;
}

const DARK_BG = '#051f20';
const SURFACE = '#0a2e2f';
const PRIMARY = '#0d3b3c';
const ACCENT = '#e0f0e3';
const HIGHLIGHT = '#4caf50';
const SECONDARY = '#8fa89b';

function StreakBadge({ streak }: { streak: number }) {
  if (streak <= 0) return null;
  return (
    <FlexWidget
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        backgroundColor: '#4caf5033',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
      }}
    >
      <TextWidget
        text={`🔥 ${streak} day streak`}
        style={{
          fontSize: 12,
          color: HIGHLIGHT,
          fontWeight: '700',
        }}
      />
    </FlexWidget>
  );
}

function InfoColumn({
  date,
  insight,
  streak,
}: {
  date: string;
  insight: string;
  streak: number;
}) {
  return (
    <FlexWidget
      style={{
        flex: 1,
        marginLeft: 14,
        justifyContent: 'center',
      }}
    >
      <TextWidget
        text={date}
        style={{
          fontSize: 11,
          color: SECONDARY,
          fontWeight: '600',
        }}
      />
      {insight ? (
        <TextWidget
          text={insight}
          style={{
            fontSize: 14,
            color: ACCENT,
            marginTop: 3,
          }}
          maxLines={2}
          truncate="END"
        />
      ) : null}
      <StreakBadge streak={streak} />
    </FlexWidget>
  );
}

function MoodCircle({ mood, bg }: { mood: string; bg: `#${string}` }) {
  return (
    <FlexWidget
      style={{
        width: 64,
        height: 64,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: bg,
        borderRadius: 20,
      }}
    >
      <TextWidget text={mood} style={{ fontSize: 32 }} />
    </FlexWidget>
  );
}

export function SingleWidget({
  mood = '😌',
  insight = '',
  date = 'Today',
  streak = 0,
  photoUri,
}: SingleWidgetProps) {
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        borderRadius: 24,
        backgroundColor: DARK_BG,
        overflow: 'hidden',
      }}
      clickAction="OPEN_APP"
      clickActionData={{ screen: '/(tabs)' }}
    >
      {photoUri ? (
        <OverlapWidget
          style={{ height: 'match_parent', width: 'match_parent' }}
        >
          <ImageWidget
            image={photoUri}
            imageWidth={400}
            imageHeight={200}
            style={{ width: 'match_parent', height: 'match_parent' }}
            radius={24}
          />

          {/* Dark overlay */}
          <FlexWidget
            style={{
              height: 'match_parent',
              width: 'match_parent',
              backgroundColor: '#051f20a6',
              borderRadius: 24,
            }}
          />

          {/* Content */}
          <FlexWidget
            style={{
              height: 'match_parent',
              width: 'match_parent',
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
            }}
          >
            <MoodCircle mood={mood} bg="#ffffff1f" />
            <InfoColumn date={date} insight={insight} streak={streak} />
          </FlexWidget>
        </OverlapWidget>
      ) : (
        <FlexWidget
          style={{
            height: 'match_parent',
            width: 'match_parent',
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            backgroundColor: SURFACE,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: PRIMARY,
          }}
        >
          <MoodCircle mood={mood} bg={PRIMARY} />
          <InfoColumn date={date} insight={insight} streak={streak} />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

/** Empty state widget shown when no check-in exists */
export function SingleWidgetEmpty() {
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: SURFACE,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: PRIMARY,
      }}
      clickAction="OPEN_APP"
      clickActionData={{ screen: '/modal' }}
    >
      <TextWidget
        text="Single?"
        style={{
          fontSize: 22,
          color: ACCENT,
          fontWeight: '700',
        }}
      />
      <TextWidget
        text="Tap to add today's check-in"
        style={{
          fontSize: 13,
          color: SECONDARY,
          marginTop: 6,
        }}
      />
    </FlexWidget>
  );
}
