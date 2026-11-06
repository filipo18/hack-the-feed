import { useEffect, useState } from "react";
import type { Audience } from "../content";

/**
 * Demo login. It stores the choice in this browser and checks nothing.
 * The creator workspace stays unavailable until POST /api/creator-report is integrated.
 */
export interface Session {
  audience: Audience;
  /** The brand name, or the creator's handle without the @. */
  name: string;
}

const SESSION_KEY = "unpaid.session";

function readJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function readSession(): Session | null {
  return readJson<Session>(SESSION_KEY);
}

export function saveSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

/** Per-account state kept in this browser until the backend stores it. */
export function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readJson<T>(key) ?? initial);

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}
