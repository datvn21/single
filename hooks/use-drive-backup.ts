import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

WebBrowser.maybeCompleteAuthSession();

const DRIVE_TOKEN_KEY = "single_google_drive_session";
const DRIVE_BACKUP_FILE = "single_backup_v1.json";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

interface GoogleDriveConfig {
  webClientId?: string;
  expoClientId?: string;
  iosClientId?: string;
  androidClientId?: string;
}

interface GoogleTokenSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

interface DriveBackupPayload {
  version: number;
  exportedAt: string;
  data: unknown;
}

interface RuntimeAuthConfig {
  clientId: string;
  redirectUri: string;
}

const GOOGLE_DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

// ── Config helpers ──────────────────────────────────────────────────────────

function getConfig(): GoogleDriveConfig {
  const fromExpo =
    (Constants.expoConfig?.extra?.googleDrive ?? {}) as GoogleDriveConfig;
  return {
    webClientId: fromExpo.webClientId,
    expoClientId: fromExpo.expoClientId,
    iosClientId: fromExpo.iosClientId,
    androidClientId: fromExpo.androidClientId,
  };
}

function getAppOwnership(): string {
  return String((Constants as { appOwnership?: string }).appOwnership ?? "");
}

function getRuntimeAuthConfig(): RuntimeAuthConfig | null {
  const cfg = getConfig();
  const appOwnership = getAppOwnership();

  if (Platform.OS === "web") {
    if (!cfg.webClientId) return null;
    return {
      clientId: cfg.webClientId,
      redirectUri: AuthSession.makeRedirectUri(),
    };
  }

  if (appOwnership === "expo") {
    const clientId = cfg.expoClientId ?? cfg.webClientId;
    if (!clientId) return null;
    return {
      clientId,
      redirectUri: AuthSession.makeRedirectUri({ path: "oauthredirect" }),
    };
  }

  if (Platform.OS === "ios" && cfg.iosClientId) {
    return {
      clientId: cfg.iosClientId,
      redirectUri: AuthSession.makeRedirectUri({ scheme: "single", path: "oauthredirect" }),
    };
  }

  if (Platform.OS === "android" && cfg.androidClientId) {
    return {
      clientId: cfg.androidClientId,
      redirectUri: AuthSession.makeRedirectUri({ scheme: "single", path: "oauthredirect" }),
    };
  }

  return null;
}

function getExpiresAt(expiresIn?: number | null): number {
  if (!expiresIn || !Number.isFinite(expiresIn)) {
    return Date.now() + 55 * 60 * 1000;
  }
  return Date.now() + Math.max(60, expiresIn - 30) * 1000;
}

// ── Session persistence ─────────────────────────────────────────────────────

async function persistSessionRaw(raw: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(DRIVE_TOKEN_KEY, raw);
    return;
  }
  await SecureStore.setItemAsync(DRIVE_TOKEN_KEY, raw);
}

async function readSessionRaw(): Promise<string | null> {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(DRIVE_TOKEN_KEY);
  }
  return SecureStore.getItemAsync(DRIVE_TOKEN_KEY);
}

async function clearSessionRaw(): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(DRIVE_TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(DRIVE_TOKEN_KEY);
}

async function saveSession(session: GoogleTokenSession): Promise<void> {
  await persistSessionRaw(JSON.stringify(session));
}

export async function loadDriveSession(): Promise<GoogleTokenSession | null> {
  try {
    const raw = await readSessionRaw();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GoogleTokenSession>;
    if (!parsed?.accessToken || !parsed?.expiresAt) return null;
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

// ── Token revocation + disconnect ───────────────────────────────────────────

async function revokeToken(accessToken: string): Promise<void> {
  try {
    await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`,
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );
  } catch {
    // Best-effort revocation — don't block disconnect on network failure
  }
}

export async function clearDriveSession(): Promise<void> {
  // Revoke the token at Google before clearing locally
  const session = await loadDriveSession();
  if (session?.accessToken) {
    await revokeToken(session.accessToken);
  }
  await clearSessionRaw();
}

export function isGoogleDriveConfigured(): boolean {
  return !!getRuntimeAuthConfig();
}

/** Checks if Drive is connected AND the token is still valid (or refreshable). */
export async function isDriveConnected(): Promise<boolean> {
  const session = await loadDriveSession();
  if (!session?.accessToken) return false;

  // Token not expired yet → connected
  if (Date.now() < session.expiresAt) return true;

  // Token expired → try silent refresh
  if (session.refreshToken) {
    try {
      await refreshSession(session);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

// ── Token refresh with lock ─────────────────────────────────────────────────
// Prevents concurrent callers from racing to refresh the same token.

let _refreshLock: Promise<GoogleTokenSession> | null = null;

async function refreshSession(
  session: GoogleTokenSession,
): Promise<GoogleTokenSession> {
  // If a refresh is already in flight, wait for it
  if (_refreshLock) return _refreshLock;

  _refreshLock = (async () => {
    const runtime = getRuntimeAuthConfig();
    if (!runtime || !session.refreshToken) {
      throw new Error("Phiên Google Drive đã hết hạn. Vui lòng kết nối lại.");
    }

    const refreshed = await AuthSession.refreshAsync(
      {
        clientId: runtime.clientId,
        refreshToken: session.refreshToken,
      },
      GOOGLE_DISCOVERY,
    );

    const next: GoogleTokenSession = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? session.refreshToken,
      expiresAt: getExpiresAt(refreshed.expiresIn),
    };
    await saveSession(next);
    return next;
  })();

  try {
    return await _refreshLock;
  } finally {
    _refreshLock = null;
  }
}

async function ensureValidSession(): Promise<GoogleTokenSession> {
  const session = await loadDriveSession();
  if (!session) {
    throw new Error("Google Drive chưa được kết nối.");
  }

  if (Date.now() < session.expiresAt) return session;
  return refreshSession(session);
}

// ── OAuth connect flow ──────────────────────────────────────────────────────

export async function connectGoogleDrive(): Promise<void> {
  const runtime = getRuntimeAuthConfig();
  if (!runtime) {
    throw new Error(
      "Thiếu Google OAuth client ID trong app.json > expo.extra.googleDrive.",
    );
  }

  const request = new AuthSession.AuthRequest({
    clientId: runtime.clientId,
    responseType: AuthSession.ResponseType.Code,
    scopes: [DRIVE_SCOPE],
    usePKCE: true,
    redirectUri: runtime.redirectUri,
    extraParams: {
      access_type: "offline",
      prompt: "consent",
    },
  });

  const result = await request.promptAsync(GOOGLE_DISCOVERY);
  if (result.type !== "success") {
    throw new Error("Đăng nhập Google đã bị huỷ.");
  }

  const code = result.params.code;
  if (!code || !request.codeVerifier) {
    throw new Error("Không nhận được mã uỷ quyền Google.");
  }

  const token = await AuthSession.exchangeCodeAsync(
    {
      clientId: runtime.clientId,
      code,
      redirectUri: runtime.redirectUri,
      extraParams: {
        code_verifier: request.codeVerifier,
      },
    },
    GOOGLE_DISCOVERY,
  );

  const next: GoogleTokenSession = {
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt: getExpiresAt(token.expiresIn),
  };
  await saveSession(next);
}

// ── Authorized fetch with 401 retry ─────────────────────────────────────────

async function authorizedFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const session = await ensureValidSession();
  const doFetch = (token: string) =>
    fetch(input, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });

  const res = await doFetch(session.accessToken);

  // On 401, force-refresh the token and retry once
  if (res.status === 401 && session.refreshToken) {
    const refreshed = await refreshSession(session);
    return doFetch(refreshed.accessToken);
  }

  return res;
}

// ── Drive file operations ───────────────────────────────────────────────────

async function findBackupFileId(): Promise<string | null> {
  const q = encodeURIComponent(`name='${DRIVE_BACKUP_FILE}' and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=appDataFolder&fields=files(id,name)&pageSize=1`;
  const res = await authorizedFetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tìm file backup thất bại: ${text}`);
  }
  const json = (await res.json()) as { files?: { id: string }[] };
  return json.files?.[0]?.id ?? null;
}

function buildMultipartBody(
  metadata: Record<string, unknown>,
  content: string,
  boundary: string,
): string {
  return [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    content,
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

export async function uploadBackupToDrive(data: unknown): Promise<void> {
  const payload: DriveBackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
  const content = JSON.stringify(payload, null, 2);

  const existingId = await findBackupFileId();
  const boundary = `single-boundary-${Date.now()}`;
  const metadata = existingId
    ? { name: DRIVE_BACKUP_FILE }
    : { name: DRIVE_BACKUP_FILE, parents: ["appDataFolder"] };

  const url = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

  const res = await authorizedFetch(url, {
    method: existingId ? "PATCH" : "POST",
    headers: {
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: buildMultipartBody(metadata, content, boundary),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload backup thất bại: ${text}`);
  }
}

export async function downloadBackupFromDrive(): Promise<DriveBackupPayload> {
  const fileId = await findBackupFileId();
  if (!fileId) {
    throw new Error("Không tìm thấy file backup trên Google Drive.");
  }

  const res = await authorizedFetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Download backup thất bại: ${text}`);
  }

  const parsed = (await res.json()) as Partial<DriveBackupPayload>;
  if (!parsed || typeof parsed !== "object" || !parsed.data) {
    throw new Error("File backup trên Drive không hợp lệ.");
  }

  return {
    version: Number(parsed.version ?? 1),
    exportedAt: String(parsed.exportedAt ?? ""),
    data: parsed.data,
  };
}

/** Extract a user-friendly message from any caught error. */
export function driveErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
