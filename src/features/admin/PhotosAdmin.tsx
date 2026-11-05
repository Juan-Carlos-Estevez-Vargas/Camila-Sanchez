import { useMemo, useState } from "react";
import { groupPhotosByYearMonth, monthName } from "@/domain/dates";
import type { Photo } from "@/domain/types";
import { formatBytes } from "@/services/images/sizing";
import { useBackend } from "@/state/BackendContext";
import { useContentStore, useSiteContent } from "@/state/SiteContentStore";
import { EmptyState } from "@/ui/Feedback";
import { onRovingKeyDown, rovingTabIndex } from "@/ui/rovingFocus";
import { useConfirm } from "@/ui/useConfirm";
import { AdminPage } from "./AdminLayout";
import { BulkUploadPanel } from "./BulkUploadPanel";
import { SortableList } from "./SortableList";
import { useSaver } from "./useSaver";
import { useT } from "@/i18n";

function PhotoCard({ photo, thumb, onChanged, selected, onSelect }: {
  photo: Photo;
  thumb?: string;
  onChanged(): void;
  selected: boolean;
  onSelect(v: boolean): void;
}) {
  const backend = useBackend();
  const { run } = useSaver();
  const [confirm, confirmElement] = useConfirm();
  const [caption, setCaption] = useState(photo.caption);
  const [date, setDate] = useState(photo.takenOn);
  const a = useT().admin;
  const t = a.photos;

  const save = async (patch: Partial<Photo>, message?: string) => {
    await run(() => backend.photos.save({ ...photo, ...patch }), message);
    onChanged();
  };

  return (
    <div className={`photo-card${selected ? " is-selected" : ""}`}>
      <label className="photo-card__check">
        <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label={t.select} />
      </label>
      {thumb ? <img src={thumb} alt={photo.caption || t.noAlt} loading="lazy" decoding="async" /> : <div className="skeleton photo-card__ph" />}
      <div className="photo-card__body">
        <textarea
          className="textarea photo-card__caption" rows={2} value={caption} maxLength={500} placeholder={t.captionPlaceholder}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => caption !== photo.caption && void save({ caption }, t.captionSaved)}
          aria-label={t.captionLabel}
        />
        <div className="row-between">
          <input
            type="date" className="input photo-card__date" value={date} aria-label={t.dateLabel}
            onChange={(e) => setDate(e.target.value)}
            onBlur={() => date && date !== photo.takenOn && void save({ takenOn: date }, t.moved)}
          />
          <button
            className="btn btn--icon btn--ghost btn--sm" aria-label={t.deleteLabel}
            onClick={async () => {
              if (await confirm({ title: t.deleteTitle, body: a.cantUndo, confirmLabel: a.delete, danger: true })) {
                await run(() => backend.photos.delete(photo), t.deleted);
                onChanged();
              }
            }}
          >🗑</button>
        </div>
        {photo.bytes && <span className="muted photo-card__meta">{photo.width}×{photo.height} · {formatBytes(photo.bytes)}</span>}
      </div>
      {confirmElement}
    </div>
  );
}

export default function PhotosAdmin() {
  const backend = useBackend();
  const store = useContentStore();
  const { content, photoUrls } = useSiteContent();
  const { run, busy } = useSaver();
  const [confirm, confirmElement] = useConfirm();
  const years = useMemo(() => groupPhotosByYearMonth(content?.photos ?? []), [content?.photos]);
  const [yearIdx, setYearIdx] = useState(0);
  const [month, setMonth] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDate, setBulkDate] = useState("");
  const a = useT().admin;
  const t = a.photos;

  const year = years[Math.min(yearIdx, Math.max(0, years.length - 1))];
  const activeMonth = month ?? year?.months.findLast((m) => m.photos.length)?.month ?? 0;
  const monthPhotos = year?.months[activeMonth]?.photos ?? [];
  const refresh = () => store.refresh("photos");

  const toggle = (id: string, value: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });

  const moveSelected = async () => {
    const photos = (content?.photos ?? []).filter((p) => selected.has(p.id));
    await run(() => Promise.all(photos.map((p) => backend.photos.save({ ...p, takenOn: bulkDate }))), t.movedMany(photos.length));
    setSelected(new Set());
    refresh();
  };

  const deleteSelected = async () => {
    const photos = (content?.photos ?? []).filter((p) => selected.has(p.id));
    if (!(await confirm({ title: t.deleteManyTitle(photos.length), body: a.cantUndo, confirmLabel: a.delete, danger: true }))) return;
    await run(() => Promise.all(photos.map((p) => backend.photos.delete(p))), t.deletedMany);
    setSelected(new Set());
    refresh();
  };

  return (
    <AdminPage title={t.title} description={t.description}>
      <BulkUploadPanel onUploaded={refresh} />

      {years.length === 0 ? (
        <EmptyState icon="🖼️" title={t.empty}>{t.emptyHint}</EmptyState>
      ) : (
        <div className="card stack">
          <div className="row-between">
            <div className="tabs" role="tablist" aria-label={t.year} onKeyDown={onRovingKeyDown}>
              {years.map((y, i) => (
                <button key={y.year} role="tab" className="tab" aria-selected={i === yearIdx} tabIndex={rovingTabIndex(i === yearIdx)}
                  onClick={() => { setYearIdx(i); setMonth(null); }}>{y.year}</button>
              ))}
            </div>
            {selected.size > 0 && (
              <div className="row">
                <span className="badge">{t.selected(selected.size)}</span>
                <input type="date" className="input" style={{ width: "auto" }} value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} aria-label={t.newDate} />
                <button className="btn btn--sm" disabled={!bulkDate || busy} onClick={moveSelected}>{t.move}</button>
                <button className="btn btn--sm btn--danger" disabled={busy} onClick={deleteSelected}>{a.delete}</button>
              </div>
            )}
          </div>
          <div className="month-pills" role="group" aria-label={t.month}>
            {year?.months.map((m) => (
              <button key={m.month} className={`month-pill${m.month === activeMonth ? " is-active" : ""}`} aria-pressed={m.month === activeMonth}
                aria-label={t.monthCount(monthName(m.month), m.photos.length)}
                onClick={() => setMonth(m.month)} disabled={!m.photos.length}>
                {monthName(m.month)} <span>{m.photos.length}</span>
              </button>
            ))}
          </div>
          <p className="muted" style={{ margin: 0 }}>{t.reorderHint}</p>
          <SortableList
            className="photo-grid"
            items={monthPhotos}
            getId={(p) => p.id}
            onReorder={(items) => void run(() => store.reorderPhotos(items.map((p) => p.id)))}
            render={(photo) => (
              <PhotoCard
                key={`${photo.id}-${photo.caption}-${photo.takenOn}`}
                photo={photo}
                thumb={photoUrls.get(photo.id)?.thumb}
                onChanged={refresh}
                selected={selected.has(photo.id)}
                onSelect={(v) => toggle(photo.id, v)}
              />
            )}
          />
        </div>
      )}
      {confirmElement}
    </AdminPage>
  );
}
