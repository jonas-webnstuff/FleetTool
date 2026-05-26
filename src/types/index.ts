export type LocationType = "person" | "vehicle";

export type Vehicle = {
  id: string;
  name: string;
};

export type Member = {
  id: string;       // clerk_user_id / membership UUID in Supabase
  fullName: string;
  email: string;
  clerkUserId?: string;
};

export type FleetItem = {
  id: string;
  name: string;
  category: string;
  locationType: LocationType;
  assignedPerson?: string;
  assignedMembershipId?: string;
  assignedVehicle?: string; // vehicle id
  notes?: string;
  image?: string;
  addedDate: string;
  returnedDate?: string;
};

export type ActivityAction =
  | "item_added"
  | "item_updated"
  | "item_deleted"
  | "item_returned"
  | "item_moved"
  | "items_assigned_vehicle"
  | "vehicle_added"
  | "vehicle_updated"
  | "vehicle_removed"
  | "category_added"
  | "category_removed"
  | "mode_changed";

export type ActivityEvent = {
  id: string;
  action: ActivityAction;
  createdAt: string;
  actorName?: string;
  itemName?: string;
  vehicleName?: string;
  fromName?: string;
  toName?: string;
  count?: number;
  modeTarget?: "items" | "vehicles" | "categories";
  modeValue?: "local" | "central";
};
