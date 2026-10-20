"use client";

const localTails = new Map<string, Promise<void>>();

interface AsyncLockManager {
  request<T>(name: string, options: { mode: "exclusive" }, task: () => Promise<T>): Promise<T>;
}

async function withLocalLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = localTails.get(key) ?? Promise.resolve();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => gate);
  localTails.set(key, tail);
  await previous;
  try {
    return await task();
  } finally {
    release();
    if (localTails.get(key) === tail) localTails.delete(key);
  }
}

export function withAttendanceSyncLock<T>(accountId: string, task: () => Promise<T>): Promise<T> {
  const key = `ct-attendance-sync:${accountId}`;
  if (typeof navigator !== "undefined" && navigator.locks) {
    const locks = navigator.locks as unknown as AsyncLockManager;
    return locks.request(key, { mode: "exclusive" }, task);
  }
  return withLocalLock(key, task);
}
