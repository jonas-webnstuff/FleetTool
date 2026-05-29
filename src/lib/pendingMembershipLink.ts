import * as SecureStore from "expo-secure-store";

type PendingMembershipLink = {
  email: string;
};

const PENDING_MEMBERSHIP_LINK_KEY = "fleettool_pending_membership_link";

export async function setPendingMembershipLink(value: PendingMembershipLink) {
  await SecureStore.setItemAsync(PENDING_MEMBERSHIP_LINK_KEY, JSON.stringify(value));
}

export async function getPendingMembershipLink(): Promise<PendingMembershipLink | null> {
  const raw = await SecureStore.getItemAsync(PENDING_MEMBERSHIP_LINK_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PendingMembershipLink>;
    if (typeof parsed.email === "string" && parsed.email.trim()) {
      return { email: parsed.email.trim().toLowerCase() };
    }
  } catch {
    // Ignore malformed storage and clear it below.
  }

  await SecureStore.deleteItemAsync(PENDING_MEMBERSHIP_LINK_KEY);
  return null;
}

export async function clearPendingMembershipLink() {
  await SecureStore.deleteItemAsync(PENDING_MEMBERSHIP_LINK_KEY);
}