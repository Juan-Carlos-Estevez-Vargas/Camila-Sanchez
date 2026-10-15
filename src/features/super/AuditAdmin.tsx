import { useState } from "react";
import type { AuditEntry } from "@/domain/types";
import { AdminPage } from "@/features/admin/AdminLayout";
import { useBackend } from "@/state/BackendContext";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { Modal } from "@/ui/Modal";
import { useAsync } from "@/ui/useAsync";

const PAGE_SIZE = 25;
const TABLES: Record<string, string> = {
  "": "Todo",
  profiles: "Usuarios",
  role_permissions: "Permisos",
  site_settings: "Ajustes y tema",
  sections: "Secciones",
  photos: "Fotos",
  milestones: "Hitos",
  important_dates: "Fechas",
  interruptions: "Sorpresas",
};
const ACTIONS: Record<AuditEntry["action"], string> = { INSERT: "creó", UPDATE: "cambió", DELETE: "borró" };

/** Diferencia superficial entre la versión anterior y la nueva. */
function changedKeys(entry: AuditEntry): string[] {
  if (!entry.oldData || !entry.newData) return [];
  return Object.keys(entry.newData).filter(
    (k) => k !== "updated_at" && k !== "updatedAt" && JSON.stringify(entry.oldData?.[k]) !== JSON.stringify(entry.newData?.[k]),
  );
}

export default function AuditAdmin() {
  const backend = useBackend();
  const [page, setPage] = useState(0);
  const [table, setTable] = useState("");
  const [detail, setDetail] = useState<AuditEntry | null>(null);
  const { data: rows, loading } = useAsync(
    () => Promise.all([backend.users.listAudit({ page, pageSize: PAGE_SIZE, table: table || undefined }), backend.users.listProfiles()]),
    [backend, page, table],
  );
  const [entries = [], profiles = []] = rows ?? [];
  const nameOf = (id: string | null) => (id ? profiles.find((p) => p.id === id)?.displayName ?? "Alguien" : "Sistema");

  return (
    <AdminPage title="Auditoría" description="Quién cambió qué y cuándo. Los mensajes privados no se registran.">
      <div className="row">
        <select className="select" style={{ width: "auto" }} value={table} aria-label="Filtrar por tipo"
          onChange={(e) => { setTable(e.target.value); setPage(0); }}>
          {Object.entries(TABLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {loading && !rows ? <PageLoader /> : entries.length === 0 ? <EmptyState icon="📜" title="Sin registros" /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th><th>Campos</th><th /></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>{new Date(e.createdAt).toLocaleString("es-CO")}</td>
                  <td>{nameOf(e.actorId)}</td>
                  <td>{ACTIONS[e.action]} <strong>{TABLES[e.tableName] ?? e.tableName}</strong></td>
                  <td className="muted">{changedKeys(e).join(", ") || "—"}</td>
                  <td><button className="btn btn--sm btn--ghost" onClick={() => setDetail(e)}>Ver</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="row" style={{ justifyContent: "center" }}>
        <button className="btn btn--sm btn--ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Anteriores</button>
        <span className="muted">Página {page + 1}</span>
        <button className="btn btn--sm btn--ghost" disabled={entries.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>Siguientes →</button>
      </div>
      {detail && (
        <Modal wide title="Detalle del cambio" onClose={() => setDetail(null)}>
          <div className="form-grid">
            <div><strong>Antes</strong><pre className="json">{JSON.stringify(detail.oldData, null, 2) ?? "—"}</pre></div>
            <div><strong>Después</strong><pre className="json">{JSON.stringify(detail.newData, null, 2) ?? "—"}</pre></div>
          </div>
        </Modal>
      )}
    </AdminPage>
  );
}
