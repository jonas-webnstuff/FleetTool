import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/clerk-expo";
import { FleetItem, Member, Vehicle } from "@/types";
import { useSupabase } from "@/lib/supabase";

const ITEMS_KEY = "fleettool_items";
const RETURNED_KEY = "fleettool_returned";
const VEHICLES_KEY = "fleettool_vehicles";
const CATEGORIES_KEY = "fleettool_categories";
const CATEGORY_MODE_KEY = "fleettool_category_mode";
const VEHICLE_MODE_KEY = "fleettool_vehicle_mode";
const ITEM_MODE_KEY = "fleettool_item_mode";

const DEFAULT_CATEGORIES = ["Tools", "Safety", "Electronics", "Measuring", "Power", "Other"];

const DEFAULT_VEHICLES: Vehicle[] = [
  { id: "v1", name: "Truck 01" },
  { id: "v2", name: "Van 02" },
];

type CategoryRow = { id: string; name: string };
type MembershipRole = "owner" | "admin" | "manager" | "field_user";

type ItemsContextType = {
  items: FleetItem[];
  returnedItems: FleetItem[];
  vehicles: Vehicle[];
  categories: string[];
  members: Member[];
  categoryMode: "local" | "central";
  vehicleMode: "local" | "central";
  itemMode: "local" | "central";
  currentUserRole: MembershipRole | null;
  canManageLoadout: boolean;
  canAssignToPeople: boolean;
  canMoveBetweenVehiclesOnly: boolean;
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
  assignItemsToVehicle: (itemIds: string[], vehicleId: string) => void;
  addVehicle: (name: string) => void;
  updateVehicle: (id: string, name: string) => void;
  removeVehicle: (id: string) => void;
  addCategory: (name: string) => void;
  removeCategory: (name: string) => void;
  setCategoryMode: (mode: "local" | "central") => void;
  setVehicleMode: (mode: "local" | "central") => void;
  setItemMode: (mode: "local" | "central") => void;
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
  const supabase = useSupabase();
  const { userId } = useAuth();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const categoryRowsRef = useRef<CategoryRow[]>([]);

  const [items, setItems] = useState<FleetItem[]>([]);
  const [returnedItems, setReturnedItems] = useState<FleetItem[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>(DEFAULT_VEHICLES);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [members, setMembers] = useState<Member[]>([]);
  const [categoryMode, setCategoryModeState] = useState<"local" | "central">("local");
  const [vehicleMode, setVehicleModeState] = useState<"local" | "central">("local");
  const [itemMode, setItemModeState] = useState<"local" | "central">("local");
  const [currentUserRole, setCurrentUserRole] = useState<MembershipRole | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const isCentralFieldUser = itemMode === "central" && currentUserRole === "field_user";
  const canManageLoadout = !isCentralFieldUser;
  const canAssignToPeople = !isCentralFieldUser;
  const canMoveBetweenVehiclesOnly = isCentralFieldUser;

  // ─── Initial load from AsyncStorage ──────────────────────────────────────
  useEffect(() => {
    void (async () => {
      const [
        storedItems,
        storedReturned,
        storedVehicles,
        storedCategories,
        storedCategoryMode,
        storedVehicleMode,
        storedItemMode,
      ] = await Promise.all([
        AsyncStorage.getItem(ITEMS_KEY),
        AsyncStorage.getItem(RETURNED_KEY),
        AsyncStorage.getItem(VEHICLES_KEY),
        AsyncStorage.getItem(CATEGORIES_KEY),
        AsyncStorage.getItem(CATEGORY_MODE_KEY),
        AsyncStorage.getItem(VEHICLE_MODE_KEY),
        AsyncStorage.getItem(ITEM_MODE_KEY),
      ]);

      setItems(safeParseJson<FleetItem[]>(storedItems, []));
      setReturnedItems(safeParseJson<FleetItem[]>(storedReturned, []));
      setVehicles(safeParseJson<Vehicle[]>(storedVehicles, DEFAULT_VEHICLES));
      setCategories(safeParseJson<string[]>(storedCategories, DEFAULT_CATEGORIES));
      setCategoryModeState(storedCategoryMode === "central" ? "central" : "local");
      setVehicleModeState(storedVehicleMode === "central" ? "central" : "local");
      setItemModeState(storedItemMode === "central" ? "central" : "local");
      setIsLoaded(true);
    })();
  }, []);

  // ─── Persist mode flags ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded) return;
    void AsyncStorage.setItem(CATEGORY_MODE_KEY, categoryMode);
  }, [categoryMode, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    void AsyncStorage.setItem(VEHICLE_MODE_KEY, vehicleMode);
  }, [vehicleMode, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    void AsyncStorage.setItem(ITEM_MODE_KEY, itemMode);
  }, [itemMode, isLoaded]);

  // ─── Persist local-mode data ──────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || itemMode === "central") return;
    void AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(items));
  }, [items, isLoaded, itemMode]);

  useEffect(() => {
    if (!isLoaded) return;
    void AsyncStorage.setItem(RETURNED_KEY, JSON.stringify(returnedItems));
  }, [returnedItems, isLoaded]);

  useEffect(() => {
    if (!isLoaded || vehicleMode === "central") return;
    void AsyncStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles));
  }, [vehicles, isLoaded, vehicleMode]);

  useEffect(() => {
    if (!isLoaded || categoryMode === "central") return;
    void AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  }, [categories, isLoaded, categoryMode]);

  // ─── Fetch company UUID ───────────────────────────────────────────────────
  useEffect(() => {
    const needsCentral =
      categoryMode === "central" || vehicleMode === "central" || itemMode === "central";
    if (!needsCentral || companyId) return;
    void supabase.rpc("current_company_id").then(({ data, error }) => {
      if (!error && data) setCompanyId(data as string);
    });
  }, [categoryMode, vehicleMode, itemMode, companyId, supabase]);

  // ─── Fetch vehicles (central) ─────────────────────────────────────────────
  useEffect(() => {
    if (vehicleMode !== "central") return;
    void supabase
      .from("vehicles")
      .select("id, name")
      .eq("is_active", true)
      .order("name")
      .then(({ data, error }) => {
        if (!error && data)
          setVehicles(data.map((v) => ({ id: v.id as string, name: v.name as string })));
      });
  }, [vehicleMode, supabase]);

  // ─── Fetch categories (central) ───────────────────────────────────────────
  useEffect(() => {
    if (categoryMode !== "central") return;
    void supabase
      .from("categories")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data, error }) => {
        if (!error && data) {
          const rows = data as CategoryRow[];
          categoryRowsRef.current = rows;
          setCategories(rows.map((c) => c.name));
        }
      });
  }, [categoryMode, supabase]);

  // ─── Fetch members (central item mode) ───────────────────────────────────
  useEffect(() => {
    if (itemMode !== "central") return;
    void supabase
      .from("company_memberships")
      .select("id, full_name, email")
      .eq("status", "active")
      .order("full_name")
      .then(({ data, error }) => {
        if (!error && data)
          setMembers(
            data.map((m) => ({
              id: m.id as string,
              fullName: (m.full_name as string | null) ?? (m.email as string),
              email: m.email as string,
            }))
          );
      });
  }, [itemMode, supabase]);

  // ─── Resolve current membership role (central mode) ─────────────────────
  useEffect(() => {
    if (itemMode !== "central" || !companyId || !userId) {
      setCurrentUserRole(null);
      return;
    }

    void supabase
      .from("company_memberships")
      .select("role")
      .eq("company_id", companyId)
      .eq("clerk_user_id", userId)
      .eq("status", "active")
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data?.role) {
          setCurrentUserRole(data.role as MembershipRole);
        } else {
          setCurrentUserRole(null);
        }
      });
  }, [companyId, itemMode, supabase, userId]);

  // ─── Fetch items (central) ────────────────────────────────────────────────
  useEffect(() => {
    if (itemMode !== "central") return;
    void supabase
      .from("items")
      .select(
        "id, name, notes, image_url, created_at, assignment_type, status, " +
          "categories(name), vehicles(id), company_memberships(full_name, email)"
      )
      .neq("status", "retired")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setItems(
            data.map((row) => {
              const cat = row.categories as { name: string } | null;
              const veh = row.vehicles as { id: string } | null;
              const mem = row.company_memberships as {
                full_name: string | null;
                email: string;
              } | null;
              return {
                id: row.id as string,
                name: row.name as string,
                category: cat?.name ?? "",
                locationType:
                  (row.assignment_type as string) === "vehicle" ? "vehicle" : "person",
                assignedVehicle: veh?.id,
                assignedPerson: mem?.full_name ?? mem?.email,
                notes: (row.notes as string | null) ?? undefined,
                image: (row.image_url as string | null) ?? undefined,
                addedDate: ((row.created_at as string) ?? "").split("T")[0],
              } satisfies FleetItem;
            })
          );
        }
      });
  }, [itemMode, supabase]);

  // ─── Lookup helpers ───────────────────────────────────────────────────────
  function getCategoryId(name: string): string | null {
    return categoryRowsRef.current.find((r) => r.name === name)?.id ?? null;
  }

  function getMembershipId(personName: string | undefined): string | null {
    if (!personName) return null;
    return members.find((m) => m.fullName === personName || m.email === personName)?.id ?? null;
  }

  // ─── Items mutations ──────────────────────────────────────────────────────
  const addItem = (item: Omit<FleetItem, "id">) => {
    if (!canManageLoadout) {
      console.warn("addItem blocked by role policy");
      return;
    }

    if (itemMode === "central" && companyId) {
      const vehicleId =
        item.locationType === "vehicle" ? (item.assignedVehicle ?? null) : null;
      void supabase
        .from("items")
        .insert({
          company_id: companyId,
          name: item.name,
          category_id: getCategoryId(item.category),
          assignment_type: item.locationType,
          vehicle_id: vehicleId,
          assigned_membership_id: getMembershipId(item.assignedPerson),
          notes: item.notes ?? null,
          image_url: item.image ?? null,
          status: "assigned",
        })
        .select("id, created_at")
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            setItems((prev) => [
              {
                ...item,
                id: data.id as string,
                addedDate: ((data.created_at as string) ?? "").split("T")[0],
              },
              ...prev,
            ]);
          }
        });
    } else {
      setItems((prev) => [{ ...item, id: Date.now().toString() }, ...prev]);
    }
  };

  const updateItem = (id: string, updates: Partial<FleetItem>) => {
    if (!canManageLoadout) {
      console.warn("updateItem blocked by role policy");
      return;
    }

    if (itemMode === "central") {
      const patch: Record<string, unknown> = {};
      if (updates.name !== undefined) patch.name = updates.name;
      if (updates.notes !== undefined) patch.notes = updates.notes ?? null;
      if (updates.image !== undefined) patch.image_url = updates.image ?? null;
      if (updates.category !== undefined) patch.category_id = getCategoryId(updates.category);
      if (updates.locationType !== undefined) patch.assignment_type = updates.locationType;
      if (updates.assignedVehicle !== undefined)
        patch.vehicle_id = updates.assignedVehicle ?? null;
      if (updates.assignedPerson !== undefined)
        patch.assigned_membership_id = getMembershipId(updates.assignedPerson);

      void supabase
        .from("items")
        .update(patch)
        .eq("id", id)
        .then(({ error }) => {
          if (!error)
            setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
        });
    } else {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
    }
  };

  const deleteItem = (id: string) => {
    if (!canManageLoadout) {
      console.warn("deleteItem blocked by role policy");
      return;
    }

    if (itemMode === "central") {
      void supabase
        .from("items")
        .update({ status: "retired" })
        .eq("id", id)
        .then(({ error }) => {
          if (!error) {
            setItems((prev) => prev.filter((i) => i.id !== id));
            setReturnedItems((prev) => prev.filter((i) => i.id !== id));
          }
        });
    } else {
      setItems((prev) => prev.filter((i) => i.id !== id));
      setReturnedItems((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const returnItem = (id: string) => {
    if (!canManageLoadout) {
      console.warn("returnItem blocked by role policy");
      return;
    }

    if (itemMode === "central") {
      void supabase
        .from("items")
        .update({
          status: "available",
          assignment_type: "unassigned",
          vehicle_id: null,
          assigned_membership_id: null,
        })
        .eq("id", id)
        .then(({ error }) => {
          if (!error) {
            setItems((prev) => {
              const item = prev.find((i) => i.id === id);
              if (item) {
                setReturnedItems((r) => [
                  { ...item, returnedDate: new Date().toISOString().split("T")[0] },
                  ...r,
                ]);
              }
              return prev.filter((i) => i.id !== id);
            });
          }
        });
    } else {
      setItems((prev) => {
        const item = prev.find((i) => i.id === id);
        if (!item) return prev;
        setReturnedItems((r) => [
          { ...item, returnedDate: new Date().toISOString().split("T")[0] },
          ...r,
        ]);
        return prev.filter((i) => i.id !== id);
      });
    }
  };

  const moveItem = (
    id: string,
    locationType: FleetItem["locationType"],
    assignedPerson?: string,
    assignedVehicle?: string
  ) => {
    if (canMoveBetweenVehiclesOnly) {
      const currentItem = items.find((i) => i.id === id);
      const isAllowedVehicleSwap =
        Boolean(currentItem)
        && currentItem?.locationType === "vehicle"
        && locationType === "vehicle"
        && Boolean(assignedVehicle)
        && currentItem?.assignedVehicle !== assignedVehicle;

      if (!isAllowedVehicleSwap) {
        console.warn("moveItem blocked by role policy", {
          id,
          from: currentItem?.locationType,
          to: locationType,
        });
        return;
      }
    }

    if (itemMode === "central") {
      void supabase
        .from("items")
        .update({
          assignment_type: locationType,
          vehicle_id: locationType === "vehicle" ? (assignedVehicle ?? null) : null,
          assigned_membership_id:
            locationType === "person" ? getMembershipId(assignedPerson) : null,
          status: "assigned",
        })
        .eq("id", id)
        .then(({ error }) => {
          if (!error)
            setItems((prev) =>
              prev.map((i) =>
                i.id === id ? { ...i, locationType, assignedPerson, assignedVehicle } : i
              )
            );
        });
    } else {
      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, locationType, assignedPerson, assignedVehicle } : i
        )
      );
    }
  };

  const assignItemsToVehicle = (itemIds: string[], vehicleId: string) => {
    if (!canManageLoadout || itemIds.length === 0) {
      if (!canManageLoadout) {
        console.warn("assignItemsToVehicle blocked by role policy");
      }
      return;
    }

    if (itemMode === "central") {
      void supabase
        .from("items")
        .update({
          assignment_type: "vehicle",
          vehicle_id: vehicleId,
          assigned_membership_id: null,
          status: "assigned",
        })
        .in("id", itemIds)
        .then(({ error }) => {
          if (!error) {
            setItems((prev) =>
              prev.map((i) =>
                itemIds.includes(i.id)
                  ? { ...i, locationType: "vehicle", assignedVehicle: vehicleId, assignedPerson: undefined }
                  : i
              )
            );
          }
        });
    } else {
      setItems((prev) =>
        prev.map((i) =>
          itemIds.includes(i.id)
            ? { ...i, locationType: "vehicle", assignedVehicle: vehicleId, assignedPerson: undefined }
            : i
        )
      );
    }
  };

  // ─── Vehicles mutations ───────────────────────────────────────────────────
  const addVehicle = (name: string) => {
    if (vehicleMode === "central" && companyId) {
      void supabase
        .from("vehicles")
        .insert({ name, company_id: companyId })
        .select("id, name")
        .single()
        .then(({ data, error }) => {
          if (!error && data)
            setVehicles((prev) => [
              ...prev,
              { id: data.id as string, name: data.name as string },
            ]);
        });
    } else {
      setVehicles((prev) => [...prev, { id: Date.now().toString(), name }]);
    }
  };

  const updateVehicle = (id: string, name: string) => {
    if (vehicleMode === "central") {
      void supabase
        .from("vehicles")
        .update({ name })
        .eq("id", id)
        .then(({ error }) => {
          if (!error)
            setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, name } : v)));
        });
    } else {
      setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, name } : v)));
    }
  };

  const removeVehicle = (id: string) => {
    if (vehicleMode === "central") {
      void supabase
        .from("vehicles")
        .update({ is_active: false })
        .eq("id", id)
        .then(({ error }) => {
          if (!error) setVehicles((prev) => prev.filter((v) => v.id !== id));
        });
    } else {
      setVehicles((prev) => prev.filter((v) => v.id !== id));
    }
  };

  // ─── Category mutations ───────────────────────────────────────────────────
  const addCategory = (name: string) => {
    if (categoryMode === "central" && companyId) {
      void supabase
        .from("categories")
        .insert({ name, company_id: companyId })
        .select("id, name")
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            categoryRowsRef.current = [
              ...categoryRowsRef.current,
              { id: data.id as string, name: data.name as string },
            ];
            setCategories((prev) => [...prev, data.name as string]);
          }
        });
    } else {
      setCategories((prev) => [...prev, name]);
    }
  };

  const removeCategory = (name: string) => {
    if (categoryMode === "central") {
      void supabase
        .from("categories")
        .update({ is_active: false })
        .eq("name", name)
        .then(({ error }) => {
          if (!error) {
            categoryRowsRef.current = categoryRowsRef.current.filter((r) => r.name !== name);
            setCategories((prev) => prev.filter((c) => c !== name));
          }
        });
    } else {
      setCategories((prev) => prev.filter((c) => c !== name));
    }
  };

  // ─── Mode setters ─────────────────────────────────────────────────────────
  const setCategoryMode = (mode: "local" | "central") => setCategoryModeState(mode);
  const setVehicleMode = (mode: "local" | "central") => setVehicleModeState(mode);
  const setItemMode = (mode: "local" | "central") => setItemModeState(mode);

  return (
    <ItemsContext.Provider
      value={{
        items,
        returnedItems,
        vehicles,
        categories,
        members,
        categoryMode,
        vehicleMode,
        itemMode,
        currentUserRole,
        canManageLoadout,
        canAssignToPeople,
        canMoveBetweenVehiclesOnly,
        isLoaded,
        addItem,
        updateItem,
        deleteItem,
        returnItem,
        moveItem,
        assignItemsToVehicle,
        addVehicle,
        updateVehicle,
        removeVehicle,
        addCategory,
        removeCategory,
        setCategoryMode,
        setVehicleMode,
        setItemMode,
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
