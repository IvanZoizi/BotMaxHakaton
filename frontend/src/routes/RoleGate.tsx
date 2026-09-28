import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePersona } from '../context/AuthContext';
import type { Role } from '../api/types';

/** Redirects to the right home if the dev persona's role doesn't match the route's section. */
export function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const persona = usePersona();
  if (!persona.isLinked) return <Navigate to="/connect" replace />;
  if (persona.role !== role) return <Navigate to={`/${persona.role}`} replace />;
  return <>{children}</>;
}
