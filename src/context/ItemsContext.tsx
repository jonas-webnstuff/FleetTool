import { createContext, useContext, useState, useEffect, useRef, ReactNode, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { Alert } from "react-native";
import { ActivityEvent, FleetItem, Member, Vehicle } from "@/types";
import { useSupabase } from "@/lib/supabase";
import { clearPendingMembershipLink, getPendingMembershipLink } from "@/lib/pendingMembershipLink";

const ITEMS_KEY = "fleettool_items";
const RETURNED_KEY = "fleettool_returned";
const VEHICLES_KEY = "fleettool_vehicles";
const CATEGORIES_KEY = "fleettool_categories";
const CATEGORY_MODE_KEY = "fleettool_category_mode";
const VEHICLE_MODE_KEY = "fleettool_vehicle_mode";
const ITEM_MODE_KEY = "fleettool_item_mode";
const ACTIVITY_LOG_KEY = "fleettool_activity_log";

const DEFAULT_CATEGORIES = ["Tools", "Safety", "Electronics", "Measuring", "Power", "Other"];

const DEFAULT_VEHICLES: Vehicle[] = [
  { id: "v1", name: "Truck 01" },
  { id: "v2", name: "Van 02" },
];

type CategoryRow = { id: string; name: string };
type MembershipRole = "owner" | "admin" | "manager" | "field_user";
type CompanyPeopleRpcRow = {
  membership_id: string;
  full_name: string | null;
  email: string | null;
  item_count: number | null;
};
type MembershipRpcRow = {
  id: string;
  status: string;
  clerk_user_id: string | null;
  email: string | null;
  full_name: string | null;
  company_id: string | null;
  role?: MembershipRole | null;
};
type CompanyItemsRpcRow = {
  id: string;
  name: string | null;
  notes: string | null;
  image_url: string | null;
  created_at: string | null;
  assignment_type: string | null;
  status: string | null;
  vehicle_id: string | null;
  assigned_membership_id: string | null;
  category_name: string | null;
  assigned_full_name: string | null;
  assigned_email: string | null;
};

type ItemsContextType = {
  items: FleetItem[];
  returnedItems: FleetItem[];
  vehicles: Vehicle[];
  activityLog: ActivityEvent[];
  categories: string[];
  members: Member[];
  categoryMode: "local" | "central";
  vehicleMode: "local" | "central";
  itemMode: "local" | "central";
  currentUserRole: MembershipRole | null;
  defaultItemLocationType: "person" | "vehicle";
  currentMemberId: string;
  currentMemberName: string;
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
    assignedVehicle?: string,
    assignedMembershipId?: string
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
  refreshItems: () => void;
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
  const { userId, isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const categoryRowsRef = useRef<CategoryRow[]>([]);
  const membersRef = useRef<Member[]>([]);

  const [items, setItems] = useState<FleetItem[]>([]);
  const [returnedItems, setReturnedItems] = useState<FleetItem[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>(DEFAULT_VEHICLES);
  const [activityLog, setActivityLog] = useState<ActivityEvent[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [members, setMembers] = useState<Member[]>([]);
  const [categoryMode, setCategoryModeState] = useState<"local" | "central">("local");
  const [vehicleMode, setVehicleModeState] = useState<"local" | "central">("local");
  const [itemMode, setItemModeState] = useState<"local" | "central">("local");
  const [currentUserRole, setCurrentUserRole] = useState<MembershipRole | null>(null);
  const [currentMembership, setCurrentMembership] = useState<MembershipRpcRow | null>(null);
  const [defaultItemLocationType, setDefaultItemLocationType] = useState<"person" | "vehicle">("person");
  const [itemsReloadTick, setItemsReloadTick] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const itemsRef = useRef<FleetItem[]>([]);
  const vehiclesRef = useRef<Vehicle[]>([]);
  const lastItemsCompanyIdRef = useRef<string | null>(null);
  const lastVehiclesCompanyIdRef = useRef<string | null>(null);
  const emptyItemsStreakRef = useRef(0);
  const emptyVehiclesStreakRef = useRef(0);

  const hasLinkedCompany = Boolean(companyId);
  const effectiveCategoryMode: "local" | "central" = hasLinkedCompany ? "central" : categoryMode;
  const effectiveVehicleMode: "local" | "central" = hasLinkedCompany ? "central" : vehicleMode;
  const effectiveItemMode: "local" | "central" = hasLinkedCompany ? "central" : itemMode;

  const isCentralFieldUser = effectiveItemMode === "central" && currentUserRole === "field_user";
  const canManageLoadout = !isCentralFieldUser;
  const canAssignToPeople = !isCentralFieldUser;
  const canMoveBetweenVehiclesOnly = isCentralFieldUser && defaultItemLocationType === "vehicle";
  const currentMemberId = useMemo(() => {
    if (effectiveItemMode !== "central" || !userId) {
      return "";
    }

    return currentMembership?.id ?? members.find((member) => member.clerkUserId === userId)?.id ?? "";
  }, [currentMembership?.id, effectiveItemMode, members, userId]);

  const currentMemberName = useMemo(() => {
    const fallbackFullName = [user?.firstName, user?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    const fallback =
      user?.fullName?.trim()
      || fallbackFullName
      || user?.primaryEmailAddress?.emailAddress
      || user?.emailAddresses?.[0]?.emailAddress
      || userId
      || "";

    if (effectiveItemMode !== "central" || !userId) {
      return fallback;
    }

    if (currentMembership?.full_name?.trim()) {
      return currentMembership.full_name.trim();
    }

    if (currentMembership?.email?.trim()) {
      return currentMembership.email.trim();
    }

    const currentMembership = members.find((member) => member.id === currentMemberId);

    if (currentMembership?.fullName?.trim()) {
      return currentMembership.fullName.trim();
    }

    if (currentMembership?.email?.trim()) {
      return currentMembership.email.trim();
    }

    return fallback;
  }, [currentMemberId, currentMembership, effectiveItemMode, members, user, userId]);

  // ─── Initial load from AsyncStorage ──────────────────────────────────────
  useEffect(() => {
    void (async () => {
      const [
        storedItems,
        storedReturned,
        storedVehicles,
        storedActivity,
        storedCategories,
        storedCategoryMode,
        storedVehicleMode,
        storedItemMode,
      ] = await Promise.all([
        AsyncStorage.getItem(ITEMS_KEY),
        AsyncStorage.getItem(RETURNED_KEY),
        AsyncStorage.getItem(VEHICLES_KEY),
        AsyncStorage.getItem(ACTIVITY_LOG_KEY),
        AsyncStorage.getItem(CATEGORIES_KEY),
        AsyncStorage.getItem(CATEGORY_MODE_KEY),
        AsyncStorage.getItem(VEHICLE_MODE_KEY),
        AsyncStorage.getItem(ITEM_MODE_KEY),
      ]);

      setItems(safeParseJson<FleetItem[]>(storedItems, []));
      setReturnedItems(safeParseJson<FleetItem[]>(storedReturned, []));
      setVehicles(safeParseJson<Vehicle[]>(storedVehicles, DEFAULT_VEHICLES));
      setActivityLog(safeParseJson<ActivityEvent[]>(storedActivity, []));
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
    if (!isLoaded || effectiveItemMode === "central") return;
    void AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(items));
  }, [effectiveItemMode, items, isLoaded]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (!isLoaded) return;
    void AsyncStorage.setItem(RETURNED_KEY, JSON.stringify(returnedItems));
  }, [returnedItems, isLoaded]);

  useEffect(() => {
    if (!isLoaded || effectiveVehicleMode === "central") return;
    void AsyncStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles));
  }, [effectiveVehicleMode, vehicles, isLoaded]);

  useEffect(() => {
    vehiclesRef.current = vehicles;
  }, [vehicles]);

  useEffect(() => {
    if (!isLoaded || effectiveCategoryMode === "central") return;
    void AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  }, [categories, effectiveCategoryMode, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    void AsyncStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(activityLog));
  }, [activityLog, isLoaded]);

  function appendActivity(event: Omit<ActivityEvent, "id" | "createdAt">) {
    const fallbackFullName = [user?.firstName, user?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    const actorName =
      user?.fullName?.trim()
      || fallbackFullName
      || user?.primaryEmailAddress?.emailAddress
      || user?.emailAddresses?.[0]?.emailAddress
      || userId
      || undefined;

    const next: ActivityEvent = {
      ...event,
      actorName: event.actorName ?? actorName,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: new Date().toISOString(),
    };

    setActivityLog((prev) => [next, ...prev].slice(0, 400));
  }

  // ─── Fetch company UUID ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    // Avoid clearing company while auth is still hydrating to prevent UI flicker.
    if (!isAuthLoaded || !isUserLoaded) {
      return;
    }

    if (!isSignedIn || !userId) {
      setCompanyId(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const primaryEmail = user?.primaryEmailAddress?.emailAddress
          ?? user?.emailAddresses?.[0]?.emailAddress
          ?? null;
        const pending = await getPendingMembershipLink();
        const rawFullName = user?.fullName ?? `${user?.firstName ?? ""} ${user?.lastName ?? ""}`;
        const trimmedFullName = rawFullName.trim();

        // Run the full auto-link flow so central mode is usable immediately after sign-in.
        await supabase.rpc("sync_current_membership");
        await supabase.rpc("claim_current_membership", {
          p_clerk_user_id: userId,
          p_email: primaryEmail,
          p_pending_email: pending?.email ?? null,
          p_full_name: trimmedFullName || null,
        });
        await supabase.rpc("sync_current_membership");

        const { data, error } = await supabase.rpc("current_company_id");
        if (cancelled) return;

        if (!error && data) {
          setCompanyId(String(data));
          if (pending) {
            await clearPendingMembershipLink();
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("company sync effect failed", error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isAuthLoaded,
    isLoaded,
    isSignedIn,
    isUserLoaded,
    supabase,
    user,
    userId,
  ]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (companyId) {
      if (categoryMode !== "central") {
        setCategoryModeState("central");
      }
      if (vehicleMode !== "central") {
        setVehicleModeState("central");
      }
      if (itemMode !== "central") {
        setItemModeState("central");
      }
      return;
    }

    if (!isSignedIn) {
      if (categoryMode !== "local") {
        setCategoryModeState("local");
      }
      if (vehicleMode !== "local") {
        setVehicleModeState("local");
      }
      if (itemMode !== "local") {
        setItemModeState("local");
      }
    }
  }, [categoryMode, companyId, isLoaded, isSignedIn, itemMode, vehicleMode]);

  // ─── Fetch vehicles (central) ─────────────────────────────────────────────
  useEffect(() => {
    if (effectiveVehicleMode !== "central" || !companyId) return;
    let cancelled = false;

    void supabase
      .from("vehicles")
      .select("id, name")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("name")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          const mapped = data.map((v) => ({ id: v.id as string, name: v.name as string }));
          const sameCompany = lastVehiclesCompanyIdRef.current === companyId;

          if (mapped.length === 0 && sameCompany && vehiclesRef.current.length > 0) {
            emptyVehiclesStreakRef.current += 1;
            if (emptyVehiclesStreakRef.current < 2) {
              return;
            }
          } else {
            emptyVehiclesStreakRef.current = 0;
          }

          lastVehiclesCompanyIdRef.current = companyId;
          setVehicles(mapped);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, effectiveVehicleMode, supabase]);

  // ─── Fetch categories (central) ───────────────────────────────────────────
  useEffect(() => {
    if (effectiveCategoryMode !== "central" || !companyId) return;
    let cancelled = false;

    void supabase
      .from("categories")
      .select("id, name")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          const rows = data as CategoryRow[];
          categoryRowsRef.current = rows;
          setCategories(rows.map((c) => c.name));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, effectiveCategoryMode, supabase]);

  // ─── Fetch members (central item mode) ───────────────────────────────────
  useEffect(() => {
    if (effectiveItemMode !== "central" || !companyId) return;
    let cancelled = false;

    void (async () => {
      const { data: peopleData, error: peopleError } = await supabase.rpc("get_company_people_with_items");

      if (!cancelled && !peopleError && Array.isArray(peopleData)) {
        const mapped = (peopleData as CompanyPeopleRpcRow[])
          .map((row) => ({
            id: row.membership_id,
            fullName: row.full_name ?? row.email ?? row.membership_id,
            email: row.email ?? "",
            clerkUserId: undefined,
          }))
          .sort((a, b) => a.fullName.localeCompare(b.fullName, "sv"));

        membersRef.current = mapped;
        setMembers(mapped);
        return;
      }

      // Fallback for environments where migration is not yet applied.
      const { data, error } = await supabase
        .from("company_memberships")
        .select("id, full_name, email, clerk_user_id")
        .eq("company_id", companyId)
        .eq("status", "active")
        .order("full_name");

      if (cancelled) return;
      if (!error && data) {
        const mapped = data.map((m) => ({
          id: m.id as string,
          fullName: (m.full_name as string | null) ?? (m.email as string),
          email: m.email as string,
          clerkUserId: (m.clerk_user_id as string | null) ?? undefined,
        }));
        membersRef.current = mapped;
        setMembers(mapped);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId, effectiveItemMode, supabase]);

  useEffect(() => {
    if (effectiveItemMode !== "central" || !companyId || !userId) {
      setCurrentMembership(null);
      return;
    }

    let cancelled = false;

    void supabase
      .rpc("get_my_membership")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          return;
        }

        const rows = Array.isArray(data)
          ? (data as MembershipRpcRow[])
          : data
            ? [data as MembershipRpcRow]
            : [];

        const membership = rows[0] ?? null;
        setCurrentMembership(membership);

        if (!membership) {
          return;
        }

        if (membership.role) {
          setCurrentUserRole(membership.role);
        }

        setMembers((prev) => {
          let next = prev;

          if (!prev.some((member) => member.id === membership.id)) {
            next = [
              ...prev,
              {
                id: membership.id,
                fullName: membership.full_name ?? membership.email ?? user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? userId,
                email: membership.email ?? user?.primaryEmailAddress?.emailAddress ?? "",
                clerkUserId: membership.clerk_user_id ?? userId,
              },
            ];
          }

          membersRef.current = next;
          return next;
        });
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, effectiveItemMode, supabase, user, userId]);

  // ─── Resolve current membership role (central mode) ─────────────────────
  useEffect(() => {
    if (effectiveItemMode !== "central" || !companyId || !userId) {
      setCurrentUserRole(null);
      return;
    }

    if (currentMembership?.role) {
      setCurrentUserRole(currentMembership.role);
      return;
    }

    let cancelled = false;

    void supabase
      .from("company_memberships")
      .select("role")
      .eq("company_id", companyId)
      .eq("clerk_user_id", userId)
      .eq("status", "active")
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data?.role) {
          setCurrentUserRole(data.role as MembershipRole);
        } else {
          setCurrentUserRole(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, currentMembership?.role, effectiveItemMode, supabase, userId]);

  // ─── Resolve company default assignment type for new tools ───────────────
  useEffect(() => {
    if (effectiveItemMode !== "central" || !companyId) {
      setDefaultItemLocationType("person");
      return;
    }

    let cancelled = false;

    void supabase
      .from("companies")
      .select("default_item_assignment_type")
      .eq("id", companyId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error) {
          return;
        }

        const nextDefault = data?.default_item_assignment_type === "vehicle" ? "vehicle" : "person";
        setDefaultItemLocationType(nextDefault);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, effectiveItemMode, supabase]);

  // ─── Fetch items (central) ────────────────────────────────────────────────
  useEffect(() => {
    if (effectiveItemMode !== "central" || !companyId) return;
    let cancelled = false;

    const categoryNameById = new Map(categoryRowsRef.current.map((row) => [row.id, row.name]));
    const memberLabelById = new Map(
      membersRef.current.map((member) => [member.id, member.fullName || member.email])
    );

    if (currentMembership?.id) {
      memberLabelById.set(
        currentMembership.id,
        currentMembership.full_name?.trim()
          || currentMembership.email?.trim()
          || user?.fullName?.trim()
          || user?.primaryEmailAddress?.emailAddress
          || userId
          || ""
      );
    }

    void (async () => {
      const applyMapped = (mapped: FleetItem[]) => {
        const sameCompany = lastItemsCompanyIdRef.current === companyId;

        if (mapped.length === 0 && sameCompany && itemsRef.current.length > 0) {
          emptyItemsStreakRef.current += 1;
          if (emptyItemsStreakRef.current < 2) {
            return;
          }
        } else {
          emptyItemsStreakRef.current = 0;
        }

        lastItemsCompanyIdRef.current = companyId;
        setItems(mapped);
      };

      const mapItemRow = (row: {
        id: string;
        name: string | null;
        notes: string | null;
        image_url: string | null;
        created_at: string | null;
        assignment_type: string | null;
        vehicle_id: string | null;
        assigned_membership_id: string | null;
        category_id?: string | null;
        category_name?: string | null;
        assigned_full_name?: string | null;
        assigned_email?: string | null;
        company_memberships?: {
          full_name?: string | null;
          email?: string | null;
        } | null;
      }): FleetItem => {
        const assignmentType = row.assignment_type ?? "unassigned";
        const locationType = assignmentType === "vehicle" ? "vehicle" : "person";
        const assignedPersonLabel =
          row.assigned_full_name?.trim()
          || row.assigned_email?.trim()
          || row.company_memberships?.full_name?.trim()
          || row.company_memberships?.email?.trim()
          || memberLabelById.get(String(row.assigned_membership_id ?? ""));

        return {
          id: row.id,
          name: row.name ?? "",
          category: row.category_name ?? categoryNameById.get(String(row.category_id ?? "")) ?? "",
          locationType,
          assignedMembershipId:
            locationType === "person"
              ? (row.assigned_membership_id ?? undefined)
              : undefined,
          assignedVehicle: locationType === "vehicle" ? (row.vehicle_id ?? undefined) : undefined,
          assignedPerson:
            locationType === "person"
              ? assignedPersonLabel
              : undefined,
          notes: row.notes ?? undefined,
          image: row.image_url ?? undefined,
          addedDate: (row.created_at ?? "").split("T")[0],
        };
      };

      const { data: rpcData, error: rpcError } = await supabase.rpc("get_company_items_with_assignments");
      if (!cancelled && !rpcError && Array.isArray(rpcData)) {
        const mapped = (rpcData as CompanyItemsRpcRow[]).map((row) =>
          mapItemRow({
            ...row,
            category_id: null,
            company_memberships: null,
          })
        );
        applyMapped(mapped);
        return;
      }

      const { data, error } = await supabase
        .from("items")
        .select(
          "id, name, notes, image_url, created_at, assignment_type, status, vehicle_id, assigned_membership_id, category_id, company_memberships!items_assigned_membership_id_fkey(full_name, email)"
        )
        .eq("company_id", companyId)
        .or("status.is.null,status.neq.retired")
        .order("created_at", { ascending: false });

      if (cancelled || error || !data) {
        return;
      }

      const mapped = data.map((row) =>
        mapItemRow({
          id: row.id as string,
          name: (row.name as string | null) ?? null,
          notes: (row.notes as string | null) ?? null,
          image_url: (row.image_url as string | null) ?? null,
          created_at: (row.created_at as string | null) ?? null,
          assignment_type: (row.assignment_type as string | null) ?? null,
          vehicle_id: (row.vehicle_id as string | null) ?? null,
          assigned_membership_id: (row.assigned_membership_id as string | null) ?? null,
          category_id: (row.category_id as string | null) ?? null,
          company_memberships: (row.company_memberships as { full_name?: string | null; email?: string | null } | null) ?? null,
        })
      );

      applyMapped(mapped);
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId, currentMembership, effectiveItemMode, itemsReloadTick, supabase, user, userId]);

  useEffect(() => {
    if (effectiveItemMode !== "central" || members.length === 0) {
      return;
    }

    setItems((prev) => prev.map((item) => {
      if (item.locationType !== "person" || !item.assignedMembershipId) {
        return item;
      }

      const member = members.find((candidate) => candidate.id === item.assignedMembershipId);
      if (!member) {
        return item;
      }

      const nextAssignedPerson = member.fullName || member.email;
      if (item.assignedPerson === nextAssignedPerson) {
        return item;
      }

      return {
        ...item,
        assignedPerson: nextAssignedPerson,
      };
    }));
  }, [effectiveItemMode, members]);

  useEffect(() => {
    if (effectiveItemMode !== "central" || !currentMembership?.id) {
      return;
    }

    const currentLabel = currentMembership.full_name?.trim()
      || currentMembership.email?.trim()
      || currentMemberName;

    if (!currentLabel) {
      return;
    }

    setItems((prev) => prev.map((item) => {
      if (item.locationType !== "person" || item.assignedMembershipId !== currentMembership.id) {
        return item;
      }

      if (item.assignedPerson === currentLabel) {
        return item;
      }

      return {
        ...item,
        assignedPerson: currentLabel,
      };
    }));
  }, [currentMemberName, currentMembership, effectiveItemMode]);

  // ─── Lookup helpers ───────────────────────────────────────────────────────
  function getCategoryId(name: string): string | null {
    return categoryRowsRef.current.find((r) => r.name === name)?.id ?? null;
  }

  function getMembershipId(personName: string | undefined): string | null {
    if (!personName) return null;
    return members.find((m) => m.fullName === personName || m.email === personName)?.id ?? null;
  }

  function getVehicleNameById(vehicleId: string | null | undefined): string {
    if (!vehicleId) return "-";
    return vehicles.find((vehicle) => vehicle.id === vehicleId)?.name ?? vehicleId;
  }

  // ─── Items mutations ──────────────────────────────────────────────────────
  const addItem = (item: Omit<FleetItem, "id">) => {
    if (!canManageLoadout) {
      console.warn("addItem blocked by role policy");
      return;
    }

    if (effectiveItemMode === "central" && companyId) {
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
            appendActivity({
              action: "item_added",
              itemName: item.name,
            });
            setItems((prev) => [
              {
                ...item,
                id: data.id as string,
                assignedMembershipId:
                  item.locationType === "person" ? (getMembershipId(item.assignedPerson) ?? undefined) : undefined,
                addedDate: ((data.created_at as string) ?? "").split("T")[0],
              },
              ...prev,
            ]);
          }
        });
    } else {
      appendActivity({
        action: "item_added",
        itemName: item.name,
      });
      setItems((prev) => [{ ...item, id: Date.now().toString() }, ...prev]);
    }
  };

  const updateItem = (id: string, updates: Partial<FleetItem>) => {
    if (!canManageLoadout) {
      console.warn("updateItem blocked by role policy");
      return;
    }

    if (effectiveItemMode === "central") {
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
          if (!error) {
            appendActivity({
              action: "item_updated",
              itemName: items.find((item) => item.id === id)?.name,
            });
            setItems((prev) => prev.map((i) => {
              if (i.id !== id) {
                return i;
              }

              const nextAssignedPerson = updates.assignedPerson !== undefined ? updates.assignedPerson : i.assignedPerson;
              const nextLocationType = updates.locationType ?? i.locationType;

              return {
                ...i,
                ...updates,
                assignedMembershipId:
                  nextLocationType === "person" ? (getMembershipId(nextAssignedPerson) ?? i.assignedMembershipId) : undefined,
              };
            }));
          }
        });
    } else {
      appendActivity({
        action: "item_updated",
        itemName: items.find((item) => item.id === id)?.name,
      });
      setItems((prev) => prev.map((i) => {
        if (i.id !== id) {
          return i;
        }

        const nextAssignedPerson = updates.assignedPerson !== undefined ? updates.assignedPerson : i.assignedPerson;
        const nextLocationType = updates.locationType ?? i.locationType;

        return {
          ...i,
          ...updates,
          assignedMembershipId:
            nextLocationType === "person" ? (getMembershipId(nextAssignedPerson) ?? i.assignedMembershipId) : undefined,
        };
      }));
    }
  };

  const deleteItem = (id: string) => {
    if (!canManageLoadout) {
      console.warn("deleteItem blocked by role policy");
      return;
    }

    if (effectiveItemMode === "central") {
      void supabase
        .from("items")
        .update({ status: "retired" })
        .eq("id", id)
        .then(({ error }) => {
          if (!error) {
            appendActivity({
              action: "item_deleted",
              itemName: items.find((item) => item.id === id)?.name,
            });
            setItems((prev) => prev.filter((i) => i.id !== id));
            setReturnedItems((prev) => prev.filter((i) => i.id !== id));
          }
        });
    } else {
      appendActivity({
        action: "item_deleted",
        itemName: items.find((item) => item.id === id)?.name,
      });
      setItems((prev) => prev.filter((i) => i.id !== id));
      setReturnedItems((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const returnItem = (id: string) => {
    if (!canManageLoadout) {
      console.warn("returnItem blocked by role policy");
      return;
    }

    if (effectiveItemMode === "central") {
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
            const itemToReturn = items.find((item) => item.id === id);
            appendActivity({
              action: "item_returned",
              itemName: itemToReturn?.name,
            });
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
      appendActivity({
        action: "item_returned",
        itemName: items.find((item) => item.id === id)?.name,
      });
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
    assignedVehicle?: string,
    assignedMembershipId?: string
  ) => {
    if (effectiveItemMode === "central") {
      const currentItem = items.find((item) => item.id === id);
      const nextAssignedMembershipId =
        locationType === "person"
          ? (assignedMembershipId ?? getMembershipId(assignedPerson))
          : null;

      if (locationType === "person" && nextAssignedMembershipId) {
        const optimisticItem = currentItem
          ? {
              ...currentItem,
              locationType,
              assignedPerson,
              assignedMembershipId: nextAssignedMembershipId,
              assignedVehicle: undefined,
            }
          : null;

        if (optimisticItem) {
          setItems((prev) => prev.map((i) => (i.id === id ? optimisticItem : i)));
        }

        void supabase
          .rpc("move_item_to_person", {
            p_item_id: id,
            p_target_membership_id: nextAssignedMembershipId,
          })
          .then(({ data, error }) => {
            if (!error && data === true) {
              appendActivity({
                action: "item_moved",
                itemName: currentItem?.name,
                fromName:
                  currentItem?.locationType === "vehicle"
                    ? getVehicleNameById(currentItem.assignedVehicle)
                    : (currentItem?.assignedPerson ?? "-"),
                toName: assignedPerson ?? "-",
              });

              setItems((prev) =>
                prev.map((i) =>
                  i.id === id
                    ? {
                        ...i,
                        locationType,
                        assignedPerson,
                        assignedMembershipId: nextAssignedMembershipId,
                        assignedVehicle: undefined,
                      }
                    : i
                )
              );
              setItemsReloadTick((prev) => prev + 1);
            } else {
              if (currentItem) {
                setItems((prev) => prev.map((i) => (i.id === id ? currentItem : i)));
              }
              console.warn("move_item_to_person rpc failed", {
                id,
                assignedMembershipId: nextAssignedMembershipId,
                assignedPerson,
                rpcResult: data,
                message: error?.message,
              });
              Alert.alert("Kunde inte flytta verktyget", "Flytten gick inte att spara i databasen. Försök igen.");
              setItemsReloadTick((prev) => prev + 1);
            }
          });

        return;
      }

      void supabase
        .from("items")
        .update({
          assignment_type: locationType,
          vehicle_id: locationType === "vehicle" ? (assignedVehicle ?? null) : null,
          assigned_membership_id:
            nextAssignedMembershipId,
          status: "assigned",
        }, { count: "exact" })
        .eq("id", id)
        .then(({ error, count }) => {
          if (!error && count === 1) {
            appendActivity({
              action: "item_moved",
              itemName: currentItem?.name,
              fromName:
                currentItem?.locationType === "vehicle"
                  ? getVehicleNameById(currentItem.assignedVehicle)
                  : (currentItem?.assignedPerson ?? "-"),
              toName:
                locationType === "vehicle"
                  ? getVehicleNameById(assignedVehicle)
                  : (assignedPerson ?? "-"),
            });
            setItems((prev) =>
              prev.map((i) =>
                i.id === id
                  ? {
                      ...i,
                      locationType,
                      assignedPerson,
                      assignedMembershipId:
                        locationType === "person" ? (nextAssignedMembershipId ?? undefined) : undefined,
                      assignedVehicle,
                    }
                  : i
              )
            );
            setItemsReloadTick((prev) => prev + 1);
          } else {
            console.warn("moveItem central update failed", {
              id,
              locationType,
              assignedPerson,
              assignedMembershipId: nextAssignedMembershipId,
              updatedRows: count,
              assignedVehicle,
              message: error?.message,
            });
            Alert.alert("Kunde inte flytta verktyget", "Flytten gick inte att spara i databasen. Försök igen.");
            setItemsReloadTick((prev) => prev + 1);
          }
        });
    } else {
      const currentItem = items.find((item) => item.id === id);
      appendActivity({
        action: "item_moved",
        itemName: currentItem?.name,
        fromName:
          currentItem?.locationType === "vehicle"
            ? getVehicleNameById(currentItem.assignedVehicle)
            : (currentItem?.assignedPerson ?? "-"),
        toName:
          locationType === "vehicle"
            ? getVehicleNameById(assignedVehicle)
            : (assignedPerson ?? "-"),
      });
      const nextAssignedMembershipId =
        locationType === "person"
          ? (assignedMembershipId ?? getMembershipId(assignedPerson))
          : null;
      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                locationType,
                assignedPerson,
                assignedMembershipId:
                  locationType === "person" ? (nextAssignedMembershipId ?? undefined) : undefined,
                assignedVehicle,
              }
            : i
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

    if (effectiveItemMode === "central") {
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
            appendActivity({
              action: "items_assigned_vehicle",
              vehicleName: getVehicleNameById(vehicleId),
              count: itemIds.length,
            });
            setItems((prev) =>
              prev.map((i) =>
                itemIds.includes(i.id)
                  ? {
                      ...i,
                      locationType: "vehicle",
                      assignedVehicle: vehicleId,
                      assignedPerson: undefined,
                      assignedMembershipId: undefined,
                    }
                  : i
              )
            );
          }
        });
    } else {
      appendActivity({
        action: "items_assigned_vehicle",
        vehicleName: getVehicleNameById(vehicleId),
        count: itemIds.length,
      });
      setItems((prev) =>
        prev.map((i) =>
          itemIds.includes(i.id)
            ? {
                ...i,
                locationType: "vehicle",
                assignedVehicle: vehicleId,
                assignedPerson: undefined,
                assignedMembershipId: undefined,
              }
            : i
        )
      );
    }
  };

  // ─── Vehicles mutations ───────────────────────────────────────────────────
  const addVehicle = (name: string) => {
    if (effectiveVehicleMode === "central" && companyId) {
      void supabase
        .from("vehicles")
        .insert({ name, company_id: companyId })
        .select("id, name")
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            appendActivity({ action: "vehicle_added", vehicleName: data.name as string });
            setVehicles((prev) => [
              ...prev,
              { id: data.id as string, name: data.name as string },
            ]);
          }
        });
    } else {
      appendActivity({ action: "vehicle_added", vehicleName: name });
      setVehicles((prev) => [...prev, { id: Date.now().toString(), name }]);
    }
  };

  const updateVehicle = (id: string, name: string) => {
    if (effectiveVehicleMode === "central") {
      void supabase
        .from("vehicles")
        .update({ name })
        .eq("id", id)
        .then(({ error }) => {
          if (!error) {
            appendActivity({
              action: "vehicle_updated",
              vehicleName: name,
            });
            setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, name } : v)));
          }
        });
    } else {
      appendActivity({
        action: "vehicle_updated",
        vehicleName: name,
      });
      setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, name } : v)));
    }
  };

  const removeVehicle = (id: string) => {
    if (effectiveVehicleMode === "central") {
      void supabase
        .from("vehicles")
        .update({ is_active: false })
        .eq("id", id)
        .then(({ error }) => {
          if (!error) {
            appendActivity({
              action: "vehicle_removed",
              vehicleName: getVehicleNameById(id),
            });
            setVehicles((prev) => prev.filter((v) => v.id !== id));
          }
        });
    } else {
      appendActivity({
        action: "vehicle_removed",
        vehicleName: getVehicleNameById(id),
      });
      setVehicles((prev) => prev.filter((v) => v.id !== id));
    }
  };

  // ─── Category mutations ───────────────────────────────────────────────────
  const addCategory = (name: string) => {
    if (effectiveCategoryMode === "central" && companyId) {
      void supabase
        .from("categories")
        .insert({ name, company_id: companyId })
        .select("id, name")
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            appendActivity({ action: "category_added", itemName: data.name as string });
            categoryRowsRef.current = [
              ...categoryRowsRef.current,
              { id: data.id as string, name: data.name as string },
            ];
            setCategories((prev) => [...prev, data.name as string]);
          }
        });
    } else {
      appendActivity({ action: "category_added", itemName: name });
      setCategories((prev) => [...prev, name]);
    }
  };

  const removeCategory = (name: string) => {
    if (effectiveCategoryMode === "central") {
      void supabase
        .from("categories")
        .update({ is_active: false })
        .eq("name", name)
        .then(({ error }) => {
          if (!error) {
            appendActivity({ action: "category_removed", itemName: name });
            categoryRowsRef.current = categoryRowsRef.current.filter((r) => r.name !== name);
            setCategories((prev) => prev.filter((c) => c !== name));
          }
        });
    } else {
      appendActivity({ action: "category_removed", itemName: name });
      setCategories((prev) => prev.filter((c) => c !== name));
    }
  };

  // ─── Mode setters ─────────────────────────────────────────────────────────
  const setCategoryMode = (mode: "local" | "central") => {
    appendActivity({ action: "mode_changed", modeTarget: "categories", modeValue: mode });
    setCategoryModeState(mode);
  };
  const setVehicleMode = (mode: "local" | "central") => {
    appendActivity({ action: "mode_changed", modeTarget: "vehicles", modeValue: mode });
    setVehicleModeState(mode);
  };
  const setItemMode = (mode: "local" | "central") => {
    appendActivity({ action: "mode_changed", modeTarget: "items", modeValue: mode });
    setItemModeState(mode);
  };

  const refreshItems = () => {
    setItemsReloadTick((prev) => prev + 1);
  };

  return (
    <ItemsContext.Provider
      value={{
        items,
        returnedItems,
        vehicles,
        activityLog,
        categories,
        members,
        categoryMode: effectiveCategoryMode,
        vehicleMode: effectiveVehicleMode,
        itemMode: effectiveItemMode,
        currentUserRole,
        defaultItemLocationType,
        currentMemberId,
        currentMemberName,
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
        refreshItems,
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
