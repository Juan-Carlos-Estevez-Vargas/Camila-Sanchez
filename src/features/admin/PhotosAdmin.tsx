import { useMemo, useState } from "react";
import { groupPhotosByYearMonth, MONTH_NAMES } from "@/domain/dates";
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

  const save = async (patch: Partial<Photo>, message?: string) => {
    await run(() => backend.photos.save({ ...photo, ...patch }), message);
    onChanged();
  };

  return (
    <div className={`photo-card${selected ? " is-selected" : ""}`}>
      <label className="photo-card__check">
        <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label="Seleccionar foto" />
      </label>
      {thumb ? <img src={thumb} alt={photo.caption} loading="lazy" decoding="async" /> : <div className="skeleton photo-card__ph" />}
      <div className="photo-card__body">
        <textarea
          className="textarea photo-card__caption" rows={2} value={caption} maxLength={500} placeholder="Escribe un mensaje…"
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => caption !== photo.caption && void save({ caption }, "Mensaje guardado")}
          aria-label="Mensaje de la foto"
        />
        <div className="row-between">
          <input
            type="date" className="input photo-card__date" value={date} aria-label="Fecha de la foto"
            onChange={(e) => setDate(e.target.value)}
            onBlur={() => date && date !== photo.takenOn && void save({ takenOn: date }, "Foto movida a otra fecha")}
          />
          <button
            className="btn btn--icon btn--ghost btn--sm" aria-label="Borrar foto"
            onClick={async () => {
              if (await confirm({ title: "¿Borrar esta foto?", body: "No se puede deshacer.", confirmLabel: "Borrar", danger: true })) {
                await run(() => backend.photos.delete(photo), "Foto borrada");
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
  const [order, setOrder] = useState<Photo[] | null>(null);

  const year = years[Math.min(yearIdx, Math.max(0, years.length - 1))];
  const activeMonth = month ?? year?.months.findLast((m) => m.photos.length)?.month ?? 0;
  const monthPhotos = year?.months[activeMonth]?.photos ?? [];
  const list = order ?? monthPhotos;
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
    await run(() => Promise.all(photos.map((p) => backend.photos.save({ ...p, takenOn: bulkDate }))), `${photos.length} fotos movidas`);
    setSelected(new Set());
    refresh();
  };

  const deleteSelected = async () => {
    const photos = (content?.photos ?? []).filter((p) => selected.has(p.id));
    if (!(await confirm({ title: `¿Borrar ${photos.length} fotos?`, body: "No se puede deshacer.", confirmLabel: "Borrar", danger: true }))) return;
    await run(() => Promise.all(photos.map((p) => backend.photos.delete(p))), "Fotos borradas");
    setSelected(new Set());
    refresh();
  };

  return (
    <AdminPage title="Fotos" description="Sube una foto o un álbum entero, ordénalas, muévelas de mes y escribe mensajes para cada recuerdo.">
      <BulkUploadPanel onUploaded={refresh} />

      {years.length === 0 ? (
        <EmptyState icon="🖼️" title="Todavía no hay fotos">Sube la primera arriba.</EmptyState>
      ) : (
        <div className="card stack">
          <div className="row-between">
            <div className="tabs" role="tablist" aria-label="Año" onKeyDown={onRovingKeyDown}>
              {years.map((y, i) => (
                <button key={y.year} role="tab" className="tab" aria-selected={i === yearIdx} tabIndex={rovingTabIndex(i === yearIdx)}
                  onClick={() => { setYearIdx(i); setMonth(null); setOrder(null); }}>{y.year}</button>
              ))}
            </div>
            {selected.size > 0 && (
              <div className="row">
                <span className="badge">{selected.size} seleccionadas</span>
                <input type="date" className="input" style={{ width: "auto" }} value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} aria-label="Nueva fecha" />
                <button className="btn btn--sm" disabled={!bulkDate || busy} onClick={moveSelected}>Mover</button>
                <button className="btn btn--sm btn--danger" disabled={busy} onClick={deleteSelected}>Borrar</button>
              </div>
            )}
          </div>
          <div className="month-pills" role="group" aria-label="Mes">
            {year?.months.map((m) => (
              <button key={m.month} className={`month-pill${m.month === activeMonth ? " is-active" : ""}`} aria-pressed={m.month === activeMonth}
                aria-label={`${MONTH_NAMES[m.month]}: ${m.photos.length} ${m.photos.length === 1 ? "foto" : "fotos"}`}
                onClick={() => { setMonth(m.month); setOrder(null); }} disabled={!m.photos.length}>
                {MONTH_NAMES[m.month]} <span>{m.photos.length}</span>
              </button>
            ))}
          </div>
          <p className="muted" style={{ margin: 0 }}>Arrastra las fotos (o usa ↑ ↓) para cambiar el orden en que aparecen.</p>
          <SortableList
            className="photo-grid"
            items={list}
            getId={(p) => p.id}
            onReorder={async (items) => {
              setOrder(items);
              await run(() => backend.content.reorder("photos", items.map((p) => p.id)));
              refresh();
              setTimeout(() => setOrder(null), 600);
            }}
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
