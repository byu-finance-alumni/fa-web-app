"use client";

import { useState, useTransition } from "react";
import {
  createPreset,
  updatePreset,
  deletePreset,
} from "@/app/(app)/admin/quick-filters/actions";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DashboardPreset } from "@/types/dashboardPresets";

// A preset link must be a relative in-app path (the backend enforces this too).
const isValidHref = (v: string) => {
  const h = v.trim();
  return h.startsWith("/") && !h.startsWith("//") && !h.startsWith("/\\");
};

/**
 * Engineer / super-admin editor for the dashboard quick-filter presets shown on
 * the Quick search tab. Add, edit (label / link / order), and remove rows. The
 * page is role-gated and the backend re-enforces every write; this just drives
 * the requests and surfaces results via the toast. Text-only controls per the
 * design preference (no icons).
 */
export function QuickFiltersManager({
  presets,
}: {
  presets: DashboardPreset[];
}) {
  return (
    <div className="space-y-3">
      {presets.length === 0 ? (
        <Card className="p-6 text-center text-sm text-gray-500">
          No quick filters yet. Add one below — it’ll show on the dashboard Quick
          search tab.
        </Card>
      ) : (
        presets.map((p) => (
          <PresetRow key={p.dashboard_preset_id} preset={p} />
        ))
      )}
      <AddPresetRow />
    </div>
  );
}

function PresetRow({ preset }: { preset: DashboardPreset }) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState(preset.label);
  const [href, setHref] = useState(preset.href);
  const [sort, setSort] = useState(String(preset.sort_order));

  const dirty =
    label !== preset.label ||
    href !== preset.href ||
    sort !== String(preset.sort_order);
  const hrefInvalid = href.trim().length > 0 && !isValidHref(href);

  function save() {
    if (!dirty || hrefInvalid || !label.trim()) return;
    startTransition(async () => {
      const res = await updatePreset(preset.dashboard_preset_id, {
        label: label.trim(),
        href: href.trim(),
        sort_order: Number(sort) || 0,
      });
      if (res?.error) toast.error(res.error);
      else toast.success("Quick filter updated.");
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deletePreset(preset.dashboard_preset_id);
      if (res?.error) toast.error(res.error);
      else toast.success(`Removed “${preset.label}”.`);
    });
  }

  return (
    <Card className="p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_5rem]">
        <label className="block">
          <Label className="mb-1">Label</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="block">
          <Label className="mb-1">Link</Label>
          <Input
            value={href}
            onChange={(e) => setHref(e.target.value)}
            aria-invalid={hrefInvalid || undefined}
            className={
              hrefInvalid
                ? "border-danger-600 focus-visible:ring-danger-500"
                : undefined
            }
          />
          {hrefInvalid ? (
            <p className="mt-1 text-xs text-danger-600">
              Must be a relative path, e.g. /alumni?cfa=1&amp;state=UT
            </p>
          ) : null}
        </label>
        <label className="block">
          <Label className="mb-1">Order</Label>
          <Input
            type="number"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="tabular-nums"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={remove}
          disabled={pending}
          className="border-danger-600/40 text-danger-600 hover:bg-danger-50"
        >
          Remove
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={!dirty || hrefInvalid || !label.trim() || pending}
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}

function AddPresetRow() {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [href, setHref] = useState("");

  const hrefInvalid = href.trim().length > 0 && !isValidHref(href);
  const ready = label.trim() && isValidHref(href);

  function add() {
    if (!ready) return;
    startTransition(async () => {
      const res = await createPreset({
        label: label.trim(),
        href: href.trim(),
      });
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("Quick filter added.");
        setLabel("");
        setHref("");
      }
    });
  }

  return (
    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Add a quick filter
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          placeholder="Label (e.g. CFAs near Salt Lake City)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <div>
          <Input
            placeholder="/alumni?cfa=1&city=Salt%20Lake%20City"
            value={href}
            onChange={(e) => setHref(e.target.value)}
            aria-invalid={hrefInvalid || undefined}
            className={
              hrefInvalid
                ? "border-danger-600 focus-visible:ring-danger-500"
                : undefined
            }
          />
          {hrefInvalid ? (
            <p className="mt-1 text-xs text-danger-600">
              Must be a relative path, e.g. /alumni?...
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          variant="navy"
          size="sm"
          onClick={add}
          disabled={!ready || pending}
        >
          {pending ? "Adding…" : "Add quick filter"}
        </Button>
      </div>
    </div>
  );
}
