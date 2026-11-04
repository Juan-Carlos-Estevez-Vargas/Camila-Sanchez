import { useState } from "react";
import type { AuditEntry } from "@/domain/types";
import { AdminPage } from "@/features/admin/AdminLayout";
import { useBackend } from "@/state/BackendContext";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { Modal } from "@/ui/Modal";
import { useAsync } from "@/ui/useAsync";
import { dateFormat, useT } from "@/i18n";

const PAGE_SIZE = 25;

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
  const i18n = useT();
  const t = i18n.superAdmin.audit;
  const TABLES = t.tables;
  const when = dateFormat({ dateStyle: "short", timeStyle: "short" });
  const { data: rows, loading } = useAsync(
    () => Promise.all([backend.users.listAudit({ page, pageSize: PAGE_SIZE, table: table || undefined }), backend.users.listProfiles()]),
    [backend, page, table],
  );
  const [entries = [], profiles = []] = rows ?? [];
  const nameOf = (id: string | null) => (id ? profiles.find((p) => p.id === id)?.displayName ?? i18n.common.someone : t.system);

  return (
    <AdminPage title={t.title} description={t.description}>
      <div className="row">
        <select className="select" style={{ width: "auto" }} value={table} aria-label={t.filter}
          onChange={(e) => { setTable(e.target.value); setPage(0); }}>
          {Object.entries(TABLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {loading && !rows ? <PageLoader /> : entries.length === 0 ? <EmptyState icon="📜" title={t.empty} /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{t.when}</th><th>{t.who}</th><th>{t.what}</th><th>{t.fields}</th><th /></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>{when.format(new Date(e.createdAt))}</td>
                  <td>{nameOf(e.actorId)}</td>
                  <td>{t.actions[e.action]} <strong>{TABLES[e.tableName] ?? e.tableName}</strong></td>
                  <td className="muted">{changedKeys(e).join(", ") || "—"}</td>
                  <td><button className="btn btn--sm btn--ghost" onClick={() => setDetail(e)}>{t.view}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="row" style={{ justifyContent: "center" }}>
        <button className="btn btn--sm btn--ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{t.previous}</button>
        <span className="muted">{t.page(page + 1)}</span>
        <button className="btn btn--sm btn--ghost" disabled={entries.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>{t.next}</button>
      </div>
      {detail && (
        <Modal wide title={t.detail} onClose={() => setDetail(null)}>
          <div className="form-grid">
            <div><strong>{t.before}</strong><pre className="json">{JSON.stringify(detail.oldData, null, 2) ?? "—"}</pre></div>
            <div><strong>{t.after}</strong><pre className="json">{JSON.stringify(detail.newData, null, 2) ?? "—"}</pre></div>
          </div>
        </Modal>
      )}
    </AdminPage>
  );
}
