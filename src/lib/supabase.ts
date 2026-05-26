import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@clerk/clerk-expo";
import { useEffect, useMemo, useRef } from "react";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY");
}

const DEFAULT_TEMPLATE_CANDIDATES = ["supabase", "supabase_rs256", "supabase-jwt"];

type ClerkGetTokenFn = (params?: { template?: string; skipCache?: boolean }) => Promise<string | null>;

type TokenCandidate = {
  template: string | null;
  label: string;
};

function parseTokenCandidates(): TokenCandidate[] {
  const raw = process.env.EXPO_PUBLIC_CLERK_SUPABASE_TEMPLATES;

  const orderedTemplateNames = [
    ...(raw
      ? raw
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
      : []),
    ...DEFAULT_TEMPLATE_CANDIDATES,
  ];

  const uniqueTemplateNames = Array.from(new Set(orderedTemplateNames));

  return [
    { template: null, label: "session" },
    ...uniqueTemplateNames.map((template) => ({ template, label: template })),
  ];
}

export function decodeJwtHeader(token: string): Record<string, unknown> | null {
  try {
    const [headerBase64] = token.split(".");
    if (!headerBase64) {
      return null;
    }
    return decodeJwtSegment(headerBase64);
  } catch {
    return null;
  }
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payloadBase64] = token.split(".");
    if (!payloadBase64) {
      return null;
    }
    return decodeJwtSegment(payloadBase64);
  } catch {
    return null;
  }
}

function decodeJwtSegment(base64UrlSegment: string): Record<string, unknown> | null {
  const normalized = base64UrlSegment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const decoded = globalThis.atob(padded);
  const parsed = JSON.parse(decoded) as Record<string, unknown>;
  return parsed;
}

export async function getSupabaseTokenWithFallback(getToken: ClerkGetTokenFn): Promise<{
  token: string | null;
  templateUsed: string | null;
}> {
  const candidates = parseTokenCandidates();

  for (const candidate of candidates) {
    try {
      const token = candidate.template
        ? await getToken({ template: candidate.template, skipCache: true })
        : await getToken({ skipCache: true });

      if (token) {
        return {
          token,
          templateUsed: candidate.label,
        };
      }
    } catch {
      // Try next candidate.
    }
  }

  return {
    token: null,
    templateUsed: null,
  };
}

/**
 * Returns a Supabase client that injects a Clerk JWT on every request.
 * It first tries the default Clerk session token, then falls back to legacy templates.
 * Must be called inside a component that is wrapped by <ClerkProvider>.
 */
export function useSupabase() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  return useMemo(
    () => {
      let cachedToken: string | null = null;
      let cachedTemplate: string | null = null;
      let cachedAt = 0;
      const maxAgeMs = 50_000;

      return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
          fetch: async (input: RequestInfo | URL, init: RequestInit = {}) => {
            const headers = new Headers(init.headers);
            let tokenToUse: string | null = null;

            const isFresh = cachedToken && Date.now() - cachedAt < maxAgeMs;
            if (isFresh) {
              tokenToUse = cachedToken;
            } else {
              try {
                const fetched = cachedTemplate
                  ? cachedTemplate === "session"
                    ? await getTokenRef.current({ skipCache: true })
                    : await getTokenRef.current({ template: cachedTemplate, skipCache: true })
                  : null;

                if (fetched) {
                  tokenToUse = fetched;
                } else {
                  const fallback = await getSupabaseTokenWithFallback(getTokenRef.current);
                  tokenToUse = fallback.token;
                  cachedTemplate = fallback.templateUsed;
                }

                if (tokenToUse) {
                  cachedToken = tokenToUse;
                  cachedAt = Date.now();
                }
              } catch {
                // Fall back to the last known token if available.
                tokenToUse = cachedToken;
              }
            }

            if (tokenToUse) {
              headers.set("Authorization", `Bearer ${tokenToUse}`);
            }

            return fetch(input, { ...init, headers });
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionFromUrl: false,
        },
      });
    },
    []
  );
}
