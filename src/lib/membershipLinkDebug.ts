import * as SecureStore from "expo-secure-store";

const MEMBERSHIP_LINK_DEBUG_KEY = "fleettool_membership_link_debug";
const ENABLE_MEMBERSHIP_LINK_DEBUG = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_MEMBERSHIP_DEBUG === "1";

export async function setMembershipLinkDebug(message: string) {
  if (!ENABLE_MEMBERSHIP_LINK_DEBUG) {
    await SecureStore.deleteItemAsync(MEMBERSHIP_LINK_DEBUG_KEY);
    return;
  }

  await SecureStore.setItemAsync(MEMBERSHIP_LINK_DEBUG_KEY, message);
}

export async function getMembershipLinkDebug(): Promise<string | null> {
  if (!ENABLE_MEMBERSHIP_LINK_DEBUG) {
    await SecureStore.deleteItemAsync(MEMBERSHIP_LINK_DEBUG_KEY);
    return null;
  }

  return SecureStore.getItemAsync(MEMBERSHIP_LINK_DEBUG_KEY);
}

export async function clearMembershipLinkDebug() {
  await SecureStore.deleteItemAsync(MEMBERSHIP_LINK_DEBUG_KEY);
}