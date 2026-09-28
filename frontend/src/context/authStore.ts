import type { Role } from '../api/types';

/**
 * Plain (non-React) store for "who is using the app right now".
 *
 * The real backend resolves the caller from the `X-Max-Init-Data` header
 * (see maxBridge.ts) — this repo has no server, so there is nothing to
 * resolve it against. Instead this store holds a dev-only role switch
 * (Employee/Manager/Accountant/Admin) plus an `isLinked` flag to demo the
 * `GET /me` → 403 `NOT_LINKED` → Connect screen flow.
 *
 * Kept outside React so api/mockApi.ts can read it synchronously without
 * depending on hooks; useAuth() below wraps it for components.
 */

export type Persona = {
  role: Role;
  isLinked: boolean;
};

const STORAGE_KEY = 'smena.dev-persona';

function loadInitial(): Persona {
  if (typeof window === 'undefined') return { role: 'employee', isLinked: true };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Persona;
  } catch {
    /* ignore malformed storage */
  }
  return { role: 'employee', isLinked: true };
}

let state: Persona = loadInitial();
const listeners = new Set<() => void>();

export function getPersona(): Persona {
  return state;
}

export function setPersona(next: Partial<Persona>) {
  state = { ...state, ...next };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
