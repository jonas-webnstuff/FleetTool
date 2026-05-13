import AsyncStorage from "@react-native-async-storage/async-storage";

type PendingClerkNameSync = {
  fullName: string;
  email: string;
};

const PENDING_CLERK_NAME_SYNC_KEY = "fleettool_pending_clerk_name_sync";

export async function setPendingClerkNameSync(value: PendingClerkNameSync) {
  await AsyncStorage.setItem(PENDING_CLERK_NAME_SYNC_KEY, JSON.stringify(value));
}

export async function getPendingClerkNameSync(): Promise<PendingClerkNameSync | null> {
  const raw = await AsyncStorage.getItem(PENDING_CLERK_NAME_SYNC_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PendingClerkNameSync>;
    if (typeof parsed.fullName === "string" && typeof parsed.email === "string") {
      return {
        fullName: parsed.fullName,
        email: parsed.email,
      };
    }
  } catch {
    // Ignore malformed storage and clear it below.
  }

  await AsyncStorage.removeItem(PENDING_CLERK_NAME_SYNC_KEY);
  return null;
}

export async function clearPendingClerkNameSync() {
  await AsyncStorage.removeItem(PENDING_CLERK_NAME_SYNC_KEY);
}