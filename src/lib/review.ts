import "server-only";
import { fold } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

type Groupable = {
  id: string;
  kind: string;
  tag_id: string | null;
  person_id: string | null;
  payload: unknown;
};

// Identical name suggestions for the same face (by one or several users) are one decision
// for the admin, so the queue shows them as one item. Everything else stands alone.
export function reviewGroupKey(item: Groupable): string {
  if (item.kind !== "name_suggestion") return item.id;
  return [
    item.kind,
    item.tag_id,
    item.person_id ?? fold(payloadText(item.payload, "name") ?? ""),
  ].join("|");
}

export function payloadText(payload: unknown, key: string): string | null {
  if (payload && typeof payload === "object" && key in payload) {
    const value = (payload as Record<string, unknown>)[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
  return null;
}

// Number of open items in the queue as the admin sees it (grouped).
export async function countOpenReviewItems(supabase: Client): Promise<number> {
  const { data } = await supabase
    .from("review_items")
    .select("id, kind, tag_id, person_id, payload")
    .eq("status", "open");
  return new Set((data ?? []).map(reviewGroupKey)).size;
}

// A photo its contributor took down (withdraw_own_photo) must not be republished.
export async function withdrawnByContributor(
  supabase: Client,
  photoId: string,
): Promise<boolean> {
  const { count } = await supabase
    .from("activity")
    .select("id", { count: "exact", head: true })
    .eq("action", "own_photo_withdrawn")
    .eq("target_id", photoId);
  return (count ?? 0) > 0;
}
