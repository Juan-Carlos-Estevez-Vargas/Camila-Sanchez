import { useMemo, useState } from "react";
import type { AuditEntry } from "@/domain/types";
import { ALL_MONTHS, monthKeyOf, monthRange, recentMonths, type MonthKey } from "@/domain/audit";
import { pageCount } from "@/domain/pagination";
import { AdminPage } from "@/features/admin/AdminLayout";
import { useBackend } from "@/state/BackendContext";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { Field } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { Pagination } from "@/ui/Pagination";
import { useAsync } from "@/ui/useAsync";
import { dateFormat, useT } from "@/i18n";

const PAGE_SIZES = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;
/** Cuántos meses hacia atrás ofrece el desplegable (además de "Todo el historial"). */
const MONTHS_BACK = 24;
const ACTIONS: AuditEntry["action"][] = ["INSERT", "UPDATE", "DELETE"];

interface Filters {
  /** "AAAA-MM" o ALL_MONTHS. Por defecto, el mes actual. */
  month: MonthKey;
  table: string;
  actorId: string;
  action: "" | AuditEntry["action"];
  order: "desc" | "asc";
}

const defaults = (): Filters => ({ month: monthKeyOf(new Date()), table: "", actorId: "", action: "", order: "desc" });

/** Diferencia superficial entre la versión anterior y la nueva. */
function changedKeys(entry: AuditEntry): string[] {
  if (!entry.oldData || !entry.newData) return [];
  return Object.keys(entry.newData).filter(
    (k) => k !== "updated_at" && k !== "updatedAt" && JSON.stringify(entry.oldData?.[k]) !== JSON.stringify(entry.newData?.[k]),
  );
}

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

export default function AuditAdmin() {
  const backend = useBackend();
  const [filters, setFilters] = useState<Filters>(defaults);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [detail, setDetail] = useState<AuditEntry | null>(null);
  const i18n = useT();
  const t = i18n.superAdmin.audit;
  const TABLES = t.tables;
  const when = dateFormat({ dateStyle: "short", timeStyle: "short" });
  const monthName = dateFormat({ month: "long", year: "numeric" });

  const months = useMemo(() => recentMonths(new Date(), MONTHS_BACK), []);
  const currentMonth = months[0];
  const labelOf = (key: MonthKey) => capitalize(monthName.format(new Date(monthRange(key).from)));

  const { data: profiles = [] } = useAsync(() => backend.users.listProfiles(), [backend]);
  const { data: result, loading } = useAsync(() => {
    const range = filters.month === ALL_MONTHS ? {} : monthRange(filters.month);
    return backend.users.listAudit({
      page, pageSize, order: filters.order, ...range,
      table: filters.table || undefined,
      actorId: filters.actorId || undefined,
      action: filters.action || undefined,
    });
  }, [backend, page, pageSize, filters]);

  const entries = result?.entries ?? [];
  const total = result?.total ?? 0;
  const nameOf = (id: string | null) => (id ? profiles.find((p) => p.id === id)?.displayName ?? i18n.common.someone : t.system);
  const people = [...profiles].sort((a, b) => a.displayName.localeCompare(b.displayName));
  const isDefault = JSON.stringify(filters) === JSON.stringify(defaults());

  const change = (patch: Partial<Filters>) => { setFilters((f) => ({ ...f, ...patch })); setPage(0); };
  // Si los filtros dejan menos páginas, no quedarse en una que ya no existe.
  const pages = pageCount(total, pageSize);
  if (result && page > pages - 1) setPage(pages - 1);

  return (
    <AdminPage title={t.title} description={t.description}>
      <fieldset className="audit-filters">
        <legend className="visually-hidden">{t.filters}</legend>
        <Field label={t.month}>
          {(id) => (
            <select id={id} className="select" value={filters.month} onChange={(e) => change({ month: e.target.value })}>
              {months.map((m) => <option key={m} value={m}>{m === currentMonth ? t.thisMonth(labelOf(m)) : labelOf(m)}</option>)}
              <option value={ALL_MONTHS}>{t.allMonths}</option>
            </select>
          )}
        </Field>
        <Field label={t.section}>
          {(id) => (
            <select id={id} className="select" value={filters.table} onChange={(e) => change({ table: e.target.value })}>
              {Object.entries(TABLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          )}
        </Field>
        <Field label={t.action}>
          {(id) => (
            <select id={id} className="select" value={filters.action} onChange={(e) => change({ action: e.target.value as Filters["action"] })}>
              <option value="">{t.allActions}</option>
              {ACTIONS.map((a) => <option key={a} value={a}>{t.actionNames[a]}</option>)}
            </select>
          )}
        </Field>
        <Field label={t.person}>
          {(id) => (
            <select id={id} className="select" value={filters.actorId} onChange={(e) => change({ actorId: e.target.value })}>
              <option value="">{t.everyone}</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.displayName || i18n.common.someone}</option>)}
              <option value="system">{t.system}</option>
            </select>
          )}
        </Field>
        <Field label={t.order}>
          {(id) => (
            <select id={id} className="select" value={filters.order} onChange={(e) => change({ order: e.target.value as Filters["order"] })}>
              <option value="desc">{t.newest}</option>
              <option value="asc">{t.oldest}</option>
            </select>
          )}
        </Field>
        <button type="button" className="btn btn--sm btn--ghost audit-filters__clear" disabled={isDefault}
          onClick={() => { setFilters(defaults()); setPage(0); }}>
          {t.clear}
        </button>
      </fieldset>

      {loading && !result ? <PageLoader /> : entries.length === 0 ? (
        <EmptyState icon="📜" title={isDefault ? t.empty : t.emptyFiltered}>
          {filters.month === currentMonth && <p className="muted">{t.emptyMonth}</p>}
        </EmptyState>
      ) : (
        <div className="table-wrap" aria-busy={loading}>
          <table className="table">
            <thead>
              <tr>
                <th aria-sort={filters.order === "desc" ? "descending" : "ascending"}>
                  <button type="button" className="audit-sort" onClick={() => change({ order: filters.order === "desc" ? "asc" : "desc" })}
                    aria-label={`${t.when}: ${filters.order === "desc" ? t.oldest : t.newest}`}>
                    {t.when} <span aria-hidden>{filters.order === "desc" ? "↓" : "↑"}</span>
                  </button>
                </th>
                <th>{t.who}</th><th>{t.what}</th><th>{t.fields}</th><th />
              </tr>
            </thead>
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
      {total > 0 && (
        <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage}
          pageSizes={PAGE_SIZES} onPageSize={(n) => { setPageSize(n); setPage(0); }} />
      )}
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
