import type { Metadata } from "next";
import { countOpenReviewItems } from "@/lib/review";
import { createClient, requireAdmin } from "@/lib/supabase/server";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = { robots: { index: false } };

// Every /admin page is for admins only. Server Actions check again on their own.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  const pending = await countOpenReviewItems(await createClient());
  return (
    <>
      <AdminNav pending={pending} />
      {children}
    </>
  );
}
