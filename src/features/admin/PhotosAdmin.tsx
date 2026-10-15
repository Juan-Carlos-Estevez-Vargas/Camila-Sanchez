import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { groupPhotosByYearMonth, MONTH_NAMES, toIsoDate } from "@/domain/dates";
import type { Photo } from "@/domain/types";
import { PhotoUploader, type UploadSnapshot } from "@/services/images/PhotoUploader";
import { formatBytes } from "@/services/images/sizing";
import { useBackend } from "@/state/BackendContext";
import { useContentStore, useSiteContent } from "@/state/SiteContentStore";
import { useToast } from "@/state/ToastContext";
import { EmptyState } from "@/ui/Feedback";
import { Field } from "@/ui/Field";
import { RomanticLoader } from "@/ui/RomanticLoader";
import { useConfirm } from "@/ui/useConfirm";
import { AdminPage } from "./AdminLayout";
import { SortableList } from "./SortableList";
import { useSaver } from "./useSaver";

type DateMode = "file" | "fixed";

function UploadPanel({ onUploaded }: { onUploaded(): void }) {
  const backend = useBackend();
  const toast = useToast();
  const { content } = useSiteContent();
  const uploader = useMemo(() => new PhotoUploader(backend), [backend]);
  const [tasks, setTasks] = useState<UploadSnapshot[]>([]);
  const [running, setRunning] = useState(false);
  const [dateMode, setDateMode] = useState<DateMode>("fixed");
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [caption, setCaption] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => uploader.subscribe(setTasks), [uploader]);
  useEffect(() => () => uploader.dispose(), [uploader]);

  const start = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (!images.length) return toast.show({ title: "Elige imágenes", body: "Sólo se pueden subir fotos.", tone: "error" });
    setRunning(true);
    const basePosition = (content?.photos.length ?? 0) + 1;
    const results = await uploader.enqueue(
      images.map((file) => ({ file, caption, takenOn: dateMode === "fixed" ? date : undefined })),
      basePosition,
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    const saved = ok.reduce((sum, r) => sum + (r.value.originalBytes - r.value.finalBytes), 0);
    // Deja ver el 100% un instante antes de cerrar.
    await new Promise((r) => setTimeout(r, 900));
    setRunning(false);
    uploader.clearFinished();
    onUploaded();
    const failed = results.length - ok.length;
    if (ok.length) toast.success(`${ok.length} ${ok.length === 1 ? "foto guardada" : "fotos guardadas"} 💖`, saved > 0 ? `Ahorramos ${formatBytes(saved)} sin perder calidad.` : undefined);
    if (failed) {
      const first = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      toast.error(first?.reason, `${failed} no se pudieron subir`);
    }
    setCaption("");
    if (input.current) input.current.value = "";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    void start([...e.dataTransfer.files]);
  };

  return (
    <div className="card stack">
      <div
        className={`dropzone${dragOver ? " is-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      >
        <div className="dropzone__icon" aria-hidden>📸</div>
        <strong>Arrastra tus fotos aquí o toca para elegirlas</strong>
        <span className="muted">Se ajustan y se aligeran solas, sin perder calidad.</span>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => void start([...(e.target.files ?? [])])} />
      </div>
      <div className="form-grid">
        <Field label="Fecha de las fotos">
          {(id) => (
            <select id={id} className="select" value={dateMode} onChange={(e) => setDateMode(e.target.value as DateMode)}>
              <option value="fixed">Una fecha para todas</option>
              <option value="file">La fecha de cada archivo</option>
            </select>
          )}
        </Field>
        {dateMode === "fixed" && (
          <Field label="¿Cuándo fue?">
            {(id) => <input id={id} type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
        )}
        <Field label="Mensaje (opcional)" hint="Se puede cambiar luego en cada foto">
          {(id) => <input id={id} className="input" maxLength={500} value={caption} onChange={(e) => setCaption(e.target.value)} />}
        </Field>
      </div>
      {running && tasks.length > 0 && <RomanticLoader tasks={tasks} onCancel={() => uploader.cancelAll()} />}
    </div>
  );
}

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
    <AdminPage title="Fotos" description="Sube, ordena, mueve de mes y escribe mensajes para cada recuerdo.">
      <UploadPanel onUploaded={refresh} />

      {years.length === 0 ? (
        <EmptyState icon="🖼️" title="Todavía no hay fotos">Sube la primera arriba.</EmptyState>
      ) : (
        <div className="card stack">
          <div className="row-between">
            <div className="tabs" role="tablist">
              {years.map((y, i) => (
                <button key={y.year} role="tab" className="tab" aria-selected={i === yearIdx}
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
          <div className="month-pills">
            {year?.months.map((m) => (
              <button key={m.month} className={`month-pill${m.month === activeMonth ? " is-active" : ""}`}
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
