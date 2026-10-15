import { ROLE_LABELS } from "@/domain/permissions";
import type { Role } from "@/domain/types";
import { AdminPage } from "@/features/admin/AdminLayout";
import { useSaver } from "@/features/admin/useSaver";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { PageLoader } from "@/ui/Feedback";
import { useAsync } from "@/ui/useAsync";

const EDITABLE_ROLES: Role[] = ["editor", "viewer"];

/** Matriz de permisos por rol. El super administrador siempre tiene todos. */
export default function RolesAdmin() {
  const backend = useBackend();
  const { refresh } = useAuth();
  const { run } = useSaver();
  const { data, loading, reload } = useAsync(
    () => Promise.all([backend.users.listPermissions(), backend.users.listRolePermissions()]),
    [backend],
  );

  if (loading && !data) return <PageLoader />;
  const [permissions = [], grants = []] = data ?? [];
  const has = (role: Role, key: string) => grants.some((g) => g.role === role && g.permission === key);

  return (
    <AdminPage title="Roles y permisos" description="Decide qué puede hacer cada rol. Los cambios aplican al instante y la base de datos los hace cumplir.">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Permiso</th>
              <th className="center">{ROLE_LABELS.super_admin}</th>
              {EDITABLE_ROLES.map((r) => <th key={r} className="center">{ROLE_LABELS[r]}</th>)}
            </tr>
          </thead>
          <tbody>
            {permissions.map((p) => (
              <tr key={p.key}>
                <td><strong>{p.description}</strong><div className="muted" style={{ fontSize: "0.78rem" }}><code>{p.key}</code></div></td>
                <td className="center" title="Siempre tiene todos los permisos">✅</td>
                {EDITABLE_ROLES.map((role) => (
                  <td key={role} className="center">
                    <input type="checkbox" checked={has(role, p.key)} aria-label={`${p.description} para ${ROLE_LABELS[role]}`}
                      onChange={async (e) => {
                        await run(() => backend.users.setRolePermission(role, p.key, e.target.checked), "Permiso actualizado");
                        await reload();
                        await refresh();
                      }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPage>
  );
}
