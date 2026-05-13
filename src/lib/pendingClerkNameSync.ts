type PendingClerkNameSync = {
  fullName: string;
  email: string;
};

let pendingClerkNameSync: PendingClerkNameSync | null = null;

export function setPendingClerkNameSync(value: PendingClerkNameSync) {
  pendingClerkNameSync = value;
}

export function getPendingClerkNameSync() {
  return pendingClerkNameSync;
}

export function clearPendingClerkNameSync() {
  pendingClerkNameSync = null;
}