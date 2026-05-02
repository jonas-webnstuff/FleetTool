export type LocationType = "person" | "vehicle";

export type Vehicle = {
  id: string;
  name: string;
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
