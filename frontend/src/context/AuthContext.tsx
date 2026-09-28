import { useSyncExternalStore } from 'react';
import type { Role } from '../api/types';
import { ME_BY_ROLE } from '../api/fixtures';
import { getPersona, setPersona, subscribe } from './authStore';

export function usePersona() {
  const persona = useSyncExternalStore(subscribe, getPersona, getPersona);
  return {
    ...persona,
    me: ME_BY_ROLE[persona.role],
    setRole: (role: Role) => setPersona({ role }),
    setLinked: (isLinked: boolean) => setPersona({ isLinked }),
  };
}
