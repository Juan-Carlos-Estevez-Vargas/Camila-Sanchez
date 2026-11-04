import { roleLabel } from "@/domain/permissions";
import type { Role } from "@/domain/types";
import { AdminPage } from "@/features/admin/AdminLayout";
import { useSaver } from "@/features/admin/useSaver";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { PageLoader } from "@/ui/Feedback";
import { useAsync } from "@/ui/useAsync";
import { useT } from "@/i18n";

const EDITABLE_ROLES: Role[] = ["editor", "viewer"];

/** Matriz de permisos por rol. El super administrador siempre tiene todos. */
export default function RolesAdmin() {
  const backend = useBackend();
  const { refresh } = useAuth();
  const { run } = useSaver();
  const t = useT().superAdmin.roles;
  const { data, loading, reload } = useAsync(
    () => Promise.all([backend.users.listPermissions(), backend.users.listRolePermissions()]),
    [backend],
  );

  if (loading && !data) return <PageLoader />;
  const [permissions = [], grants = []] = data ?? [];
  const has = (role: Role, key: string) => grants.some((g) => g.role === role && g.permission === key);

  return (
    <AdminPage title={t.title} description={t.description}>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t.permission}</th>
              <th className="center">{roleLabel("super_admin")}</th>
              {EDITABLE_ROLES.map((r) => <th key={r} className="center">{roleLabel(r)}</th>)}
            </tr>
          </thead>
          <tbody>
            {permissions.map((p) => {
              const description = t.permissions[p.key] ?? p.description;
              return (
              <tr key={p.key}>
                <td><strong>{description}</strong><div className="muted" style={{ fontSize: "0.78rem" }}><code>{p.key}</code></div></td>
                <td className="center" title={t.always}>✅</td>
                {EDITABLE_ROLES.map((role) => (
                  <td key={role} className="center">
                    <input type="checkbox" checked={has(role, p.key)} aria-label={t.forRole(description, roleLabel(role))}
                      onChange={async (e) => {
                        await run(() => backend.users.setRolePermission(role, p.key, e.target.checked), t.updated);
                        await reload();
                        await refresh();
                      }} />
                  </td>
                ))}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminPage>
  );
}
