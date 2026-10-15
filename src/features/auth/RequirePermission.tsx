import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { AccessPolicy } from "@/domain/permissions";
import { useAuth } from "@/state/AuthContext";
import { EmptyState, PageLoader } from "@/ui/Feedback";

/** Protege una ruta: sin sesión manda a /entrar; sin permiso muestra aviso. */
export function RequirePermission({ check, children }: { check: (policy: AccessPolicy) => boolean; children: ReactNode }) {
  const { loading, user, policy } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to={`/entrar?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (!check(policy)) return <EmptyState icon="🔒" title="Esta parte no está disponible para tu cuenta" />;
  return <>{children}</>;
}
