export type LocationType = "person" | "vehicle";

export type Vehicle = {
  id: string;
  name: string;
};

export type Member = {
  id: string;       // clerk_user_id / membership UUID in Supabase
  fullName: string;
  email: string;
};

export type FleetItem = {
  id: string;
  name: string;
  category: string;
  locationType: LocationType;
  assignedPerson?: string;
  assignedVehicle?: string; // vehicle id
  notes?: string;
  image?: string;
  addedDate: string;
  returnedDate?: string;
};
