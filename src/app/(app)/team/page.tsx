"use client";

import { Card, Guard, PageHeader } from "@/components/Guard";
import { USERS } from "@/lib/mock-data";
import { PAGES, ROLE_ACCESS, ROLE_LABELS, type Role } from "@/lib/roles";

export default function TeamPage() {
  const roles = Object.keys(ROLE_ACCESS) as Role[];
  return (
    <Guard page="team">
      <PageHeader title="Team & Access" subtitle="Who's on the team and what each role can see." />
      <Card className="mb-4 !p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-stone-500 border-b border-stone-200">
            <tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th></tr>
          </thead>
          <tbody>
            {USERS.map((u) => (
              <tr key={u.id} className="border-b border-stone-100 last:border-0">
                <td className="p-3 font-medium">{u.name}</td>
                <td className="p-3 text-stone-500">{u.email}</td>
                <td className="p-3">{ROLE_LABELS[u.role]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card className="!p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-stone-500 border-b border-stone-200">
            <tr>
              <th className="p-3">Page</th>
              {roles.map((r) => <th key={r} className="p-3 text-center">{ROLE_LABELS[r]}</th>)}
            </tr>
          </thead>
          <tbody>
            {PAGES.map((p) => (
              <tr key={p.key} className="border-b border-stone-100 last:border-0">
                <td className="p-3">{p.label}</td>
                {roles.map((r) => (
                  <td key={r} className="p-3 text-center">{ROLE_ACCESS[r].includes(p.key) ? "✅" : "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Guard>
  );
}
