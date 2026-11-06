import { useEffect, useState } from "react";
import type { Audience } from "../content";

/**
 * Demo login. It stores the choice in this browser and checks nothing.
 * Swap this file for real auth when the backend has it.
 */
export interface Session {
  audience: Audience;
  /** The brand name, or the creator's handle without the @. */
  name: string;
}

const SESSION_KEY = "unpaid.session";

export function readSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as Session) : null;
}

export function saveSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

/** Per-account state kept in this browser until the backend stores it. */
export function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : initial;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}
