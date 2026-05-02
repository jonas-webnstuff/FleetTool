import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FleetItem, Vehicle } from "@/types";

const ITEMS_KEY = "fleettool_items";
const RETURNED_KEY = "fleettool_returned";
const VEHICLES_KEY = "fleettool_vehicles";
const CATEGORIES_KEY = "fleettool_categories";
const CATEGORY_MODE_KEY = "fleettool_category_mode";
const VEHICLE_MODE_KEY = "fleettool_vehicle_mode";

const DEFAULT_CATEGORIES = ["Tools", "Safety", "Electronics", "Measuring", "Power", "Other"];

const DEFAULT_VEHICLES: Vehicle[] = [
  { id: "v1", name: "Truck 01" },
  { id: "v2", name: "Van 02" },
];

type ItemsContextType = {
  items: FleetItem[];
  returnedItems: FleetItem[];
  vehicles: Vehicle[];
  categories: string[];
  categoryMode: "local" | "central";
  vehicleMode: "local" | "central";
  isLoaded: boolean;
  addItem: (item: Omit<FleetItem, "id">) => void;
  updateItem: (id: string, updates: Partial<FleetItem>) => void;
  deleteItem: (id: string) => void;
  returnItem: (id: string) => void;
  moveItem: (
    id: string,
    locationType: FleetItem["locationType"],
    assignedPerson?: string,
    assignedVehicle?: string
  ) => void;
  addVehicle: (name: string) => void;
  updateVehicle: (id: string, name: string) => void;
  removeVehicle: (id: string) => void;
  addCategory: (name: string) => void;
  removeCategory: (name: string) => void;
  setCategoryMode: (mode: "local" | "central") => void;
  setVehicleMode: (mode: "local" | "central") => void;
};

function safeParseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const ItemsContext = createContext<ItemsContextType | null>(null);

export function ItemsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FleetItem[]>([]);
  const [returnedItems, setReturnedItems] = useState<FleetItem[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>(DEFAULT_VEHICLES);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [categoryMode, setCategoryModeState] = useState<"local" | "central">("local");
  const [vehicleMode, setVehicleModeState] = useState<"local" | "central">("local");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [storedItems, storedReturned, storedVehicles, storedCategories, storedCategoryMode, storedVehicleMode] = await Promise.all([
        AsyncStorage.getItem(ITEMS_KEY),
        AsyncStorage.getItem(RETURNED_KEY),
        AsyncStorage.getItem(VEHICLES_KEY),
        AsyncStorage.getItem(CATEGORIES_KEY),
        AsyncStorage.getItem(CATEGORY_MODE_KEY),
        AsyncStorage.getItem(VEHICLE_MODE_KEY),
      ]);

      setItems(safeParseJson<FleetItem[]>(storedItems, []));
      setReturnedItems(safeParseJson<FleetItem[]>(storedReturned, []));
      setVehicles(safeParseJson<Vehicle[]>(storedVehicles, DEFAULT_VEHICLES));
      setCategories(safeParseJson<string[]>(storedCategories, DEFAULT_CATEGORIES));
      setCategoryModeState(storedCategoryMode === "central" ? "central" : "local");
      setVehicleModeState(storedVehicleMode === "central" ? "central" : "local");
      setIsLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    void AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(items));
  }, [items, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    void AsyncStorage.setItem(RETURNED_KEY, JSON.stringify(returnedItems));
  }, [returnedItems, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    void AsyncStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles));
  }, [vehicles, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    void AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  }, [categories, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    void AsyncStorage.setItem(CATEGORY_MODE_KEY, categoryMode);
  }, [categoryMode, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    void AsyncStorage.setItem(VEHICLE_MODE_KEY, vehicleMode);
  }, [vehicleMode, isLoaded]);

  const addItem = (item: Omit<FleetItem, "id">) => {
    const newItem: FleetItem = { ...item, id: Date.now().toString() };
    setItems((prev) => [newItem, ...prev]);
  };

  const updateItem = (id: string, updates: Partial<FleetItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
  };

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setReturnedItems((prev) => prev.filter((i) => i.id !== id));
  };

  const returnItem = (id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (!item) return prev;
      setReturnedItems((r) => [{ ...item, returnedDate: new Date().toISOString().split("T")[0] }, ...r]);
      return prev.filter((i) => i.id !== id);
    });
  };

  const moveItem = (
    id: string,
    locationType: FleetItem["locationType"],
    assignedPerson?: string,
    assignedVehicle?: string
  ) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, locationType, assignedPerson, assignedVehicle } : i
      )
    );
  };

  const addVehicle = (name: string) => {
    const newVehicle: Vehicle = { id: Date.now().toString(), name };
    setVehicles((prev) => [...prev, newVehicle]);
  };

  const updateVehicle = (id: string, name: string) => {
    setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, name } : v)));
  };

  const removeVehicle = (id: string) => {
    setVehicles((prev) => prev.filter((v) => v.id !== id));
  };

  const addCategory = (name: string) => {
    setCategories((prev) => [...prev, name]);
  };

  const removeCategory = (name: string) => {
    setCategories((prev) => prev.filter((c) => c !== name));
  };

  const setCategoryMode = (mode: "local" | "central") => {
    setCategoryModeState(mode);
  };

  const setVehicleMode = (mode: "local" | "central") => {
    setVehicleModeState(mode);
  };

  return (
    <ItemsContext.Provider
      value={{
        items,
        returnedItems,
        vehicles,
        categories,
        categoryMode,
        vehicleMode,
        isLoaded,
        addItem,
        updateItem,
        deleteItem,
        returnItem,
        moveItem,
        addVehicle,
        updateVehicle,
        removeVehicle,
        addCategory,
        removeCategory,
        setCategoryMode,
        setVehicleMode,
      }}
    >
      {children}
    </ItemsContext.Provider>
  );
}

export function useItems() {
  const ctx = useContext(ItemsContext);
  if (!ctx) throw new Error("useItems must be used within ItemsProvider");
  return ctx;
}
