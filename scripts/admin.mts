// Admin governance from the terminal. Uses the Supabase secret key, so it bypasses RLS.
//
//   pnpm admin:list                 list admins
//   pnpm admin:grant <email>        make <email> an admin (creates the account if needed)
//
// By default it targets the project in .env.local. To target another project, run
//   node --env-file=<file> scripts/admin.mts <command> [email]
// Anything that is not the local stack asks for confirmation first.

import { createInterface } from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !secretKey) {
  fail(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. See .env.example.",
  );
}

const supabase = createClient<Database>(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const [command, rawEmail] = process.argv.slice(2);

switch (command) {
  case "list":
    await listAdmins();
    break;
  case "grant":
    await grantAdmin(rawEmail);
    break;
  default:
    fail("Usage: admin.mts list | admin.mts grant <email>");
}

async function listAdmins() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, blocked_at")
    .eq("role", "admin");
  if (error) fail(error.message);

  const emails = await emailsById();
  if (data.length === 0) console.log("No admins yet.");
  for (const admin of data) {
    const status = admin.blocked_at ? " (blocked)" : "";
    console.log(
      `${emails.get(admin.id) ?? admin.id}  ${admin.display_name ?? ""}${status}`,
    );
  }
}

async function grantAdmin(input: string | undefined) {
  const email = input?.trim().toLowerCase();
  if (!email || !email.includes("@")) fail("Usage: admin.mts grant <email>");

  await confirmTarget(`Make ${email} an admin`);

  let userId = [...(await emailsById())].find(([, e]) => e === email)?.[0];
  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (error) fail(error.message);
    userId = data.user.id;
    console.log(`Created account for ${email}.`);
  }

  // Upsert, not update: an account created before the schema existed has no profile row
  // (the handle_new_user trigger only covers new accounts).
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, role: "admin", blocked_at: null });
  if (error) fail(error.message);

  console.log(
    `${email} is now an admin. They can sign in at /entrar with a magic link.`,
  );
}

// Small archive: one page of users is enough. Revisit if it ever grows past 1000 accounts.
async function emailsById(): Promise<Map<string, string>> {
  const { data, error } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });
  if (error) fail(error.message);
  return new Map(
    data.users.map((user) => [user.id, (user.email ?? "").toLowerCase()]),
  );
}

async function confirmTarget(action: string) {
  const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url!);
  if (isLocal) return;

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `${action} on ${url}? Type "yes" to continue: `,
  );
  rl.close();
  if (answer.trim() !== "yes") fail("Cancelled.");
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
