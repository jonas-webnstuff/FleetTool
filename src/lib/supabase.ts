import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@clerk/clerk-expo";
import { useMemo } from "react";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY");
}

/**
 * Returns a Supabase client that injects the Clerk JWT on every request.
 * The template "supabase" must be configured in the Clerk dashboard.
 * Must be called inside a component that is wrapped by <ClerkProvider>.
 */
export function useSupabase() {
  const { getToken } = useAuth();

  return useMemo(
    () =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
          fetch: async (input: RequestInfo | URL, init: RequestInit = {}) => {
            const token = await getToken({ template: "supabase" });
            const headers = new Headers(init.headers);
            if (token) {
              headers.set("Authorization", `Bearer ${token}`);
            }
            return fetch(input, { ...init, headers });
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionFromUrl: false,
        },
      }),
    [getToken]
  );
}
