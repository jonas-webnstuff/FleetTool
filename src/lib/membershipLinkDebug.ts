import AsyncStorage from "@react-native-async-storage/async-storage";

const MEMBERSHIP_LINK_DEBUG_KEY = "fleettool_membership_link_debug";

export async function setMembershipLinkDebug(message: string) {
  await AsyncStorage.setItem(MEMBERSHIP_LINK_DEBUG_KEY, message);
}

export async function getMembershipLinkDebug(): Promise<string | null> {
  return AsyncStorage.getItem(MEMBERSHIP_LINK_DEBUG_KEY);
}

export async function clearMembershipLinkDebug() {
  await AsyncStorage.removeItem(MEMBERSHIP_LINK_DEBUG_KEY);
}