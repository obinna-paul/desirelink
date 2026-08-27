"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Plus, Save, Trash2, UserPlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  desirePermissionKey,
  parseDesirePermissionKey,
  PROFILE_FIELD_PERMISSIONS,
  type CircleWithDetails,
  type ProfileFieldName,
} from "@/lib/circles";

type CircleFormState = {
  name: string;
  description: string;
  profileFields: ProfileFieldName[];
  desireCategories: string[];
};

const EMPTY_FORM: CircleFormState = {
  name: "",
  description: "",
  profileFields: ["bio"],
  desireCategories: [],
};

function circleToForm(circle: CircleWithDetails): CircleFormState {
  const visiblePermissions = circle.permissions.filter((permission) => permission.visible);

  return {
    name: circle.name,
    description: circle.description,
    profileFields: visiblePermissions
      .map((permission) => permission.fieldName)
      .filter((fieldName): fieldName is ProfileFieldName =>
        PROFILE_FIELD_PERMISSIONS.some((field) => field.key === fieldName)
      ),
    desireCategories: visiblePermissions
      .map((permission) => parseDesirePermissionKey(permission.fieldName))
      .filter((category): category is string => Boolean(category)),
  };
}

function toggleValue(values: string[], value: string, checked: boolean) {
  if (checked) return values.includes(value) ? values : [...values, value];
  return values.filter((item) => item !== value);
}

function PermissionSwitch({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-border/60 bg-background px-3 py-2 md:rounded-lg">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </label>
  );
}

function CircleEditor({
  circle,
  desireCategories,
  onUpdated,
  onDeleted,
}: {
  circle: CircleWithDetails;
  desireCategories: string[];
  onUpdated: (circle: CircleWithDetails) => void;
  onDeleted: (circleId: string) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState(() => circleToForm(circle));
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "adding" | "deleting">("idle");
  const [error, setError] = useState<string | null>(null);

  async function saveCircle(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus("saving");

    const res = await fetch(`/api/circles/${circle.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await res.json().catch(() => null);
    setStatus("idle");

    if (!res.ok) {
      setError(body?.error ?? "Couldn't save this circle.");
      return;
    }

    onUpdated(body.circle);
    router.refresh();
  }

  async function addMember() {
    setError(null);
    setStatus("adding");

    const res = await fetch(`/api/circles/${circle.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const body = await res.json().catch(() => null);
    setStatus("idle");

    if (!res.ok) {
      setError(body?.error ?? "Couldn't add that member.");
      return;
    }

    setUsername("");
    onUpdated({ ...circle, members: [...circle.members, body.member] });
    router.refresh();
  }

  async function removeMember(memberId: string) {
    setError(null);
    const res = await fetch(`/api/circles/${circle.id}/members/${memberId}`, { method: "DELETE" });
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      setError(body?.error ?? "Couldn't remove that member.");
      return;
    }

    onUpdated({
      ...circle,
      members: circle.members.filter((member) => member.id !== memberId),
    });
    router.refresh();
  }

  async function deleteCircle() {
    if (!window.confirm(`Delete ${circle.name}? Members will lose this profile access.`)) {
      return;
    }

    setStatus("deleting");
    const res = await fetch(`/api/circles/${circle.id}`, { method: "DELETE" });
    const body = await res.json().catch(() => null);
    setStatus("idle");

    if (!res.ok) {
      setError(body?.error ?? "Couldn't delete this circle.");
      return;
    }

    onDeleted(circle.id);
    router.refresh();
  }

  return (
    <form onSubmit={saveCircle} className="flex flex-col gap-5 rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:rounded-lg md:shadow-none">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`circle-name-${circle.id}`} className="text-xs font-medium text-muted-foreground">
              Name
            </label>
            <Input
              id={`circle-name-${circle.id}`}
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`circle-description-${circle.id}`}
              className="text-xs font-medium text-muted-foreground"
            >
              Description
            </label>
            <Textarea
              id={`circle-description-${circle.id}`}
              rows={3}
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Members
            </p>
            <div className="flex flex-wrap gap-2">
              {circle.members.length === 0 ? (
                <span className="text-xs text-muted-foreground">No members yet.</span>
              ) : (
                circle.members.map((member) => (
                  <span
                    key={member.id}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border/60 bg-background px-3 text-xs"
                  >
                    @{member.profile.username}
                    <button
                      type="button"
                      onClick={() => removeMember(member.id)}
                      aria-label={`Remove ${member.profile.displayName}`}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-accent"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </span>
                ))
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (username.trim() && status !== "adding") {
                      addMember();
                    }
                  }
                }}
                placeholder="@username"
                aria-label="Username"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-full sm:w-11"
                onClick={addMember}
                disabled={status === "adding" || !username.trim()}
                aria-label="Add member"
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Profile fields
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PROFILE_FIELD_PERMISSIONS.map((field) => (
                <PermissionSwitch
                  key={field.key}
                  label={field.label}
                  description={field.description}
                  checked={form.profileFields.includes(field.key)}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({
                      ...prev,
                      profileFields: toggleValue(prev.profileFields, field.key, checked) as ProfileFieldName[],
                    }))
                  }
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Desire map
            </p>
            {desireCategories.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                Add desires to your profile to control them here.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {desireCategories.map((category) => (
                  <PermissionSwitch
                    key={desirePermissionKey(category)}
                    label={category}
                    checked={form.desireCategories.includes(category)}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({
                        ...prev,
                        desireCategories: toggleValue(prev.desireCategories, category, checked),
                      }))
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="submit" disabled={status !== "idle"} className="w-full gap-1.5 sm:w-auto">
          <Save className="h-4 w-4" aria-hidden="true" />
          {status === "saving" ? "Saving..." : "Save circle"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full gap-1.5 text-destructive sm:w-auto"
          onClick={deleteCircle}
          disabled={status !== "idle"}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
        </Button>
      </div>
    </form>
  );
}

export function CircleManager({
  initialCircles,
  desireCategories,
}: {
  initialCircles: CircleWithDetails[];
  desireCategories: string[];
}) {
  const router = useRouter();
  const [circles, setCircles] = useState(initialCircles);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CircleFormState>(EMPTY_FORM);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  const uniqueDesireCategories = useMemo(() => Array.from(new Set(desireCategories)).sort(), [desireCategories]);

  async function createCircle(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus("saving");

    const res = await fetch("/api/circles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    const body = await res.json().catch(() => null);
    setStatus("idle");

    if (!res.ok) {
      setError(body?.error ?? "Couldn't create this circle.");
      return;
    }

    setCircles((prev) => [...prev, body.circle]);
    setCreateForm(EMPTY_FORM);
    setCreating(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:rounded-lg md:shadow-none">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
            <Eye className="h-5 w-5 text-neon-cyan" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Public baseline</h2>
            <p className="text-xs text-muted-foreground">
              Everyone can see your name, avatar, badges, bio, and public desires.
            </p>
          </div>
        </div>
      </div>

      {circles.length === 0 && !creating && (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:p-10 md:shadow-none">
          No circles yet.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {circles.map((circle) => (
          <CircleEditor
            key={circle.id}
            circle={circle}
            desireCategories={uniqueDesireCategories}
            onUpdated={(updated) =>
              setCircles((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
            }
            onDeleted={(circleId) => setCircles((prev) => prev.filter((item) => item.id !== circleId))}
          />
        ))}
      </div>

      {creating ? (
        <form onSubmit={createCircle} className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:rounded-lg md:shadow-none">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-circle-name" className="text-xs font-medium text-muted-foreground">
                Name
              </label>
              <Input
                id="new-circle-name"
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Close Friends"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="new-circle-description"
                className="text-xs font-medium text-muted-foreground"
              >
                Description
              </label>
              <Input
                id="new-circle-description"
                value={createForm.description}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="People who can see more detail"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" disabled={status === "saving"} className="w-full gap-1.5 sm:w-auto">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {status === "saving" ? "Creating..." : "Create circle"}
            </Button>
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" variant="outline" className="w-full gap-1.5 sm:w-fit" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" /> New circle
        </Button>
      )}
    </div>
  );
}
