"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clientGet } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/Toast";
import { addDonation } from "@/app/(app)/pay-it-forward/actions";
import type { Alumni, AlumniPage } from "@/types/alumni";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;
const MAX_MATCHES = 8;

function displayName(a: Alumni): string {
  const first = a.preferred_first_name ?? a.first_name ?? "";
  return [first, a.last_name].filter(Boolean).join(" ") || "—";
}

/**
 * Super-admin quick-add for a single donation: pick an alumnus (debounced search
 * by name / Net ID), enter amount + year (+ optional month / notes), submit.
 * The backend (super_admin) is the source of truth for the write.
 */
export function QuickAddDonation() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Alumni | null>(null);
  const [amount, setAmount] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Search state.
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<Alumni[]>([]);
  const [searching, setSearching] = useState(false);
  const seqRef = useRef(0);

  const reset = () => {
    setPicked(null);
    setAmount("");
    setYear("");
    setMonth("");
    setNotes("");
    setQ("");
    setMatches([]);
    setError(null);
  };

  useEffect(() => {
    if (picked) return;
    const term = q.trim();
    if (term.length < MIN_CHARS) {
      seqRef.current++;
      setMatches([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const seq = ++seqRef.current;
    const timer = setTimeout(async () => {
      try {
        const page = await clientGet<AlumniPage>(
          `/alumni?q=${encodeURIComponent(term)}&limit=${MAX_MATCHES}&offset=0`,
        );
        if (seq !== seqRef.current) return;
        setMatches(page.items);
      } catch {
        if (seq === seqRef.current) setMatches([]);
      } finally {
        if (seq === seqRef.current) setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q, picked]);

  const onSubmit = () => {
    setError(null);
    if (!picked) {
      setError("Pick an alumnus first.");
      return;
    }
    const yearNum = Number(year);
    if (!year || !Number.isInteger(yearNum)) {
      setError("Enter a valid year.");
      return;
    }
    if (!amount.trim()) {
      setError("Enter an amount.");
      return;
    }
    const monthNum = month ? Number(month) : undefined;
    start(async () => {
      const res = await addDonation(picked.alumni_id, {
        amount: amount.trim(),
        year: yearNum,
        month: monthNum,
        notes: notes.trim() || undefined,
      });
      if (res.ok) {
        toast.success(`Donation added for ${displayName(picked)}.`);
        setOpen(false);
        reset();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <>
      <Button
        variant="primary"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        Add donation
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent
          title="Add a donation"
          description="Record a Pay It Forward gift for an alumnus."
        >
          <DialogBody className="space-y-4">
            {/* Alumni picker */}
            {picked ? (
              <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="text-sm font-medium text-gray-900">
                  {displayName(picked)}
                  {picked.net_id ? (
                    <span className="ml-2 text-xs text-gray-500">
                      {picked.net_id}
                    </span>
                  ) : null}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <div>
                <Label htmlFor="donor-search">Alumnus</Label>
                <Input
                  id="donor-search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by name or Net ID…"
                  autoComplete="off"
                />
                {q.trim().length >= MIN_CHARS && (
                  <ul className="mt-1 max-h-48 overflow-auto rounded-md border border-gray-200">
                    {searching ? (
                      <li className="px-3 py-2 text-sm text-gray-500">Searching…</li>
                    ) : matches.length === 0 ? (
                      <li className="px-3 py-2 text-sm text-gray-500">
                        No matches.
                      </li>
                    ) : (
                      matches.map((a) => (
                        <li key={a.alumni_id}>
                          <button
                            type="button"
                            onClick={() => {
                              setPicked(a);
                              setMatches([]);
                            }}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                          >
                            <span className="font-medium text-gray-900">
                              {displayName(a)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {a.net_id ??
                                (a.graduation_year
                                  ? `Class of ${a.graduation_year}`
                                  : "")}
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="donation-amount">Amount (USD)</Label>
                <Input
                  id="donation-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="250.00"
                />
              </div>
              <div>
                <Label htmlFor="donation-year">Year</Label>
                <Input
                  id="donation-year"
                  inputMode="numeric"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="2026"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="donation-month">Month (optional)</Label>
                <Input
                  id="donation-month"
                  inputMode="numeric"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  placeholder="1–12"
                />
              </div>
              <div>
                <Label htmlFor="donation-notes">Notes (optional)</Label>
                <Input
                  id="donation-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Annual fund"
                />
              </div>
            </div>

            {error && (
              <p className="rounded-md border border-danger-600/30 bg-danger-50 px-3 py-2 text-sm text-danger-600">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={onSubmit} disabled={pending}>
              {pending ? "Adding…" : "Add donation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
