import { useMemo, useState } from "react";
import type { ActivitySession } from "@/domain/types";
import { ALL_MONTHS, monthKeyOf, monthRange, recentMonths, type MonthKey } from "@/domain/audit";
import { formatDuration, type ActivityFilters } from "@/domain/activity";
import { pageCount } from "@/domain/pagination";
import { useBackend } from "@/state/BackendContext";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { Field } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { Pagination } from "@/ui/Pagination";
import { useAsync } from "@/ui/useAsync";
import { dateFormat, useT } from "@/i18n";

const PAGE_SIZES = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;
const MONTHS_BACK = 24;

const DEVICE_ICON: Record<ActivitySession["device"]["kind"], string> = {
  phone: "📱", tablet: "📲", computer: "💻",
};

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

/**
 * Pestaña «Actividad»: cuándo entra cada persona, qué secciones mira, cuánto
 * tiempo y desde qué dispositivo. Usa los mismos filtros que la auditoría (mes
 * y persona). No se le muestra ningún aviso a nadie dentro de la app.
 */
export function ActivityPanel() {
  const backend = useBackend();
  const i18n = useT();
  const t = i18n.superAdmin.activity;
  const ta = i18n.superAdmin.audit;

  const [month, setMonth] = useState<MonthKey>(() => monthKeyOf(new Date()));
  const [actorId, setActorId] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [openSession, setOpenSession] = useState<ActivitySession | null>(null);

  const when = dateFormat({ dateStyle: "short", timeStyle: "short" });
  const monthName = dateFormat({ month: "long", year: "numeric" });

  const months = useMemo(() => recentMonths(new Date(), MONTHS_BACK), []);
  const currentMonth = months[0];
  const labelOf = (key: MonthKey) => capitalize(monthName.format(new Date(monthRange(key).from)));

  const filters: ActivityFilters = useMemo(
    () => ({ userId: actorId || undefined, ...(month === ALL_MONTHS ? {} : monthRange(month)) }),
    [actorId, month],
  );

  const { data: profiles = [] } = useAsync(() => backend.users.listProfiles(), [backend]);
  const { data: summary } = useAsync(() => backend.activity.summary(filters), [backend, filters]);
  const { data: result, loading } = useAsync(
    () => backend.activity.listSessions({ page, pageSize, ...filters }),
    [backend, page, pageSize, filters],
  );

  const sessions = result?.sessions ?? [];
  const total = result?.total ?? 0;
  const people = [...profiles].sort((a, b) => a.displayName.localeCompare(b.displayName));
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.displayName ?? i18n.common.someone;
  const sectionName = (key: string) => t.sections[key] ?? key;
  const isDefault = month === currentMonth && !actorId;

  const pages = pageCount(total, pageSize);
  if (result && page > pages - 1) setPage(pages - 1);

  const maxSeconds = summary?.bySection[0]?.seconds ?? 0;

  return (
    <>
      <fieldset className="audit-filters">
        <legend className="visually-hidden">{ta.filters}</legend>
        <Field label={ta.month}>
          {(id) => (
            <select id={id} className="select" value={month} onChange={(e) => { setMonth(e.target.value); setPage(0); }}>
              {months.map((m) => <option key={m} value={m}>{m === currentMonth ? ta.thisMonth(labelOf(m)) : labelOf(m)}</option>)}
              <option value={ALL_MONTHS}>{ta.allMonths}</option>
            </select>
          )}
        </Field>
        <Field label={ta.person}>
          {(id) => (
            <select id={id} className="select" value={actorId} onChange={(e) => { setActorId(e.target.value); setPage(0); }}>
              <option value="">{ta.everyone}</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.displayName || i18n.common.someone}</option>)}
            </select>
          )}
        </Field>
        <button type="button" className="btn btn--sm btn--ghost audit-filters__clear" disabled={isDefault}
          onClick={() => { setMonth(currentMonth ?? month); setActorId(""); setPage(0); }}>
          {ta.clear}
        </button>
      </fieldset>

      {summary && summary.sessions > 0 && (
        <div className="activity-summary">
          <ul className="activity-stats" aria-label={t.summary}>
            <li><span className="activity-stats__num">{summary.sessions}</span><span className="muted">{t.visits}</span></li>
            <li><span className="activity-stats__num">{formatDuration(summary.activeSeconds)}</span><span className="muted">{t.totalTime}</span></li>
            <li><span className="activity-stats__num">{formatDuration(summary.averageSeconds)}</span><span className="muted">{t.perVisit}</span></li>
            {summary.lastSeenAt && <li><span className="activity-stats__num">{when.format(new Date(summary.lastSeenAt))}</span><span className="muted">{t.lastSeen}</span></li>}
          </ul>
          {summary.bySection.length > 0 && (
            <div className="activity-bars" aria-label={t.bySection}>
              {summary.bySection.map((s) => (
                <div key={s.section} className="activity-bar">
                  <span className="activity-bar__label">{sectionName(s.section)}</span>
                  <span className="activity-bar__track" aria-hidden>
                    <span className="activity-bar__fill" style={{ inlineSize: `${maxSeconds ? Math.max(4, Math.round((s.seconds / maxSeconds) * 100)) : 0}%` }} />
                  </span>
                  <span className="activity-bar__value muted">{formatDuration(s.seconds)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && !result ? <PageLoader /> : sessions.length === 0 ? (
        <EmptyState icon="👣" title={isDefault ? t.empty : t.emptyFiltered}>
          {isDefault && <p className="muted">{t.emptyHint}</p>}
        </EmptyState>
      ) : (
        <div className="table-wrap" aria-busy={loading}>
          <table className="table">
            <thead>
              <tr>
                <th>{t.started}</th><th>{ta.who}</th><th>{t.device}</th><th>{t.duration}</th><th>{t.pages}</th><th />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>{when.format(new Date(s.startedAt))}</td>
                  <td>{nameOf(s.userId)}</td>
                  <td>
                    <span aria-hidden>{DEVICE_ICON[s.device.kind]} </span>
                    {t.deviceKinds[s.device.kind]} · {s.device.os} · {s.device.browser}
                    {s.device.installed && <> · <span className="badge">{t.installed}</span></>}
                  </td>
                  <td>{formatDuration(s.activeSeconds)}</td>
                  <td>{s.pages}</td>
                  <td><button className="btn btn--sm btn--ghost" onClick={() => setOpenSession(s)}>{t.detail}</button></td>
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
      {openSession && (
        <SessionDetail session={openSession} personName={nameOf(openSession.userId)} onClose={() => setOpenSession(null)} />
      )}
    </>
  );
}

function SessionDetail({ session, personName, onClose }: { session: ActivitySession; personName: string; onClose(): void }) {
  const backend = useBackend();
  const i18n = useT();
  const t = i18n.superAdmin.activity;
  const time = dateFormat({ timeStyle: "short" });
  const { data: views = [], loading } = useAsync(() => backend.activity.sessionPages(session.id), [backend, session.id]);
  const sectionName = (key: string) => t.sections[key] ?? key;

  return (
    <Modal wide title={t.sessionTitle(personName)} onClose={onClose}>
      <p className="muted">{t.sessionInfo(session.pages, formatDuration(session.activeSeconds))}</p>
      {loading ? <PageLoader /> : views.length === 0 ? <p className="muted">{t.noPages}</p> : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>{t.at}</th><th>{t.section}</th><th>{t.page}</th><th>{t.time}</th></tr>
            </thead>
            <tbody>
              {views.map((v) => (
                <tr key={v.id}>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>{time.format(new Date(v.startedAt))}</td>
                  <td>{sectionName(v.section)}</td>
                  <td className="muted"><code>{v.path}</code></td>
                  <td>{formatDuration(v.seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
