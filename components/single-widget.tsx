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
  streak?: number;
  photoUri?: ImageWidgetSource;
}

const DARK_BG = '#051f20';
const SURFACE = '#0a2e2f';
const PRIMARY = '#0d3b3c';
const ACCENT = '#e0f0e3';
const HIGHLIGHT = '#4caf50';

export function SingleWidget({
  mood = '😌',
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
    >
      <OverlapWidget
        style={{ height: 'match_parent', width: 'match_parent' }}
      >
        {/* Layer 1: Photo background (or dark fallback) */}
        {photoUri ? (
          <ImageWidget
            image={photoUri}
            imageWidth={300}
            imageHeight={300}
            style={{ width: 'match_parent', height: 'match_parent' }}
            radius={24}
          />
        ) : (
          <FlexWidget
            style={{
              width: 'match_parent',
              height: 'match_parent',
              backgroundColor: SURFACE,
              borderRadius: 24,
            }}
          />
        )}

        {/* Layer 2: Gradient-like dark overlay */}
        <FlexWidget
          style={{
            height: 'match_parent',
            width: 'match_parent',
            backgroundColor: '#00000066',
            borderRadius: 24,
          }}
        />

        {/* Layer 3: Content overlay */}
        <FlexWidget
          style={{
            height: 'match_parent',
            width: 'match_parent',
            borderRadius: 24,
          }}
        >
          {/* Top row: streak badge top-right */}
          <FlexWidget
            style={{
              width: 'match_parent',
              flexDirection: 'row',
              justifyContent: 'flex-end',
              padding: 12,
            }}
          >
            {streak > 0 ? (
              <FlexWidget
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#00000099',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 14,
                }}
              >
                <TextWidget
                  text="🔥"
                  style={{ fontSize: 14 }}
                />
                <TextWidget
                  text={`${streak}`}
                  style={{
                    fontSize: 14,
                    color: HIGHLIGHT,
                    fontWeight: '800',
                    marginLeft: 3,
                  }}
                />
              </FlexWidget>
            ) : (
              <FlexWidget style={{ height: 1 }} />
            )}
          </FlexWidget>

          {/* Spacer to push mood to bottom */}
          <FlexWidget style={{ flex: 1 }} />

          {/* Bottom: mood floating center */}
          <FlexWidget
            style={{
              width: 'match_parent',
              alignItems: 'center',
              paddingBottom: 14,
            }}
          >
            <FlexWidget
              style={{
                backgroundColor: '#00000099',
                paddingHorizontal: 20,
                paddingVertical: 8,
                borderRadius: 20,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <TextWidget
                text={mood}
                style={{ fontSize: 24 }}
              />
            </FlexWidget>
          </FlexWidget>
        </FlexWidget>
      </OverlapWidget>
    </FlexWidget>
  );
}

/** Empty state widget */
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
    >
      <TextWidget
        text="Single?"
        style={{
          fontSize: 20,
          color: ACCENT,
          fontWeight: '700',
        }}
      />
      <TextWidget
        text="Tap to check in"
        style={{
          fontSize: 12,
          color: '#8fa89b',
          marginTop: 4,
        }}
      />
    </FlexWidget>
  );
}
