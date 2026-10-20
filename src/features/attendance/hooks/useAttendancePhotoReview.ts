"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { attendanceEvidenceFingerprint, type AttendancePhotoReviewState } from "@/features/attendance/lib/attendancePhotoReview";
import type { AttendanceAdminTodayRow } from "@/features/attendance/types/attendanceTypes";

export type { AttendancePhotoReviewState } from "@/features/attendance/lib/attendancePhotoReview";

interface ReviewEntry {
  fingerprint: string;
  status: AttendancePhotoReviewState;
}

interface ReviewUndo {
  employeeId: string;
  previous?: ReviewEntry;
}

interface ReviewSnapshot {
  scope: string;
  entries: Map<string, ReviewEntry>;
  undo?: ReviewUndo;
  ready: boolean;
  persistenceAvailable: boolean;
}

interface PhotoReviewOptions {
  ownerAccountId?: string;
  date: string;
  rows: AttendanceAdminTodayRow[];
}

const STORAGE_PREFIX = "attendance-photo-review:v1:";
const MAX_STORED_RECORDS = 5_000;
const MAX_STORED_BYTES = 1_000_000;

function emptySnapshot(scope: string): ReviewSnapshot {
  return { scope, entries: new Map(), ready: false, persistenceAvailable: false };
}

function parseEntries(raw: string | null): Map<string, ReviewEntry> {
  const entries = new Map<string, ReviewEntry>();
  if (!raw || raw.length > MAX_STORED_BYTES) return entries;

  try {
    const payload: unknown = JSON.parse(raw);
    if (!payload || typeof payload !== "object" || !("version" in payload) || payload.version !== 1 ||
      !("entries" in payload) || !Array.isArray(payload.entries) || payload.entries.length > MAX_STORED_RECORDS) {
      return entries;
    }

    for (const entry of payload.entries) {
      if (!entry || typeof entry !== "object" ||
        typeof entry.employeeId !== "string" || !entry.employeeId || entry.employeeId.length > 256 ||
        typeof entry.fingerprint !== "string" || !/^ev1:[0-9a-f]{16}$/.test(entry.fingerprint) ||
        (entry.status !== "reviewed" && entry.status !== "flagged")) continue;

      entries.set(entry.employeeId, { fingerprint: entry.fingerprint, status: entry.status });
    }
  } catch {
    // Unreadable browser storage starts a fresh personal inspection queue.
  }

  return entries;
}

function persistEntries(storageKey: string, entries: Map<string, ReviewEntry>): boolean {
  try {
    const records = [...entries].slice(-MAX_STORED_RECORDS).map(([employeeId, entry]) => ({ employeeId, ...entry }));
    window.localStorage.setItem(storageKey, JSON.stringify({ version: 1, entries: records }));
    return true;
  } catch {
    return false;
  }
}

export function useAttendancePhotoReview({ ownerAccountId, date, rows }: PhotoReviewOptions) {
  const owner = ownerAccountId?.trim();
  const storageKey = owner && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? `${STORAGE_PREFIX}${encodeURIComponent(owner)}:${date}`
    : undefined;
  const scope = storageKey ?? `${STORAGE_PREFIX}memory:${encodeURIComponent(date)}`;
  const [snapshot, setSnapshot] = useState<ReviewSnapshot>(() => emptySnapshot(scope));
  const snapshotRef = useRef(snapshot);
  const fingerprints = useMemo(() => new Map(rows.map((row) => [row.employeeId, attendanceEvidenceFingerprint(row)])), [rows]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let entries = new Map<string, ReviewEntry>();
      let persistenceAvailable = false;
      if (storageKey) {
        try {
          entries = parseEntries(window.localStorage.getItem(storageKey));
          persistenceAvailable = true;
        } catch {
          // The inspection flow still works in memory when browser storage is blocked.
        }
      }
      const next = { scope, entries, ready: true, persistenceAvailable };
      snapshotRef.current = next;
      setSnapshot(next);
    }, 0);

    const onStorage = (event: StorageEvent) => {
      if (!storageKey || (event.key !== storageKey && event.key !== null)) return;
      try {
        if (event.storageArea !== window.localStorage) return;
      } catch {
        return;
      }
      const next: ReviewSnapshot = {
        scope,
        entries: parseEntries(event.key === null ? null : event.newValue),
        ready: true,
        persistenceAvailable: true
      };
      snapshotRef.current = next;
      setSnapshot(next);
    };
    if (storageKey) window.addEventListener("storage", onStorage);

    return () => {
      window.clearTimeout(timer);
      if (storageKey) window.removeEventListener("storage", onStorage);
    };
  }, [scope, storageKey]);

  // A late upload or edited attendance event must reappear as unseen, even if it later changes again.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = snapshotRef.current;
      if (current.scope !== scope || !current.ready) return;
      const entries = new Map(current.entries);
      let changed = false;
      for (const [employeeId, entry] of entries) {
        const fingerprint = fingerprints.get(employeeId);
        if (fingerprint && fingerprint !== entry.fingerprint) {
          entries.delete(employeeId);
          changed = true;
        }
      }
      if (!changed) return;
      const persistenceAvailable = storageKey && current.persistenceAvailable
        ? persistEntries(storageKey, entries)
        : false;
      const next = { ...current, entries, undo: undefined, persistenceAvailable };
      snapshotRef.current = next;
      setSnapshot(next);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [scope, storageKey, fingerprints, snapshot.ready]);

  const getReviewState = useCallback((row: AttendanceAdminTodayRow): AttendancePhotoReviewState | undefined => {
    if (snapshot.scope !== scope || !snapshot.ready) return undefined;
    const entry = snapshot.entries.get(row.employeeId);
    return entry?.fingerprint === attendanceEvidenceFingerprint(row) ? entry.status : undefined;
  }, [scope, snapshot]);

  const setReviewState = useCallback((row: AttendanceAdminTodayRow, status?: AttendancePhotoReviewState) => {
    const current = snapshotRef.current;
    const fingerprint = attendanceEvidenceFingerprint(row);
    if (current.scope !== scope || !current.ready || fingerprints.get(row.employeeId) !== fingerprint) return;

    const previous = current.entries.get(row.employeeId);
    if ((!status && !previous) || (previous?.fingerprint === fingerprint && previous.status === status)) return;
    const entries = new Map(current.entries);
    if (status) {
      entries.delete(row.employeeId);
      entries.set(row.employeeId, { fingerprint, status });
    }
    else entries.delete(row.employeeId);

    const persistenceAvailable = storageKey && current.persistenceAvailable
      ? persistEntries(storageKey, entries)
      : false;
    const next: ReviewSnapshot = {
      ...current,
      entries,
      undo: { employeeId: row.employeeId, previous },
      persistenceAvailable
    };
    snapshotRef.current = next;
    setSnapshot(next);
  }, [scope, storageKey, fingerprints]);

  const undo = useCallback(() => {
    const current = snapshotRef.current;
    if (current.scope !== scope || !current.ready || !current.undo) return;
    const entries = new Map(current.entries);
    const { employeeId, previous } = current.undo;
    // Restoring the old decision is valid only while that employee's evidence remains the same.
    if (previous && fingerprints.get(employeeId) === previous.fingerprint) entries.set(employeeId, previous);
    else entries.delete(employeeId);

    const persistenceAvailable = storageKey && current.persistenceAvailable
      ? persistEntries(storageKey, entries)
      : false;
    const next = { ...current, entries, undo: undefined, persistenceAvailable };
    snapshotRef.current = next;
    setSnapshot(next);
  }, [scope, storageKey, fingerprints]);

  return {
    getReviewState,
    setReviewState,
    undo,
    canUndo: snapshot.scope === scope && Boolean(snapshot.undo),
    persistenceAvailable: snapshot.scope === scope && snapshot.persistenceAvailable,
    ready: snapshot.scope === scope && snapshot.ready
  };
}
