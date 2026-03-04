# Single

A personal journaling app built for people who embrace solo life. **Single** helps you check in with yourself daily — log your mood, write an insight, attach a photo or voice note, and reflect on how far you've come.

Built with [Expo](https://expo.dev) and [React Native](https://reactnative.dev), running on iOS, Android, and web.

---

## Features

### Daily Check-in

Log how you're feeling each day with:

- **Mood** — choose from default moods (Peaceful, Energetic, Quiet, Reflective, Grateful, Lonely) or create your own
- **Insight** — a free-text note or reflection
- **Photo** — attach an image from your library or camera
- **Voice note** — record and preview audio before saving

### Home Dashboard

A customisable widget screen showing:
| Widget | Description |
|---|---|
| Daily Reflection | Rotating motivational quote |
| Memory Cards | Swipeable deck of recent check-ins |
| Weekly Recap | 7-day streak dots |
| Streak & Media | Current streak + photo/audio counts |
| Mood Breakdown | Bar chart of mood history |
| Random Memory | Resurface a past check-in |

### Journal / Explore

Browse all past check-ins grouped by day. Filter by **All**, **Audio**, **Note**, **Photo**, or **Today**. Tap any card to view the full entry with photo and audio playback.

### Settings

- Set your journey start date
- Add or remove custom moods
- Toggle individual home widgets on/off
- Reset all data

---

## Tech Stack

| Layer       | Library                                  |
| ----------- | ---------------------------------------- |
| Framework   | Expo ~54 / React Native 0.81             |
| Navigation  | Expo Router ~6 (file-based)              |
| State       | Zustand ^5                               |
| Persistence | AsyncStorage 2.2                         |
| Audio       | expo-audio ~1.1                          |
| Images      | expo-image-picker ~17, expo-image ~3     |
| Animations  | react-native-reanimated ~4, Animated API |
| Icons       | @expo/vector-icons (Ionicons)            |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/) — `npm install -g expo-cli`
- iOS Simulator (macOS) or Android Emulator, or the **Expo Go** app on a physical device

### Install & run

```bash
# Install dependencies
npm install

# Start the dev server
npx expo start
```

In the terminal output you'll see a QR code and options to open on:

- **iOS simulator** — press `i`
- **Android emulator** — press `a`
- **Web browser** — press `w`
- **Physical device** — scan the QR code with Expo Go

### Platform-specific builds

```bash
npm run android   # Android emulator
npm run ios       # iOS simulator
npm run web       # Browser
```

---

## Project Structure

```
app/
  _layout.tsx          # Root layout & navigation setup
  modal.tsx            # Check-in form (mood, note, photo, audio)
  settings.tsx         # Settings screen
  (tabs)/
    _layout.tsx        # Bottom tab bar
    index.tsx          # Home dashboard with widgets
    explore.tsx        # Journal / browse past check-ins
components/            # Shared UI components
constants/
  theme.ts             # Colour palette
hooks/
  use-app-data.ts      # Zustand store + AsyncStorage persistence
assets/
  images/              # App icons and splash images
```

---

## Scripts

| Command                 | Description                        |
| ----------------------- | ---------------------------------- |
| `npm start`             | Start Expo dev server              |
| `npm run android`       | Run on Android emulator            |
| `npm run ios`           | Run on iOS simulator               |
| `npm run web`           | Run in browser                     |
| `npm run lint`          | Lint with ESLint                   |
| `npm run reset-project` | Clear starter code and start fresh |

---

## Changelog

### 2026-03-04

#### Fix — Timezone: ngày đổi đúng lúc 0h thay vì 7h sáng

- Thêm helper `localDateStr()` sử dụng giờ địa phương (`getFullYear/Month/Date`) thay vì UTC (`toISOString`)
- Thay thế toàn bộ 11 chỗ dùng `.toISOString().slice(0, 10)` trong `hooks/use-app-data.ts`, `components/home-widgets.tsx`, `app/settings.tsx`, `app/modal.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/explore.tsx`

#### Feature — Daily notification (nhắc check-in hàng ngày)

- Thêm `hooks/use-notifications.ts`: quản lý xin quyền, lên lịch / hủy notification lặp lại hàng ngày, lưu settings vào AsyncStorage
- `app.json`: thêm plugin `expo-notifications`
- `app/_layout.tsx`: gọi `initNotifications()` khi app khởi động để tự khôi phục lịch
- `app/settings.tsx`: thêm card **Daily reminder** — toggle bật/tắt + bộ chọn giờ:phút (phút nhảy 5)
- Cập nhật `app/(tabs)/index.tsx` và `app/(tabs)/explore.tsx` để dùng `localDateStr`

#### UX — Nút lưu ảnh thay nút X trong detail view (Explore)

- Bỏ nút X (close) ở góc trên phải detail card
- Bỏ cơ chế long-press + save overlay
- Thêm nút download nhỏ trực tiếp góc trên phải của ảnh — nhấn 1 lần lưu ngay vào thư viện
- Đóng detail vẫn bằng cách tap ra ngoài

#### Feature — Streak count-up animation

- `components/home-widgets.tsx`: thêm hook `useCountUp()`, số current / best đếm từng nhịp khi render; flame icon pulse khi streak thay đổi
- `app/(tabs)/index.tsx`: streak badge trên header compact và dưới số ngày đều đếm lên từng nhịp; flame emoji pulse via `Animated.Text`

---

## License

MIT
