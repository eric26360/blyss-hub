// Creates login accounts for the team with a temporary password each.
// Run once after the database is set up:  node --env-file=.env.local scripts/create-team.mjs
// Prints each temporary password; skips anyone who already has an account.

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const TEAM = [
  { name: "Eric", email: "eric@blyssofficial.com", role: "owner" },
  { name: "Kaelam", email: "kaelam@blyssofficial.com", role: "owner" },
  { name: "Roman", email: "roman@blyssofficial.com", role: "strategist" },
  { name: "Alec", email: "alec@blyssofficial.com", role: "strategist" },
  { name: "Maia", email: "maia@blyssofficial.com", role: "ugc_manager" },
  { name: "Daria", email: "daria@blyssofficial.com", role: "video_editor" },
];

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

for (const person of TEAM) {
  const password = "Blyss-" + randomBytes(6).toString("base64url");
  const { error } = await supabase.auth.admin.createUser({
    email: person.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: person.name, role: person.role },
  });
  if (error) console.log(`${person.email}: skipped (${error.message})`);
  else console.log(`${person.email}\t${person.role}\t${password}`);
}
