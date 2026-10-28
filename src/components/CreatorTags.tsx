"use client";

// Casting tag UI: chips, filters, the per-creator picker and the "Manage tags" panel.

import { useEffect, useState } from "react";
import { Card } from "@/components/Guard";
import { hasTagFilter, saveCreatorTags, type CreatorTags, type Tag, type TagFilter } from "@/lib/creator-tags";

export function TagsNotReady() {
  return (
    <p className="text-xs text-stone-500">
      Casting tags aren&apos;t switched on yet. An owner needs to run the <code>0008_creator_tags.sql</code> database update in Supabase.
    </p>
  );
}

export function TagChips({ tags, ct, className = "" }: { tags: Tag[]; ct: CreatorTags; className?: string }) {
  if (tags.length === 0) return null;
  return (
    <span className={`inline-flex flex-wrap gap-1 ${className}`}>
      {tags.map((t) => (
        <span key={t.id} className={`rounded-full px-1.5 py-0.5 text-[11px] leading-none font-medium whitespace-nowrap ${ct.groupColor.get(t.group_id) ?? "bg-stone-100 text-stone-700"}`}>
          {t.name}
        </span>
      ))}
    </span>
  );
}

/** One dropdown per tag group; a creator must match every choice. */
export function TagFilters({ ct, value, onChange }: { ct: CreatorTags; value: TagFilter; onChange: (f: TagFilter) => void }) {
  if (!ct.ready || ct.activeGroups.length === 0) return null;
  const control = "rounded-lg border border-stone-300 px-2 py-1.5 text-sm bg-white";
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {ct.activeGroups.map((g) => (
        <select
          key={g.id}
          value={value[g.id] ?? ""}
          onChange={(e) => onChange({ ...value, [g.id]: e.target.value })}
          className={`${control} ${value[g.id] ? "border-brand text-brand" : ""}`}
          aria-label={g.name}
        >
          <option value="">Any {g.name.toLowerCase()}</option>
          {ct.tagsIn(g.id).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      ))}
      {hasTagFilter(value) && (
        <button onClick={() => onChange({})} className="text-xs text-brand hover:underline px-1">
          Clear tags
        </button>
      )}
    </div>
  );
}

/** Choose a creator's tags: a dropdown for one-choice groups, toggles for the rest. */
export function TagPicker({
  ct,
  value,
  onChange,
  disabled,
}: {
  ct: CreatorTags;
  value: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
}) {
  const [adding, setAdding] = useState<string | null>(null); // group id with an open "+ Add tag" box
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const canAddTags = ct.canManage;

  const pickSingle = (groupId: string, tagId: string) => {
    const next = new Set([...value].filter((id) => ct.tagById.get(id)?.group_id !== groupId));
    if (tagId) next.add(tagId);
    onChange(next);
  };

  const toggle = (tagId: string) => {
    const next = new Set(value);
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    onChange(next);
  };

  const addTag = async (groupId: string) => {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    const sort = Math.max(0, ...ct.tagsIn(groupId, true).map((t) => t.sort_order)) + 1;
    const { data, error } = await ct.supabase
      .from("creator_tags")
      .insert({ group_id: groupId, name, sort_order: sort })
      .select("id")
      .single();
    if (error) return setError(error.code === "23505" ? `"${name}" already exists.` : error.message);
    await ct.reload();
    const group = ct.groups.find((g) => g.id === groupId);
    if (group?.single_choice) pickSingle(groupId, data.id);
    else onChange(new Set(value).add(data.id));
    setAdding(null);
    setNewName("");
  };

  if (!ct.ready) return <TagsNotReady />;

  return (
    <div className="space-y-3">
      {ct.activeGroups.map((g) => {
        // Archived tags can't be picked, but stay visible on creators who already have them.
        const options = ct.tagsIn(g.id, true).filter((t) => !t.archived || value.has(t.id));
        const chosen = options.filter((t) => value.has(t.id));
        return (
          <div key={g.id} className="sm:flex sm:items-start gap-3">
            <span className="block text-sm text-stone-600 sm:w-28 shrink-0 sm:pt-1.5 mb-1 sm:mb-0">{g.name}</span>
            <div className="flex-1 flex flex-wrap gap-1.5 items-center">
              {g.single_choice ? (
                <select
                  value={chosen[0]?.id ?? ""}
                  onChange={(e) => pickSingle(g.id, e.target.value)}
                  disabled={disabled}
                  className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm bg-white"
                  aria-label={g.name}
                >
                  <option value="">—</option>
                  {options.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              ) : (
                options.map((t) => {
                  const on = value.has(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggle(t.id)}
                      disabled={disabled}
                      aria-pressed={on}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium border ${
                        on ? `${ct.groupColor.get(g.id)} border-transparent` : "border-stone-300 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {on ? "✓ " : ""}{t.name}
                    </button>
                  );
                })
              )}
              {canAddTags && !disabled && (
                adding === g.id ? (
                  <span className="flex gap-1 items-center">
                    <input
                      autoFocus
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag(g.id);
                        }
                        if (e.key === "Escape") setAdding(null);
                      }}
                      placeholder="New tag"
                      className="rounded-lg border border-stone-300 px-2 py-1 text-xs w-28"
                    />
                    <button type="button" onClick={() => addTag(g.id)} className="text-xs text-brand font-medium">Add</button>
                    <button type="button" onClick={() => setAdding(null)} className="text-xs text-stone-400">Cancel</button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(g.id);
                      setNewName("");
                    }}
                    className="text-xs text-brand hover:underline"
                  >
                    + Add tag
                  </button>
                )
              )}
            </div>
          </div>
        );
      })}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}

/** "Casting tags" card on a creator's profile; saves straight away. */
export function CreatorTagsCard({ ct, creatorId, canEdit }: { ct: CreatorTags; creatorId: string; canEdit: boolean }) {
  const current = ct.byCreator.get(creatorId) ?? new Set<string>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const change = async (next: Set<string>) => {
    setSaving(true);
    setError(null);
    const err = await saveCreatorTags(ct.supabase, creatorId, current, next);
    await ct.reload();
    setSaving(false);
    if (err) setError(err);
  };

  return (
    <Card className="mb-4">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="font-medium">Casting tags</h2>
        {saving && <span className="text-xs text-stone-400">Saving…</span>}
      </div>
      {!ct.ready ? (
        <TagsNotReady />
      ) : canEdit ? (
        <TagPicker ct={ct} value={current} onChange={change} disabled={saving} />
      ) : ct.tagsOf(creatorId).length ? (
        <TagChips tags={ct.tagsOf(creatorId)} ct={ct} />
      ) : (
        <p className="text-sm text-stone-500">No tags yet.</p>
      )}
      {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
    </Card>
  );
}

/** Owners and UGC managers: add, rename and archive tag groups and tags. */
export function ManageTags({ ct }: { ct: CreatorTags }) {
  const [open, setOpen] = useState(false);
  const [newGroup, setNewGroup] = useState("");
  const [newGroupSingle, setNewGroupSingle] = useState(false);
  const [newTag, setNewTag] = useState<Record<string, string>>({});
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setError(null), [open]);

  if (!ct.ready || !ct.canManage) return null;

  const run = async (p: PromiseLike<{ error: { message: string; code?: string } | null }>, dupName?: string) => {
    setError(null);
    const { error } = await p;
    if (error) setError(error.code === "23505" && dupName ? `"${dupName}" already exists.` : error.message);
    await ct.reload();
    return !error;
  };

  const rename = (table: "creator_tag_groups" | "creator_tags", id: string, current: string) => {
    const name = window.prompt("New name", current)?.trim();
    if (!name || name === current) return;
    run(ct.supabase.from(table).update({ name }).eq("id", id), name);
  };

  const addGroup = async () => {
    const name = newGroup.trim();
    if (!name) return;
    const sort = Math.max(0, ...ct.groups.map((g) => g.sort_order)) + 1;
    if (await run(ct.supabase.from("creator_tag_groups").insert({ name, single_choice: newGroupSingle, sort_order: sort }), name)) {
      setNewGroup("");
      setNewGroupSingle(false);
    }
  };

  const addTag = async (groupId: string) => {
    const name = (newTag[groupId] ?? "").trim();
    if (!name) return;
    const sort = Math.max(0, ...ct.tagsIn(groupId, true).map((t) => t.sort_order)) + 1;
    if (await run(ct.supabase.from("creator_tags").insert({ group_id: groupId, name, sort_order: sort }), name)) {
      setNewTag((v) => ({ ...v, [groupId]: "" }));
    }
  };

  const groups = ct.groups.filter((g) => showArchived || !g.archived);
  const small = "text-xs text-stone-400 hover:text-stone-700";

  return (
    <Card className="mb-4">
      <button onClick={() => setOpen(!open)} className="w-full flex justify-between items-center text-left" aria-expanded={open}>
        <span className="font-medium">Manage casting tags</span>
        <span className={`text-xs text-stone-400 transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
      </button>
      {open && (
        <div className="mt-4 space-y-4">
          <label className="flex items-center gap-2 text-xs text-stone-500">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived
          </label>
          {groups.map((g) => (
            <div key={g.id} className={`border-t border-stone-100 pt-3 ${g.archived ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-medium text-sm">{g.name}</span>
                <span className="text-xs text-stone-500">{g.single_choice ? "one per creator" : "several allowed"}</span>
                <button onClick={() => rename("creator_tag_groups", g.id, g.name)} className={small}>Rename</button>
                <button onClick={() => run(ct.supabase.from("creator_tag_groups").update({ single_choice: !g.single_choice }).eq("id", g.id))} className={small}>
                  {g.single_choice ? "Allow several" : "Make one-choice"}
                </button>
                <button onClick={() => run(ct.supabase.from("creator_tag_groups").update({ archived: !g.archived }).eq("id", g.id))} className={small}>
                  {g.archived ? "Unarchive" : "Archive"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                {ct.tagsIn(g.id, true)
                  .filter((t) => showArchived || !t.archived)
                  .map((t) => (
                    <span key={t.id} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${t.archived ? "bg-stone-100 text-stone-400 line-through" : ct.groupColor.get(g.id)}`}>
                      {t.name}
                      <button onClick={() => rename("creator_tags", t.id, t.name)} className="opacity-60 hover:opacity-100" aria-label={`Rename ${t.name}`}>✎</button>
                      <button
                        onClick={() => run(ct.supabase.from("creator_tags").update({ archived: !t.archived }).eq("id", t.id))}
                        className="opacity-60 hover:opacity-100"
                        aria-label={t.archived ? `Unarchive ${t.name}` : `Archive ${t.name}`}
                        title={t.archived ? "Unarchive" : "Archive"}
                      >
                        {t.archived ? "↺" : "×"}
                      </button>
                    </span>
                  ))}
                {!g.archived && (
                  <span className="inline-flex gap-1">
                    <input
                      value={newTag[g.id] ?? ""}
                      onChange={(e) => setNewTag((v) => ({ ...v, [g.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && addTag(g.id)}
                      placeholder="New tag"
                      className="rounded-lg border border-stone-300 px-2 py-1 text-xs w-28"
                    />
                    <button onClick={() => addTag(g.id)} className="text-xs text-brand font-medium">Add</button>
                  </span>
                )}
              </div>
            </div>
          ))}
          <div className="border-t border-stone-100 pt-3 flex flex-wrap gap-2 items-center">
            <input
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addGroup()}
              placeholder="New tag group, e.g. Hair"
              className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm flex-1 min-w-[160px]"
            />
            <label className="flex items-center gap-1.5 text-xs text-stone-600">
              <input type="checkbox" checked={newGroupSingle} onChange={(e) => setNewGroupSingle(e.target.checked)} /> One per creator
            </label>
            <button onClick={addGroup} className="rounded-lg bg-stone-900 text-white px-3 py-1.5 text-sm">Add group</button>
          </div>
          <p className="text-xs text-stone-500">Archived tags stay on creators who already have them but can&apos;t be picked again.</p>
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
      )}
    </Card>
  );
}
