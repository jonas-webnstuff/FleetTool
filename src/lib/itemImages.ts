import type { SupabaseClient } from "@supabase/supabase-js";

// Tool photos live in the private "item-images" Storage bucket under
// "<company_id>/<file>", readable only by that company (see the
// item_images_storage migration in FleettoolWeb). items.image_url stores a
// reference to the object rather than a URL, since a private object only has
// short-lived signed URLs.
const BUCKET = "item-images";
const REF_PREFIX = `storage://${BUCKET}/`;
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function isStorageRef(value: string | null | undefined): value is string {
  return Boolean(value?.startsWith(REF_PREFIX));
}

function guessContentType(uri: string): { contentType: string; extension: string } {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return { contentType: "image/png", extension: "png" };
  if (lower.endsWith(".heic")) return { contentType: "image/heic", extension: "heic" };
  if (lower.endsWith(".webp")) return { contentType: "image/webp", extension: "webp" };
  return { contentType: "image/jpeg", extension: "jpg" };
}

/**
 * Uploads a photo picked on this device and returns the reference to store in
 * items.image_url. Anything that isn't a local file (already uploaded, or an
 * http URL) is returned unchanged. Returns null if the upload fails, so the
 * tool is still created, just without a photo.
 */
export async function uploadItemImageIfLocal(
  supabase: SupabaseClient,
  companyId: string,
  uri: string | null | undefined
): Promise<string | null> {
  if (!uri) return null;
  if (isStorageRef(uri) || /^https?:\/\//i.test(uri)) return uri;

  try {
    const { contentType, extension } = guessContentType(uri);
    const body = await fetch(uri).then((response) => response.arrayBuffer());
    const path = `${companyId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType, upsert: false });

    if (error) {
      console.warn("item image upload failed", error.message);
      return null;
    }

    return `${REF_PREFIX}${path}`;
  } catch (error) {
    console.warn("item image upload failed", error);
    return null;
  }
}

/**
 * Swaps storage references on loaded items for signed URLs that <Image> can
 * display. Legacy values (old on-device file:// paths) are left untouched.
 */
export async function withSignedItemImageUrls<T extends { image?: string }>(
  supabase: SupabaseClient,
  items: T[]
): Promise<T[]> {
  const paths = Array.from(
    new Set(items.map((item) => item.image).filter(isStorageRef).map((ref) => ref.slice(REF_PREFIX.length)))
  );

  if (paths.length === 0) return items;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    console.warn("item image signing failed", error?.message);
    return items;
  }

  const signedByPath = new Map(
    data.filter((entry) => entry.path && entry.signedUrl).map((entry) => [entry.path as string, entry.signedUrl])
  );

  return items.map((item) => {
    if (!isStorageRef(item.image)) return item;
    const signed = signedByPath.get(item.image.slice(REF_PREFIX.length));
    return { ...item, image: signed ?? undefined };
  });
}
