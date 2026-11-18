import type { Metadata } from "next";
import { countOpenReviewItems } from "@/lib/review";
import { createClient, requireAdmin } from "@/lib/supabase/server";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = { robots: { index: false } };

// Every /admin page is for admins only. Server Actions check again on their own.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  const supabase = await createClient();
  const [pending, { count: requests }] = await Promise.all([
    countOpenReviewItems(supabase),
    supabase
      .from("access_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);
  return (
    <>
      <AdminNav pending={pending} requests={requests ?? 0} />
      {children}
    </>
  );
}
