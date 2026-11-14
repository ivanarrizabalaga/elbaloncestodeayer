import type { Metadata } from "next";
import { requireAdmin } from "@/lib/supabase/server";

export const metadata: Metadata = { robots: { index: false } };

// Every /admin page is for admins only. Server Actions check again on their own.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return children;
}
