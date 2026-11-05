import { pageCount, pageItems } from "@/domain/pagination";
import { useT } from "@/i18n";

interface Props {
  /** Página actual, base 0. */
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  /** Si se pasa, muestra el selector "Por página". */
  pageSizes?: readonly number[];
  onPageSize?: (size: number) => void;
}

/**
 * Paginación completa: primera, anterior, números con "…", siguiente y última,
 * más "1–25 de 312", "Página 1 de 13" y el selector de tamaño.
 */
export function Pagination({ page, pageSize, total, onPage, pageSizes, onPageSize }: Props) {
  const t = useT().common.pagination;
  const pages = pageCount(total, pageSize);
  const first = page === 0;
  const last = page >= pages - 1;
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);

  return (
    <nav className="pagination" aria-label={t.label}>
      <p className="pagination__summary muted" aria-live="polite">
        <span>{t.range(from, to, total)}</span>
        <span aria-hidden> · </span>
        <span>{t.pageOf(page + 1, pages)}</span>
      </p>
      <ul className="pagination__pages">
        <li><button type="button" className="btn btn--sm btn--ghost pagination__btn" disabled={first} onClick={() => onPage(0)} aria-label={t.first} title={t.first}>«</button></li>
        <li><button type="button" className="btn btn--sm btn--ghost pagination__btn" disabled={first} onClick={() => onPage(page - 1)} aria-label={t.previous} title={t.previous}>‹</button></li>
        {pageItems(page, pages).map((item, i) => item === "…" ? (
          <li key={`gap-${i}`} className="pagination__gap" aria-hidden>…</li>
        ) : (
          <li key={item}>
            <button type="button" className={`btn btn--sm pagination__btn ${item === page ? "" : "btn--ghost"}`}
              aria-current={item === page ? "page" : undefined} aria-label={t.goTo(item + 1)} onClick={() => onPage(item)}>
              {item + 1}
            </button>
          </li>
        ))}
        <li><button type="button" className="btn btn--sm btn--ghost pagination__btn" disabled={last} onClick={() => onPage(page + 1)} aria-label={t.next} title={t.next}>›</button></li>
        <li><button type="button" className="btn btn--sm btn--ghost pagination__btn" disabled={last} onClick={() => onPage(pages - 1)} aria-label={t.last} title={t.last}>»</button></li>
      </ul>
      {pageSizes && onPageSize && (
        <label className="pagination__size muted">
          {t.perPage}
          <select className="select" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
            {pageSizes.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      )}
    </nav>
  );
}
