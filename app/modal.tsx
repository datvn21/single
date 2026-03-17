import { Ionicons } from "@expo/vector-icons";
import {
  AudioModule,
  AudioPlayer,
  RecordingPresets,
  createAudioPlayer,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Palette } from "@/constants/theme";
import { CheckIn, localDateStr, useAppData } from "@/hooks/use-app-data";

function formatRecSecs(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function parseTags(input: string): string[] {
  const unique = new Set<string>();
  input
    .split(/[\s,]+/)
    .map((raw) => raw.replace(/^#/, "").trim().toLowerCase())
    .filter(Boolean)
    .forEach((tag) => unique.add(tag));
  return Array.from(unique).slice(0, 8);
}

export default function ModalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ editId?: string }>();
  const { saveCheckIn, customMoods, checkInList } = useAppData();
  const editId = typeof params.editId === "string" ? params.editId : null;
  const editingEntry: CheckIn | null = editId
    ? checkInList.find((ci) => ci.id === editId) ?? null
    : null;
  const isEditMode = !!editingEntry;

  const [mood, setMood] = useState<string | null>(null);
  const [insight, setInsight] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  // — Audio recording —
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const [audioUri, setAudioUri] = useState<string | undefined>(undefined);
  const [recDuration, setRecDuration] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // — Audio playback (preview after recording) —
  const playbackRef = useRef<AudioPlayer | null>(null);
  const [isPlayingBack, setIsPlayingBack] = useState(false);

  useEffect(() => {
    if (!editingEntry) return;
    setMood(editingEntry.mood);
    setInsight(editingEntry.insight ?? "");
    setTagsText((editingEntry.tags ?? []).map((t) => `#${t}`).join(" "));
    setPhotoUri(editingEntry.photoUri);
    setAudioUri(editingEntry.audioUri);
    setRecDuration(0);
  }, [editingEntry]);

  useEffect(() => {
    playbackRef.current?.remove();
    playbackRef.current = null;
    setIsPlayingBack(false);
    if (!audioUri) return;
    const player = createAudioPlayer({ uri: audioUri });
    playbackRef.current = player;
    const sub = player.addListener("playbackStatusUpdate", (status) => {
      setIsPlayingBack(status.playing ?? false);
    });
    return () => {
      sub.remove();
      player.remove();
      playbackRef.current = null;
    };
  }, [audioUri]);

  const togglePlayback = () => {
    if (!playbackRef.current) return;
    if (isPlayingBack) {
      playbackRef.current.pause();
    } else {
      playbackRef.current.seekTo(0);
      playbackRef.current.play();
    }
  };

  useEffect(() => {
    if (recorderState.isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [recorderState.isRecording]);

  const startRecording = async () => {
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert(
          "Permission needed",
          "Allow microphone access to record voice.",
        );
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (e) {
      Alert.alert("Recording failed", String(e));
    }
  };

  const stopRecording = async () => {
    setRecDuration(Math.round((recorderState.durationMillis ?? 0) / 1000));
    await audioRecorder.stop();
    const uri = audioRecorder.uri;
    if (uri) setAudioUri(uri);
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: false,
    });
  };

  const discardAudio = () => {
    setAudioUri(undefined);
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please allow access to your photo library.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow camera access.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!mood) {
      Alert.alert("Pick a mood", "How are you feeling today?");
      return;
    }
    setSaving(true);
    try {
      const date = editingEntry?.date ?? localDateStr();
      const createdAt = editingEntry?.createdAt ?? Date.now();
      const id = editingEntry?.id ?? `${date}_${createdAt}`;
      await saveCheckIn({
        id,
        date,
        mood,
        insight: insight.trim(),
        tags: parseTags(tagsText),
        photoUri,
        audioUri,
        createdAt,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Palette.bgDark} />
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={styles.closeBtn}
              hitSlop={10}
            >
              <Ionicons name="close" size={22} color={Palette.accent} />
            </Pressable>
            <Text style={styles.headerTitle}>{isEditMode ? "EDIT INSIGHT" : "DAILY INSIGHT"}</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
          >
            {/* Question */}
            <Text style={styles.question}>
              {isEditMode ? "How were you" : "How are you"}{"\n"}
              <Text style={styles.questionAccent}>feeling today?</Text>
            </Text>

            {/* Mood Options */}
            {mood ? (
              <Pressable
                onPress={() => setMood(null)}
                style={styles.moodSelectedPill}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={Palette.bgDark}
                />
                <Text style={styles.moodSelectedText}>{mood}</Text>
              </Pressable>
            ) : (
              <View style={styles.moodList}>
                {customMoods.map((m) => (
                  <Pressable
                    key={m}
                    style={({ pressed }) => [
                      styles.moodOption,
                      pressed && {
                        opacity: 0.85,
                        transform: [{ scale: 0.98 }],
                      },
                    ]}
                    onPress={() => setMood(m)}
                  >
                    <Text style={styles.moodOptionText}>{m}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Photo Section */}
            <View style={styles.photoSection}>
              <Text style={styles.sectionLabel}>TODAY{"'"}S PHOTO</Text>
              {photoUri ? (
                <View style={styles.photoPreviewWrap}>
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.photoPreview}
                    resizeMode="cover"
                  />
                  <Pressable
                    style={styles.photoRemove}
                    onPress={() => setPhotoUri(undefined)}
                  >
                    <Ionicons name="close-circle" size={28} color="#fff" />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.photoPickerRow}>
                  <Pressable
                    style={styles.photoPickerBtn}
                    onPress={pickFromCamera}
                  >
                    <Ionicons
                      name="camera-outline"
                      size={24}
                      color={Palette.secondary}
                    />
                    <Text style={styles.photoPickerBtnText}>Camera</Text>
                  </Pressable>
                  <Pressable
                    style={styles.photoPickerBtn}
                    onPress={pickFromLibrary}
                  >
                    <Ionicons
                      name="images-outline"
                      size={24}
                      color={Palette.secondary}
                    />
                    <Text style={styles.photoPickerBtnText}>Library</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Insight Text */}
            <View style={styles.insightSection}>
              <Text style={styles.sectionLabel}>YOUR INSIGHT</Text>
              <TextInput
                style={styles.insightInput}
                placeholder="Write a thought about today..."
                placeholderTextColor={`${Palette.secondary}60`}
                value={insight}
                onChangeText={setInsight}
                multiline
                maxLength={300}
                textAlignVertical="top"
              />
            </View>

            {/* Tags */}
            <View style={styles.tagSection}>
              <Text style={styles.sectionLabel}>TAGS</Text>
              <TextInput
                style={styles.tagInput}
                placeholder="#work #health #gratitude"
                placeholderTextColor={`${Palette.secondary}60`}
                value={tagsText}
                onChangeText={setTagsText}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={120}
              />
            </View>

            {/* Voice Note Section */}
            <View style={styles.voiceSection}>
              <Text style={styles.sectionLabel}>VOICE NOTE</Text>
              {audioUri ? (
                <View style={styles.audioPill}>
                  <View style={styles.audioPillIcon}>
                    <Ionicons name="mic" size={18} color={Palette.highlight} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.audioPillTitle}>Voice recorded</Text>
                    <Text style={styles.audioPillDuration}>
                      {formatRecSecs(recDuration)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={togglePlayback}
                    hitSlop={10}
                    style={styles.audioPillPlay}
                  >
                    <Ionicons
                      name={isPlayingBack ? "pause-circle" : "play-circle"}
                      size={28}
                      color={Palette.highlight}
                    />
                  </Pressable>
                  <Pressable
                    onPress={discardAudio}
                    hitSlop={10}
                    style={styles.audioPillDiscard}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color="rgba(255,90,90,0.8)"
                    />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={[
                    styles.micBtnWrap,
                    recorderState.isRecording && styles.micBtnWrapActive,
                  ]}
                  onPress={
                    recorderState.isRecording ? stopRecording : startRecording
                  }
                >
                  <Animated.View
                    style={[
                      styles.micPulse,
                      recorderState.isRecording && styles.micPulseActive,
                      { transform: [{ scale: pulseAnim }] },
                    ]}
                  />
                  <Ionicons
                    name={
                      recorderState.isRecording ? "stop-circle" : "mic-outline"
                    }
                    size={26}
                    color={
                      recorderState.isRecording ? "#ff5a5a" : Palette.secondary
                    }
                  />
                  <View>
                    <Text
                      style={[
                        styles.micBtnLabel,
                        recorderState.isRecording && styles.micBtnLabelActive,
                      ]}
                    >
                      {recorderState.isRecording ? "Recording..." : "Record"}
                    </Text>
                    {recorderState.isRecording ? (
                      <Text style={styles.recTimer}>
                        {formatRecSecs(
                          Math.round(
                            (recorderState.durationMillis ?? 0) / 1000,
                          ),
                        )}
                      </Text>
                    ) : (
                      <Text style={styles.micBtnSub}>Tap to start</Text>
                    )}
                  </View>
                </Pressable>
              )}
            </View>

            {/* Save Button */}
            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                saving && { opacity: 0.6 },
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>
                {saving ? "Saving..." : isEditMode ? "Update Insight" : "Save Insight"}
              </Text>
              <Ionicons name="arrow-forward" size={20} color={Palette.bgDark} />
            </Pressable>

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.bgDark },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${Palette.surfaceDark}CC`,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 11,
    letterSpacing: 3,
    color: `${Palette.accent}90`,
    fontWeight: "700",
  },
  scroll: { paddingHorizontal: 24, paddingTop: 8 },
  question: {
    fontSize: 36,
    fontWeight: "700",
    color: Palette.accent,
    lineHeight: 42,
    marginBottom: 32,
    letterSpacing: -0.5,
  },
  questionAccent: {
    color: Palette.accentText,
    fontStyle: "italic",
  },
  moodList: { gap: 12, marginBottom: 32 },
  moodOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${Palette.highlight}25`,
    backgroundColor: `${Palette.highlight}08`,
  },
  moodOptionText: {
    fontSize: 18,
    fontWeight: "500",
    color: Palette.accentText,
  },
  moodSelectedPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: Palette.highlight,
    marginBottom: 32,
  },
  moodSelectedText: {
    fontSize: 18,
    fontWeight: "700",
    color: Palette.bgDark,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 2.5,
    color: `${Palette.secondary}80`,
    fontWeight: "700",
    marginBottom: 12,
  },
  photoSection: { marginBottom: 28 },
  photoPreviewWrap: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
  },
  photoPreview: { width: "100%", height: "100%" },
  photoRemove: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 14,
  },
  photoPickerRow: { flexDirection: "row", gap: 12 },
  photoPickerBtn: {
    flex: 1,
    height: 80,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${Palette.primary}50`,
    backgroundColor: Palette.surfaceDark,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  photoPickerBtnText: {
    color: Palette.secondary,
    fontSize: 12,
    fontWeight: "500",
  },
  insightSection: { marginBottom: 22 },
  tagSection: { marginBottom: 28 },
  tagInput: {
    backgroundColor: Palette.surfaceDark,
    borderWidth: 1,
    borderColor: `${Palette.primary}40`,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Palette.accent,
    fontSize: 14,
  },
  insightInput: {
    backgroundColor: Palette.surfaceDark,
    borderWidth: 1,
    borderColor: `${Palette.primary}40`,
    borderRadius: 16,
    padding: 16,
    color: Palette.accent,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 100,
  },
  voiceSection: { marginBottom: 32 },
  micBtnWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: Palette.surfaceDark,
    borderWidth: 1,
    borderColor: `${Palette.primary}50`,
    position: "relative",
    overflow: "hidden",
  },
  micBtnWrapActive: {
    borderColor: "rgba(255,90,90,0.45)",
    backgroundColor: "rgba(30,5,5,0.9)",
  },
  micBtnLabel: {
    color: Palette.secondary,
    fontSize: 14,
    fontWeight: "600",
  },
  micBtnLabelActive: { color: "#ff5a5a" },
  micBtnSub: {
    color: `${Palette.secondary}55`,
    fontSize: 11,
    marginTop: 2,
  },
  micPulse: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "transparent",
  },
  micPulseActive: {
    backgroundColor: "rgba(255,90,90,0.07)",
  },
  recTimer: {
    color: "#ff5a5a",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  audioPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: `${Palette.highlight}10`,
    borderWidth: 1,
    borderColor: `${Palette.highlight}35`,
  },
  audioPillIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${Palette.highlight}20`,
    alignItems: "center",
    justifyContent: "center",
  },
  audioPillTitle: {
    color: Palette.accent,
    fontSize: 14,
    fontWeight: "600",
  },
  audioPillDuration: {
    color: `${Palette.secondary}80`,
    fontSize: 11,
    marginTop: 1,
  },
  audioPillDiscard: {
    padding: 6,
  },
  audioPillPlay: {
    padding: 2,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    borderRadius: 999,
    backgroundColor: "#fff",
    shadowColor: Palette.highlight,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: Palette.bgDark },
});
